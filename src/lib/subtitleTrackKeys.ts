/**
 * Naming for subtitle tracks.
 *
 * A file can hold several subtitle streams in the same language — full, forced-only,
 * SDH, a translation of on-screen text. They all used to collapse onto one key per
 * language, so only the first survived. Keys are now `<lang>` for the first track of a
 * language and `<lang>.<variant>` for the rest, which also gives each sidecar file a
 * unique name on disk.
 */

import { LANG_LABELS } from './subtitleLabels';
import type { StreamInfo } from './ffprobeStreams';

export interface SubtitleTrackName {
  /** Registry key and `?lang=` value, e.g. `en` or `en.forced`. */
  key: string;
  /** Language code on its own, for matching the viewer's preferred language. */
  lang: string;
  /** Menu label, e.g. "English" or "English (Forced)". */
  label: string;
}

const VARIANT_LABELS: Record<string, string> = {
  forced: 'Forced',
  sdh: 'SDH',
  cc: 'CC',
  commentary: 'Commentary',
  signs: 'Signs & Songs',
  songs: 'Songs',
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function prettifyVariant(variant: string): string {
  const known = VARIANT_LABELS[variant];
  if (known) return known;
  return variant
    .split('-')
    .filter(Boolean)
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word[0]!.toUpperCase() + word.slice(1)))
    .join(' ');
}

export function languageLabel(lang: string): string {
  return LANG_LABELS[lang] ?? (lang === 'und' ? 'Unknown' : lang.toUpperCase());
}

/** Split `en.forced` into its language and variant parts. */
export function parseSubtitleKey(key: string): { lang: string; variant?: string } {
  const dot = key.indexOf('.');
  if (dot < 0) return { lang: key.toLowerCase() };
  return { lang: key.slice(0, dot).toLowerCase(), variant: key.slice(dot + 1).toLowerCase() };
}

/** Menu label for a key, used for sidecar files we find on disk with no stream metadata. */
export function labelForSubtitleKey(key: string): string {
  const { lang, variant } = parseSubtitleKey(key);
  const base = languageLabel(lang);
  return variant ? `${base} (${prettifyVariant(variant)})` : base;
}

/** Variant name for a stream: from its disposition flags, else its title. */
function variantForStream(stream: StreamInfo): string | null {
  if (stream.isForced) return 'forced';
  if (stream.isHearingImpaired) return 'sdh';
  if (stream.isCommentary) return 'commentary';
  const fromTitle = stream.title ? slugify(stream.title) : '';
  // Titles like "Forced" / "SDH" are already covered by disposition; don't invent a bare "sdh" lang.
  if (fromTitle && VARIANT_LABELS[fromTitle]) return fromTitle;
  return fromTitle || null;
}

/**
 * Higher = better default for the bare language key (what "Captions: English" turns on).
 * Forced/signs-only tracks must not win this — they look like captions are broken.
 */
function primaryScore(stream: StreamInfo): number {
  let score = 0;
  if (!stream.isForced) score += 100;
  if (!stream.isCommentary) score += 40;
  if (!stream.isHearingImpaired) score += 20;
  if (stream.isDefault && !stream.isForced) score += 10;
  const title = stream.title?.trim().toLowerCase() ?? '';
  // Title-only Forced/SDH tags are common in remuxes and must not win the bare language key.
  if (/forced|signs|songs/.test(title)) score -= 80;
  if (/\bsdh\b|\bcc\b|hearing/.test(title)) score -= 30;
  if (title && !/forced|signs|songs|sdh|\bcc\b|hearing/.test(title)) score += 5;
  return score;
}

function labelForStream(stream: StreamInfo, key: string): string {
  const base = languageLabel(stream.lang);
  const { variant } = parseSubtitleKey(key);
  const title = stream.title?.trim();
  if (title && variant) {
    // Avoid "English (Forced (Forced))" when title already matches the variant.
    if (slugify(title) === variant || title.toLowerCase() === prettifyVariant(variant).toLowerCase()) {
      return `${base} (${prettifyVariant(variant)})`;
    }
    return `${base} (${title})`;
  }
  if (variant) return `${base} (${prettifyVariant(variant)})`;
  return base;
}

/**
 * Names every subtitle stream so no two share a key.
 * The *best* track per language (full dialogue, not Forced) gets the bare language code —
 * that is what the player's preferred-language setting and the top menu item turn on.
 */
export function nameSubtitleStreams(streams: StreamInfo[]): SubtitleTrackName[] {
  const used = new Set<string>();
  const altCount = new Map<string, number>();
  const names: SubtitleTrackName[] = new Array(streams.length);

  const byLang = new Map<string, number[]>();
  streams.forEach((stream, i) => {
    const list = byLang.get(stream.lang) ?? [];
    list.push(i);
    byLang.set(stream.lang, list);
  });

  for (const [lang, indexes] of byLang) {
    // Best full track first so it claims the bare `eng` / `kor` key.
    const ordered = [...indexes].sort((a, b) => {
      const score = primaryScore(streams[b]!) - primaryScore(streams[a]!);
      return score !== 0 ? score : a - b;
    });

    for (const index of ordered) {
      const stream = streams[index]!;
      let key: string;
      if (!used.has(lang)) {
        key = lang;
      } else {
        const variant = variantForStream(stream);
        const candidate = variant ? `${lang}.${variant}` : null;
        if (candidate && !used.has(candidate)) {
          key = candidate;
        } else {
          const n = (altCount.get(lang) ?? 1) + 1;
          altCount.set(lang, n);
          key = `${lang}.${n}`;
          while (used.has(key)) {
            const next = (altCount.get(lang) ?? n) + 1;
            altCount.set(lang, next);
            key = `${lang}.${next}`;
          }
        }
      }
      used.add(key);
      names[index] = { key, lang, label: labelForStream(stream, key) };
    }
  }

  return names;
}

/** Menu label for an audio stream, e.g. "English", "Greek", "English (Commentary)". */
export function audioStreamLabel(stream: StreamInfo): string {
  const base = languageLabel(stream.lang);
  const title = stream.title?.trim();
  if (title) return title.toLowerCase().includes(base.toLowerCase()) ? title : `${base} (${title})`;
  if (stream.isCommentary) return `${base} (Commentary)`;
  if (stream.isVisualImpaired) return `${base} (Audio Description)`;
  return base;
}

/** Appends " 2", " 3" … to labels that would otherwise be identical in the menu. */
export function dedupeLabels(labels: string[]): string[] {
  const counts = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const label of labels) totals.set(label, (totals.get(label) ?? 0) + 1);
  return labels.map((label) => {
    if ((totals.get(label) ?? 0) < 2) return label;
    const seen = (counts.get(label) ?? 0) + 1;
    counts.set(label, seen);
    return `${label} ${seen}`;
  });
}
