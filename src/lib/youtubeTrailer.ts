/** Seconds into trailer where playback starts / loops. */
export const YT_TRAILER_START_SEC = 8;

export type TrailerYtPlayer = {
  mute?: () => void;
  unMute?: () => void;
  seekTo?: (s: number) => void;
  playVideo?: () => void;
};

/** Standard playerVars for background-style trailers (no visible controls). */
export function buildTrailerPlayerVars() {
  return {
    autoplay: 1,
    mute: 1,
    controls: 0,
    rel: 0,
    disablekb: 1,
    fs: 0,
    modestbranding: 1,
    iv_load_policy: 3,
    playsinline: 1,
    cc_load_policy: 0,
    start: YT_TRAILER_START_SEC,
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
  };
}

/** YouTube IFrame API: video ended. */
export const YT_STATE_ENDED = 0;

/** Crop iframe & remove border so YouTube chrome (controls, line, logos) stays off-screen. */
export function styleYoutubeTrailerIframe(iframe: HTMLIFrameElement) {
  iframe.setAttribute('frameborder', '0');
  iframe.style.border = '0';
  iframe.style.outline = 'none';
  iframe.style.pointerEvents = 'none';
  iframe.style.position = 'absolute';
  iframe.style.top = '0';
  iframe.style.left = '50%';
  iframe.style.width = '300%';
  iframe.style.height = '100%';
  iframe.style.transform = 'translateX(-50%)';
  iframe.style.maxWidth = 'none';
}

/** Loop single trailer without `playlist` (playlist shows prev/next navigation). */
export function restartTrailerLoop(player: TrailerYtPlayer | null, startSec = YT_TRAILER_START_SEC) {
  player?.seekTo?.(startSec);
  player?.playVideo?.();
}
