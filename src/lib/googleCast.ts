/**
 * Minimal Google Cast sender.
 *
 * We drive the receiver directly instead of going through the player library: a LoadRequest
 * takes `autoplay` and `currentTime` as plain fields, so starting playback at the right spot
 * is explicit. We also never write the TV's volume — that stays wherever the user has it.
 *
 * Cast SDK types come from the ambient declarations shipped with @vidstack/react.
 */

import { isHlsMimeType } from './videoMime';

const SENDER_SDK_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
const SUBTITLE_CONTENT_TYPE = 'text/vtt';

export type CastConnectionState = 'unavailable' | 'disconnected' | 'connecting' | 'connected';

export type CastStatus = {
  state: CastConnectionState;
  deviceName: string | null;
  mediaLoaded: boolean;
  paused: boolean;
  currentTime: number;
  duration: number;
};

export type CastTextTrack = {
  id: number;
  url: string;
  lang: string;
  label: string;
};

export type CastMediaRequest = {
  url: string;
  contentType: string;
  title?: string;
  startTime?: number;
  tracks?: CastTextTrack[];
  activeTrackIds?: number[];
};

const DISCONNECTED: CastStatus = {
  state: 'unavailable',
  deviceName: null,
  mediaLoaded: false,
  paused: true,
  currentTime: 0,
  duration: 0,
};

let sdkPromise: Promise<boolean> | null = null;
let ready = false;
let remotePlayer: cast.framework.RemotePlayer | null = null;
let playerController: cast.framework.RemotePlayerController | null = null;
let status: CastStatus = DISCONNECTED;
const listeners = new Set<(status: CastStatus) => void>();

function sdkPresent(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof chrome !== 'undefined' &&
    !!chrome.cast?.media &&
    typeof cast !== 'undefined' &&
    !!cast.framework
  );
}

function loadSdk(): Promise<boolean> {
  sdkPromise ??= new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (sdkPresent()) {
      resolve(true);
      return;
    }
    // The SDK calls this global once the framework is ready.
    (window as Window & { __onGCastApiAvailable?: (available: boolean) => void }).__onGCastApiAvailable = (
      available: boolean,
    ) => resolve(available && sdkPresent());
    const script = document.createElement('script');
    script.src = SENDER_SDK_URL;
    script.async = true;
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return sdkPromise;
}

function toConnectionState(state: cast.framework.CastState): CastConnectionState {
  switch (state) {
    case cast.framework.CastState.CONNECTED:
      return 'connected';
    case cast.framework.CastState.CONNECTING:
      return 'connecting';
    case cast.framework.CastState.NO_DEVICES_AVAILABLE:
      return 'unavailable';
    default:
      return 'disconnected';
  }
}

function publish(): void {
  if (!ready) return;
  const context = cast.framework.CastContext.getInstance();
  const session = context.getCurrentSession();
  status = {
    state: toConnectionState(context.getCastState()),
    deviceName: session?.getCastDevice()?.friendlyName ?? null,
    mediaLoaded: !!remotePlayer?.isMediaLoaded,
    paused: remotePlayer ? remotePlayer.isPaused : true,
    currentTime: remotePlayer?.currentTime ?? 0,
    duration: remotePlayer?.duration ?? 0,
  };
  for (const listener of listeners) listener(status);
}

/** Loads the sender SDK and wires up listeners. Resolves false when casting isn't possible here. */
export async function initGoogleCast(): Promise<boolean> {
  if (ready) return true;
  if (!(await loadSdk())) return false;
  if (ready) return true;

  const context = cast.framework.CastContext.getInstance();
  context.setOptions({
    receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    resumeSavedSession: false,
  });

  remotePlayer = new cast.framework.RemotePlayer();
  playerController = new cast.framework.RemotePlayerController(remotePlayer);
  playerController.addEventListener(cast.framework.RemotePlayerEventType.ANY_CHANGE, publish);
  context.addEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, publish);

  ready = true;
  publish();
  return true;
}

