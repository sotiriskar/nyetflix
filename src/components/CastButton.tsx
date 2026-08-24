'use client';

import { useState } from 'react';
import Cast from '@mui/icons-material/Cast';
import CastConnected from '@mui/icons-material/CastConnected';
import { useMediaState, useMediaRemote } from '@vidstack/react';
import { getLanOrigin, toLanUrl } from '@/lib/castUrl';
import { castMedia, type CastTextTrack } from '@/lib/googleCast';

/**
 * Renders in the player's control bar (replacing the library's own cast button) so it can read
 * the live playback position and hand that to the TV, then pause local playback.
 */
export function CastButton({
  url,
  contentType,
  title,
  tracks,
  activeTrackIds,
  resumeSeconds,
  connected,
  onHandoffStart,
  onHandoffCancel,
  onError,
}: {
  url: string;
  contentType: string;
  title?: string;
  tracks?: CastTextTrack[];
  activeTrackIds?: number[];
  resumeSeconds: number;
  connected: boolean;
  onHandoffStart: () => void;
  onHandoffCancel: () => void;
  onError: (message: string) => void;
}) {
  const currentTime = useMediaState('currentTime');
  const duration = useMediaState('duration');
  const remote = useMediaRemote();
  const [busy, setBusy] = useState(false);

  const startCasting = async () => {
    if (busy) return;
    setBusy(true);
    // Freeze the browser immediately so it doesn't keep playing under the device picker.
    onHandoffStart();
    remote.pause();
    try {
      // Some files report a bogus near-duration time at load, so ignore anything near the end.
      const isSane = (t: number) => t > 1 && (duration <= 0 || t < duration - 30);
      const startTime = isSane(currentTime) ? currentTime : isSane(resumeSeconds) ? resumeSeconds : 0;
      // Resolve the LAN origin only when casting — probing adapters on every Play would stall the player.
      const lanOrigin = await getLanOrigin();
      const castUrl = toLanUrl(url, lanOrigin);
      const castTracks = tracks?.map((track) => ({ ...track, url: toLanUrl(track.url, lanOrigin) }));
      await castMedia({ url: castUrl, contentType, title, tracks: castTracks, activeTrackIds, startTime });
      remote.pause();
    } catch (error) {
      onHandoffCancel();
      const message = error instanceof Error ? error.message : 'Casting failed.';
      const cancelled = /cancel/i.test(message);
      if (!cancelled) onError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={startCasting}
      disabled={busy}
      className="vds-button"
      aria-label={connected ? 'Casting to TV' : 'Cast to TV'}
      title={connected ? 'Casting to TV' : 'Cast to TV'}
    >
      {connected ? (
        <CastConnected sx={{ fontSize: 22 }} className="text-sky-400" />
      ) : (
        <Cast sx={{ fontSize: 22 }} />
      )}
    </button>
  );
}
