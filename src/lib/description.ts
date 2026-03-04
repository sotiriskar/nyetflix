/**
 * Truncate text to at most `max` words. If longer, returns first `max` words followed by "...".
 */
export function truncateToWords(text: string, max: number = 50): string {
  if (!text || typeof text !== 'string') return text ?? '';
  const trimmed = text.trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= max) return trimmed;
  return words.slice(0, max).join(' ') + '...';
}
