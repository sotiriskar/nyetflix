'use client';

import { useEffect, useRef, useState } from 'react';
import CastConnected from '@mui/icons-material/CastConnected';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Pause from '@mui/icons-material/Pause';
import Replay10 from '@mui/icons-material/Replay10';
import Forward10 from '@mui/icons-material/Forward10';
import { formatTime } from '@vidstack/react';
import {
  getCastStatus,
  seekCast,
  stopCasting,
  subscribeToCast,
  toggleCastPlayback,
} from '@/lib/googleCast';

function timeFromPointer(el: HTMLElement, clientX: number, duration: number): number {
  const { left, width } = el.getBoundingClientRect();
  if (width <= 0 || duration <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, (clientX - left) / width));
  return ratio * duration;
}

/**
 * Covers the paused local player while the TV is playing, and drives the receiver.
 *
 * Subscribes to the receiver itself so the once-a-second clock only re-renders this overlay
 * rather than the whole player and the page behind it.
 */
export function CastingOverlay({
  title,
  onStopped,
}: {
  title: string;
  onStopped: (tvTime: number) => void;
}) {
  const [status, setStatus] = useState(getCastStatus);
  useEffect(() => subscribeToCast(setStatus), []);

  const duration = status.duration > 0 ? status.duration : 0;
  const barRef = useRef<HTMLDivElement>(null);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const displayTime = dragTime ?? status.currentTime;
  const progress = duration > 0 ? Math.min(100, (displayTime / duration) * 100) : 0;

  const seekFromEvent = (clientX: number) => {
    const el = barRef.current;
    if (!el || duration <= 0) return 0;
    return timeFromPointer(el, clientX, duration);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-8 bg-black/95 px-6 text-white">
      <div className="flex flex-col items-center gap-3 text-center">
        <CastConnected sx={{ fontSize: 56 }} className="text-sky-400" />
        <p className="text-xl font-medium">{title}</p>
        <p className="text-sm text-white/60">
          {status.deviceName ? `Playing on ${status.deviceName}` : 'Connecting…'}
        </p>
      </div>

      <div className="w-full max-w-xl">
        <div className="flex justify-between text-xs text-white/60">
          <span>{formatTime(displayTime)}</span>
          <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>
        <div
          ref={barRef}
          role="slider"
          tabIndex={duration > 0 ? 0 : -1}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration || 1}
          aria-valuenow={displayTime}
          aria-disabled={duration <= 0}
          className={`relative mt-2 h-4 w-full ${duration > 0 ? 'cursor-pointer' : 'cursor-default'}`}
          onPointerDown={(e) => {
            if (duration <= 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const next = seekFromEvent(e.clientX);
            setDragTime(next);
          }}
          onPointerMove={(e) => {
            if (dragTime == null) return;
            setDragTime(seekFromEvent(e.clientX));
          }}
          onPointerUp={(e) => {
            if (dragTime == null) return;
            const next = seekFromEvent(e.clientX);
            setDragTime(null);
            seekCast(next);
          }}
          onPointerCancel={() => setDragTime(null)}
          onKeyDown={(e) => {
            if (duration <= 0) return;
            if (e.key === 'ArrowRight') seekCast(status.currentTime + 10);
            if (e.key === 'ArrowLeft') seekCast(status.currentTime - 10);
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-white/10">
            <div className="h-full bg-red-600" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => seekCast(status.currentTime - 10)}
          className="flex h-12 w-12 items-center justify-center rounded-full text-white hover:bg-white/15"
          aria-label="Back 10 seconds"
        >
          <Replay10 sx={{ fontSize: 28 }} />
        </button>
        <button
          type="button"
          onClick={toggleCastPlayback}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black hover:bg-white/90"
          aria-label={status.paused ? 'Play' : 'Pause'}
        >
          {status.paused ? <PlayArrow sx={{ fontSize: 36 }} /> : <Pause sx={{ fontSize: 36 }} />}
        </button>
        <button
          type="button"
          onClick={() => seekCast(status.currentTime + 10)}
          className="flex h-12 w-12 items-center justify-center rounded-full text-white hover:bg-white/15"
          aria-label="Forward 10 seconds"
        >
          <Forward10 sx={{ fontSize: 28 }} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          onStopped(stopCasting());
        }}
        className="rounded bg-white/15 px-5 py-2 text-sm font-medium hover:bg-white/25"
      >
        Stop casting
      </button>
    </div>
  );
}
