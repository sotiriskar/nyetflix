import type { MediaStorage } from '@vidstack/react';

/**
 * Vidstack storage that only remembers volume and mute. Playback position stays owned by
 * ProgressContext, so every other getter deliberately returns null.
 *
 * This also controls Google Cast loudness: Vidstack pushes the player's volume to the receiver
 * when the TV loads the media, so without this the TV starts at 100%.
 */

const STORAGE_KEY = 'nyetflix:player-volume';
/** First run only. After that, whatever the user sets is remembered. */
const FIRST_RUN_VOLUME = 0.4;

type StoredVolume = { volume: number; muted: boolean };

function read(): StoredVolume | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredVolume>;
    const volume = typeof parsed.volume === 'number' ? Math.min(Math.max(parsed.volume, 0), 1) : null;
    if (volume == null) return null;
    return { volume, muted: !!parsed.muted };
  } catch {
    return null;
  }
}

function write(next: StoredVolume): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode / quota); volume just won't persist.
  }
}

/**
 * While the TV is playing we mute the local element so it can't leak audio. That mute is
 * temporary and must not overwrite the user's saved preference.
 */
let persistMute = true;

export function setPersistPlayerMute(persist: boolean): void {
  persistMute = persist;
}

export const playerVolumeStorage: MediaStorage = {
  async getVolume() {
    return read()?.volume ?? FIRST_RUN_VOLUME;
  },
  async setVolume(volume: number) {
    write({ volume, muted: read()?.muted ?? false });
  },
  async getMuted() {
    return read()?.muted ?? false;
  },
  async setMuted(muted: boolean) {
    if (!persistMute) return;
    write({ volume: read()?.volume ?? FIRST_RUN_VOLUME, muted });
  },
  async getTime() {
    return null;
  },
  async getLang() {
    return null;
  },
  async getCaptions() {
    return null;
  },
  async getPlaybackRate() {
    return null;
  },
  async getVideoQuality() {
    return null;
  },
  async getAudioGain() {
    return null;
  },
};