export function subscribeToCast(listener: (status: CastStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => {
    listeners.delete(listener);
  };
}

export function getCastStatus(): CastStatus {
  return status;
}

/**
 * Multi-audio titles are cast as HLS with fMP4 renditions. The receiver assumes MPEG-TS
 * segments unless told otherwise and then fails to play anything, so spell it out. These two
 * fields are missing from the bundled Cast type definitions.
 */
function applyHlsSegmentFormat(mediaInfo: chrome.cast.media.MediaInfo, contentType: string): void {
  if (!isHlsMimeType(contentType)) return;
  const media = chrome.cast.media as unknown as {
    HlsSegmentFormat?: Record<string, string>;
    HlsVideoSegmentFormat?: Record<string, string>;
  };
  const target = mediaInfo as unknown as Record<string, string>;
  if (media.HlsSegmentFormat?.FMP4) target.hlsSegmentFormat = media.HlsSegmentFormat.FMP4;
  if (media.HlsVideoSegmentFormat?.FMP4) {
    target.hlsVideoSegmentFormat = media.HlsVideoSegmentFormat.FMP4;
  }
}

/** Opens the device picker if needed, then loads the media so it starts playing at `startTime`. */
export async function castMedia(request: CastMediaRequest): Promise<void> {
  if (!ready) throw new Error('Google Cast is not available.');
  const context = cast.framework.CastContext.getInstance();

  if (!context.getCurrentSession()) {
    const errorCode = await context.requestSession();
    if (errorCode) throw new Error(`Could not connect to the cast device (${errorCode}).`);
  }
  const session = context.getCurrentSession();
  if (!session) throw new Error('Could not start a cast session.');

  const mediaInfo = new chrome.cast.media.MediaInfo(request.url, request.contentType);
  mediaInfo.streamType = chrome.cast.media.StreamType.BUFFERED;
  applyHlsSegmentFormat(mediaInfo, request.contentType);

  const metadata = new chrome.cast.media.GenericMediaMetadata();
  metadata.title = request.title ?? '';
  mediaInfo.metadata = metadata;

  if (request.tracks?.length) {
    mediaInfo.tracks = request.tracks.map((track) => {
      const castTrack = new chrome.cast.media.Track(track.id, chrome.cast.media.TrackType.TEXT);
      castTrack.trackContentId = track.url;
      castTrack.trackContentType = SUBTITLE_CONTENT_TYPE;
      castTrack.subtype = chrome.cast.media.TextTrackType.SUBTITLES;
      castTrack.language = track.lang;
      castTrack.name = track.label;
      return castTrack;
    });
  }

  const loadRequest = new chrome.cast.media.LoadRequest(mediaInfo);
  loadRequest.autoplay = true;
  loadRequest.currentTime = Math.max(0, request.startTime ?? 0);
  if (request.activeTrackIds?.length) loadRequest.activeTrackIds = request.activeTrackIds;

  const errorCode = await session.loadMedia(loadRequest);
  if (errorCode) throw new Error(`The TV could not play this file (${errorCode}).`);
  publish();
}

export function toggleCastPlayback(): void {
  playerController?.playOrPause();
}

export function seekCast(seconds: number): void {
  if (!remotePlayer || !playerController) return;
  const max = remotePlayer.duration > 0 ? remotePlayer.duration : seconds;
  remotePlayer.currentTime = Math.min(Math.max(0, seconds), max);
  playerController.seek();
}

export function getCastCurrentTime(): number {
  if (remotePlayer?.isMediaLoaded && remotePlayer.currentTime > 0) return remotePlayer.currentTime;
  return status.currentTime;
}

/** Ends the session and returns the TV's last position so the browser can resume there. */
export function stopCasting(): number {
  const lastTime = getCastCurrentTime();
  if (!ready) return lastTime;
  cast.framework.CastContext.getInstance().endCurrentSession(true);
  publish();
  return lastTime;
}
