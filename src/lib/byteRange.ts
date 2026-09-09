/**
 * Parse a single HTTP Range bytes unit into inclusive start/end offsets.
 * Supports `bytes=0-1023`, `bytes=1024-`, and suffix `bytes=-5000000`.
 */
export function parseBytesRange(
  rangeHeader: string,
  size: number
): { start: number; end: number } | null {
  if (size <= 0) return null;
  if (!rangeHeader.toLowerCase().startsWith('bytes=')) return null;

  const spec = rangeHeader.slice(6).split(',')[0]?.trim() ?? '';
  const dash = spec.indexOf('-');
  if (dash < 0) return null;

  const startRaw = spec.slice(0, dash);
  const endRaw = spec.slice(dash + 1);

  // Suffix: last N bytes — browsers use this to fetch moov at EOF.
  if (!startRaw && endRaw) {
    const suffix = parseInt(endRaw, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    const length = Math.min(suffix, size);
    return { start: size - length, end: size - 1 };
  }

  const start = startRaw ? parseInt(startRaw, 10) : 0;
  if (!Number.isFinite(start) || start < 0) return null;

  if (!endRaw) {
    return { start: Math.min(start, size - 1), end: size - 1 };
  }

  const end = parseInt(endRaw, 10);
  if (!Number.isFinite(end) || end < start) return null;

  return {
    start: Math.min(start, size - 1),
    end: Math.min(end, size - 1),
  };
}
