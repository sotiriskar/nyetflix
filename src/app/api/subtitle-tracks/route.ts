import { NextRequest, NextResponse } from 'next/server';
import { dirname, basename } from 'path';
import { registry, ensureHydrated, persistRegistry } from '@/lib/streamRegistry';
import { extractEmbeddedSubtitlesToSidecar } from '@/lib/extractEmbeddedSubtitles';

/** Language code -> display label. ISO 639-1 and ISO 639-2 (incl. bibliographic codes like gre, baq). */
const LANG_LABELS: Record<string, string> = {
  en: 'English', eng: 'English',
  el: 'Greek', ell: 'Greek', gre: 'Greek', gr: 'Greek',
  es: 'Spanish', spa: 'Spanish',
  fr: 'French', fra: 'French', fre: 'French',
  de: 'German', deu: 'German', ger: 'German',
  it: 'Italian', ita: 'Italian',
  pt: 'Portuguese', por: 'Portuguese',
  ru: 'Russian', rus: 'Russian',
  ja: 'Japanese', jpn: 'Japanese',
  zh: 'Chinese', zho: 'Chinese', chi: 'Chinese',
  ko: 'Korean', kor: 'Korean',
  ar: 'Arabic', ara: 'Arabic',
  tr: 'Turkish', tur: 'Turkish',
  nl: 'Dutch', nld: 'Dutch', dut: 'Dutch',
  pl: 'Polish', pol: 'Polish',
  sv: 'Swedish', swe: 'Swedish',
  hi: 'Hindi', hin: 'Hindi',
  th: 'Thai', tha: 'Thai',
  vi: 'Vietnamese', vie: 'Vietnamese',
  id: 'Indonesian', ind: 'Indonesian',
  ms: 'Malay', msa: 'Malay', may: 'Malay',
  ca: 'Catalan', cat: 'Catalan',
  cs: 'Czech', cze: 'Czech', ces: 'Czech',
  da: 'Danish', dan: 'Danish',
  eu: 'Basque', baq: 'Basque', eus: 'Basque',
  fi: 'Finnish', fin: 'Finnish',
  fil: 'Filipino',
  gl: 'Galician', glg: 'Galician',
  he: 'Hebrew', heb: 'Hebrew',
  hu: 'Hungarian', hun: 'Hungarian',
  no: 'Norwegian', nor: 'Norwegian', nob: 'Norwegian Bokmål', nno: 'Norwegian Nynorsk',
  ro: 'Romanian', ron: 'Romanian', rum: 'Romanian',
  sk: 'Slovak', slk: 'Slovak', slo: 'Slovak',
  uk: 'Ukrainian', ukr: 'Ukrainian',
  hr: 'Croatian', hrv: 'Croatian',
  und: 'Unknown',
};

export interface SubtitleTrackResponse {
  tracks: Array<{ lang: string; label: string; src: string }>;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET ?id=... — Returns external subtitle tracks only (sidecar .srt/.vtt from registry).
 * Embedded subtitles are extracted to sidecar files during MKV→MP4 conversion; we never show embedded streams.
 */
export async function GET(request: NextRequest) {
  let id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep as-is
  }

  ensureHydrated();
  const tracks: Array<{ lang: string; label: string; src: string }> = [];

  let byLang =
    registry.itemIdToSubtitlePath.get(id) ?? registry.episodeIdToSubtitlePath.get(id);

  // If no external subs, try extracting from embedded (MKV etc.) so we create sidecar files
  if ((!byLang || Object.keys(byLang).length === 0)) {
    const videoPath = registry.itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
    if (videoPath && (videoPath.toLowerCase().endsWith('.mkv') || videoPath.toLowerCase().endsWith('.mp4'))) {
      try {
        const dir = dirname(videoPath);
        const base = basename(videoPath).replace(/\.[^/.]+$/i, '');
        const extracted = await extractEmbeddedSubtitlesToSidecar(videoPath, dir, base);
        if (Object.keys(extracted).length > 0) {
          const isEpisode = /^episode-.+-S\d+-E\d+$/.test(id);
          const existing = isEpisode
            ? (registry.episodeIdToSubtitlePath.get(id) ?? {})
            : (registry.itemIdToSubtitlePath.get(id) ?? {});
          const merged = { ...existing, ...extracted };
          if (isEpisode) registry.episodeIdToSubtitlePath.set(id, merged);
          else registry.itemIdToSubtitlePath.set(id, merged);
          persistRegistry();
          byLang = merged;
        }
      } catch {
        // ignore extraction errors
      }
    }
  }

  if (byLang && typeof byLang === 'object') {
    const langs = Object.keys(byLang).sort();
    for (const lang of langs) {
      tracks.push({
        lang,
        label: LANG_LABELS[lang] ?? lang,
        src: `/api/subtitles?id=${encodeURIComponent(id)}&lang=${encodeURIComponent(lang)}`,
      });
    }
  }

  return NextResponse.json({ tracks } satisfies SubtitleTrackResponse);
}
