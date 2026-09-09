import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { basename, dirname, join } from 'path';
import { getAppConfig, setAppConfig } from '@/lib/appConfig';
import { getConvertedPath, clearConvertedPath } from '@/lib/convertedMkvStore';
import {
  listInFlightConversions,
  getConversionProgress,
  isItemConversionInFlight,
} from '@/lib/mkvConversionRunner';
import {
  isHlsMarkerPath,
  isHlsPackageComplete,
  dataDirFor,
  removeHlsPackage,
} from '@/lib/hlsPackage';
import { registry, ensureHydrated, persistRegistry } from '@/lib/streamRegistry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type ConversionStatusEntry = {
  itemId: string;
  status: 'converting' | 'incomplete' | 'ready' | 'needs_conversion';
  progress?: number;
  currentTime?: number;
  durationSeconds?: number;
  etaSeconds?: number;
  /** True when a sibling .mkv still exists next to a converted package. */
  canRestoreOriginal?: boolean;
};

function siblingMkv(path: string): string | null {
  const dir = dirname(path);
  const base = basename(path).replace(/\.(m3u8|mp4|mkv)$/i, '');
  const mkv = join(dir, base + '.mkv');
  return existsSync(mkv) ? mkv : null;
}

function statusForId(itemId: string): ConversionStatusEntry {
  if (isItemConversionInFlight(itemId)) {
    const p = getConversionProgress(itemId);
    return {
      itemId,
      status: 'converting',
      progress: p?.progress ?? 0,
      currentTime: p?.currentTime,
      durationSeconds: p?.durationSeconds,
      etaSeconds: p?.etaSeconds,
    };
  }

  ensureHydrated();
  const filePath = registry.itemIdToPath.get(itemId) ?? registry.episodeIdToPath.get(itemId);
  const converted = getConvertedPath(itemId);
  const playable = (converted && existsSync(converted) ? converted : null)
    ?? (filePath && existsSync(filePath) ? filePath : null);

  if (playable && isHlsMarkerPath(playable)) {
    if (!isHlsPackageComplete(playable)) {
      return {
        itemId,
        status: 'incomplete',
        canRestoreOriginal: !!siblingMkv(playable),
      };
    }
    return {
      itemId,
      status: 'ready',
      progress: 1,
      canRestoreOriginal: !!siblingMkv(playable),
    };
  }

  if (playable && /\.mp4$/i.test(playable)) {
    return {
      itemId,
      status: 'ready',
      progress: 1,
      canRestoreOriginal: !!siblingMkv(playable),
    };
  }

  if (playable && /\.mkv$/i.test(playable)) {
    // Stale incomplete .hlsdata next to an MKV (failed / interrupted encode)
    const dataDir = join(dirname(playable), basename(playable, '.mkv') + '.hlsdata');
    if (existsSync(dataDir)) {
      return {
        itemId,
        status: 'incomplete',
        canRestoreOriginal: true,
      };
    }
    return { itemId, status: 'needs_conversion' };
  }

  return { itemId, status: 'needs_conversion' };
}

/** GET ?ids=a,b,c — conversion badges. Without ids, returns all in-flight. PATCH keepSourceMkv. */
export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids');
  const ids = idsParam
    ? idsParam.split(',').map((s) => s.trim()).filter(Boolean)
    : listInFlightConversions().map((c) => c.itemId);

  const unique = [...new Set(ids)];
  const conversions: Record<string, ConversionStatusEntry> = {};
  for (const id of unique) conversions[id] = statusForId(id);

  // Always include every in-flight encode so cards update when you leave the player.
  for (const { itemId } of listInFlightConversions()) {
    conversions[itemId] = statusForId(itemId);
  }

  return NextResponse.json({
    conversions,
    keepSourceMkv: getAppConfig().keepSourceMkv,
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { keepSourceMkv?: boolean };
    if (body.keepSourceMkv === undefined) {
      return NextResponse.json({ error: 'Missing keepSourceMkv' }, { status: 400 });
    }
    const cfg = setAppConfig({ keepSourceMkv: !!body.keepSourceMkv });
    return NextResponse.json(cfg);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST { id, action: 'restore' | 'cleanup' }
 * restore — drop converted package and point registry at sibling .mkv
 * cleanup — remove incomplete .hlsdata / broken marker so a fresh convert can start
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { id?: string; action?: string };
    const id = body.id?.trim();
    const action = body.action === 'restore' ? 'restore' : body.action === 'cleanup' ? 'cleanup' : null;
    if (!id || !action) {
      return NextResponse.json({ error: 'Need id and action (restore|cleanup)' }, { status: 400 });
    }
    if (isItemConversionInFlight(id)) {
      return NextResponse.json({ error: 'Conversion still running' }, { status: 409 });
    }

    ensureHydrated();
    const filePath = registry.itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
    const converted = getConvertedPath(id);
    const active = converted && existsSync(converted) ? converted : filePath;

    if (action === 'cleanup') {
      if (active && isHlsMarkerPath(active)) {
        await removeHlsPackage(active);
      } else if (active && /\.mkv$/i.test(active)) {
        const marker = join(dirname(active), basename(active, '.mkv') + '.m3u8');
        await removeHlsPackage(marker);
        const dataDir = dataDirFor(marker);
        if (existsSync(dataDir)) {
          await removeHlsPackage(marker);
        }
      }
      clearConvertedPath(id);
      const mkv = active ? siblingMkv(active) : null;
      if (mkv) {
        if (registry.episodeIdToPath.has(id)) registry.episodeIdToPath.set(id, mkv);
        else registry.itemIdToPath.set(id, mkv);
        persistRegistry();
      }
      return NextResponse.json({ ok: true, status: statusForId(id) });
    }

    // restore
    const mkv =
      (active ? siblingMkv(active) : null) ??
      (filePath && /\.mkv$/i.test(filePath) && existsSync(filePath) ? filePath : null);
    if (!mkv) {
      return NextResponse.json(
        { error: 'Original MKV not found. Keep source enabled next time, or put the .mkv back next to the title.' },
        { status: 404 },
      );
    }
    if (active && isHlsMarkerPath(active)) await removeHlsPackage(active);
    else if (active && /\.mp4$/i.test(active) && existsSync(active)) {
      const { unlink } = await import('fs/promises');
      await unlink(active).catch(() => {});
    }
    clearConvertedPath(id);
    if (registry.episodeIdToPath.has(id)) registry.episodeIdToPath.set(id, mkv);
    else registry.itemIdToPath.set(id, mkv);
    persistRegistry();
    return NextResponse.json({ ok: true, status: statusForId(id) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
