/** Build /watch or /watch/<id> URL with optional query params (title, seriesTitle, subs). */
export function buildWatchUrl(
  id: string | null | undefined,
  opts?: { title?: string; seriesTitle?: string; subs?: string[] }
): string {
  if (!id?.trim()) return '/watch';
  const base = `/watch/${encodeURIComponent(id.trim())}`;
  if (!opts) return base;
  const params = new URLSearchParams();
  if (opts.title?.trim()) params.set('title', opts.title.trim());
  if (opts.seriesTitle?.trim()) params.set('seriesTitle', opts.seriesTitle.trim());
  if (opts.subs?.length) params.set('subs', opts.subs.filter(Boolean).join(','));
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}
