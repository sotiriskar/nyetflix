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
