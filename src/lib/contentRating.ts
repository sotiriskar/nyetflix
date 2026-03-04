/**
 * Short content descriptors (2–3 words) shown next to age rating, fixed per rating.
 */
const RATING_DESCRIPTORS: Record<string, string> = {
  ALL: 'for everyone',
  '7+': 'mild violence',
  '13+': 'language, substances',
  '16+': 'violence, language, substances',
  '18+': 'violence, sex, nudity, language, substances',
};

export function getContentRatingDescriptors(rating: string | undefined): string | null {
  if (!rating || typeof rating !== 'string') return null;
  const key = rating.trim().toUpperCase();
  return RATING_DESCRIPTORS[key] ?? null;
}

/** e.g. "Recommended for ages 13 and up" for About section. */
export function getContentRatingRecommendation(rating: string | undefined): string | null {
  if (!rating || typeof rating !== 'string') return null;
  const r = rating.trim().toUpperCase();
  if (r === 'ALL') return 'For all ages';
  if (r === '7+') return 'Recommended for ages 7 and up';
  if (r === '13+') return 'Recommended for ages 13 and up';
  if (r === '16+') return 'Recommended for ages 16 and up';
  if (r === '18+') return 'Recommended for ages 18 and up';
  return null;
}
