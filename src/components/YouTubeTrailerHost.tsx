/**
 * Wrapper for YouTube IFrame API player targets.
 * Uses a transparent shield div on top of the iframe so hover never reaches YouTube
 * (see krdevnotes.com background-embed pattern). Iframe is widened via CSS to crop UI.
 */
export function YouTubeTrailerHost({
  playerId,
  className = '',
}: {
  playerId: string;
  className?: string;
}) {
  return (
    <div className={`yt-trailer-host absolute inset-0 overflow-hidden ${className}`}>
      <div id={playerId} className="yt-trailer-player absolute inset-0" />
      <div className="yt-trailer-shield absolute inset-0 z-[5]" aria-hidden />
    </div>
  );
}
