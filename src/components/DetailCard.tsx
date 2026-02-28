import { useEffect, useState, useCallback } from 'react';
import Add from '@mui/icons-material/Add';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import PlayArrow from '@mui/icons-material/PlayArrow';
import ThumbUp from '@mui/icons-material/ThumbUp';
import VolumeUp from '@mui/icons-material/VolumeUp';
import type { MovieDetail, SeriesSeason } from '../types/movie';

interface DetailCardProps {
  detail: MovieDetail;
  onClose: () => void;
  /** Called when "Play" is clicked – e.g. open video player. */
  onPlay?: (detail: MovieDetail) => void;
  /** Called when an episode is selected for playback (series only). */
  onPlayEpisode?: (episodeId: string, episodeTitle?: string, subtitleLanguages?: string[]) => void;
  /** Called when user tries to play an episode that has no local file (series only). */
  onPlayUnavailable?: (message: string) => void;
  /** Called when Add to My List is clicked. */
  onAddClick?: () => void;
  /** Whether this title is in My List. */
  isInList?: boolean;
  /** Called when Like is clicked. */
  onLikeClick?: () => void;
  /** Whether this title is liked. */
  isLiked?: boolean;
}

export function DetailCard({ detail, onClose, onPlay, onPlayEpisode, onPlayUnavailable, onAddClick, isInList = false, onLikeClick, isLiked = false }: DetailCardProps) {
  const [seasons, setSeasons] = useState<SeriesSeason[]>([]);
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);

  const isSeries = detail.mediaType === 'series';

  const fetchEpisodes = useCallback(() => {
    if (!isSeries || !detail.id) return;
    setEpisodesLoading(true);
    setEpisodesError(null);
    fetch(`/api/series-episodes?id=${encodeURIComponent(detail.id)}&title=${encodeURIComponent(detail.title ?? '')}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'No episodes found.' : 'Failed to load episodes.');
        return res.json();
      })
      .then((data: { seasons: SeriesSeason[] }) => {
        setSeasons(data.seasons ?? []);
        const first = data.seasons?.[0];
        if (first) setSelectedSeasonNum(first.number);
      })
      .catch((err) => setEpisodesError(err instanceof Error ? err.message : 'Failed to load episodes.'))
      .finally(() => setEpisodesLoading(false));
  }, [isSeries, detail.id, detail.title]);

  useEffect(() => {
    if (isSeries && detail.id) fetchEpisodes();
  }, [isSeries, detail.id, fetchEpisodes]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const imageUrl = detail.backdropUrl ?? detail.posterUrl ?? undefined;
  const currentSeason = seasons.find((s) => s.number === selectedSeasonNum);
  const episodes = currentSeason?.episodes ?? [];

  const handleMainPlay = () => {
    if (isSeries && seasons.length > 0 && episodes.length > 0) {
      const first = episodes[0];
      if (first.hasFile && first.id && onPlayEpisode) {
        onPlayEpisode(
          first.id,
          `${detail.title} – S${first.seasonNumber}:E${first.episodeNumber} ${first.title}`,
          first.subtitleLanguages
        );
      } else if (!first.hasFile && onPlayUnavailable) {
        onPlayUnavailable('This episode is not in your library.');
      }
    } else {
      onPlay?.(detail);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${detail.title}`}
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-lg bg-[#181818] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top: image / backdrop */}
        <div className="relative flex-shrink-0 aspect-video w-full bg-white/5">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30 text-6xl font-bold">
              ?
            </div>
          )}
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-white hover:text-black transition-colors duration-200 z-10"
            aria-label="Close"
          >
            <Close sx={{ fontSize: 24 }} />
          </button>
          {/* Controls over image */}
          <div className="absolute bottom-4 left-8 flex items-center gap-3 z-10">
            <button
              type="button"
              onClick={handleMainPlay}
              className="flex items-center gap-2 h-11 px-5 rounded-md bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors justify-center min-w-[90px]"
              aria-label="Play"
            >
              <PlayArrow sx={{ fontSize: 38 }} />
              Play
            </button>
            <button
              type="button"
              onClick={onAddClick}
              className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-colors ${
                isInList ? 'border-white bg-white text-black' : 'border-white/70 text-white hover:bg-white/20'
              }`}
              aria-label={isInList ? 'In My List' : 'Add to My List'}
            >
              {isInList ? <Check sx={{ fontSize: 24 }} /> : <Add sx={{ fontSize: 24 }} />}
            </button>
            <button
              type="button"
              onClick={onLikeClick}
              className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-colors ${
                isLiked ? 'border-white bg-white text-black' : 'border-white/70 text-white hover:bg-white/20'
              }`}
              aria-label={isLiked ? 'Liked' : 'Like'}
            >
              <ThumbUp sx={{ fontSize: 22 }} />
            </button>
          </div>
          <div className="absolute bottom-4 right-8 z-10">
            <button
              type="button"
              className="w-11 h-11 rounded-full border-2 border-white/70 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              aria-label="Volume"
            >
              <VolumeUp sx={{ fontSize: 24 }} />
            </button>
          </div>
        </div>

        {/* Bottom: metadata + episodes (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8">
          <p className="text-sm text-white/80 mb-1">
            {[detail.year && `New ${detail.year}`, 'HD', 'AD'].filter(Boolean).join(' · ')}
          </p>
          {detail.contentRating && (
            <p className="text-sm text-white/70 mb-2">{detail.contentRating}</p>
          )}
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            <div className="flex-1 min-w-0">
              <p className="text-white/90 text-sm leading-relaxed">
                {detail.description ?? 'No description available.'}
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-white/70 md:min-w-[200px] md:max-w-[260px]">
              <div>
                <span className="text-white/50">Cast: </span>
                {detail.cast ?? '—'}
              </div>
              <div>
                <span className="text-white/50">Genres: </span>
                {detail.genres ?? '—'}
              </div>
              {detail.tags && <div>{detail.tags}</div>}
            </div>
          </div>

          {isSeries && (
            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h3 className="text-lg font-semibold text-white">Episodes</h3>
                {seasons.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="season-select" className="text-sm text-white/70">Season</label>
                    <select
                      id="season-select"
                      value={selectedSeasonNum}
                      onChange={(e) => setSelectedSeasonNum(Number(e.target.value))}
                      className="bg-white/10 text-white border border-white/20 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                      {seasons.map((s) => (
                        <option key={s.number} value={s.number}>Season {s.number}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {episodesLoading && (
                <p className="text-white/60 text-sm">Loading episodes…</p>
              )}
              {episodesError && (
                <p className="text-red-400/90 text-sm">{episodesError}</p>
              )}
              {!episodesLoading && !episodesError && episodes.length === 0 && (
                <p className="text-white/60 text-sm">No episodes found for this season.</p>
              )}
              {!episodesLoading && episodes.length > 0 && (
                <ul className="space-y-4">
                  {episodes.map((ep) => (
                    <li
                      key={ep.id ?? `s${ep.seasonNumber}e${ep.episodeNumber}`}
                      className="flex gap-4 rounded-lg bg-white/5 overflow-hidden hover:bg-white/10 transition-colors"
                    >
                      <div className="flex-shrink-0 w-40 aspect-video bg-white/10 flex items-center justify-center overflow-hidden">
                        {ep.posterUrl ? (
                          <img src={ep.posterUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white/50 text-2xl font-bold">{ep.episodeNumber}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 py-3 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium">
                            S{ep.seasonNumber}:E{ep.episodeNumber} – {ep.title}
                          </span>
                          {ep.durationMinutes != null && (
                            <span className="text-white/50 text-sm">{ep.durationMinutes}m</span>
                          )}
                        </div>
                        <p className="text-white/70 text-sm mt-1 line-clamp-2">
                          {ep.description ?? 'No description available.'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center pr-4">
                        <button
                          type="button"
                          onClick={() => {
                            if (ep.hasFile && ep.id && onPlayEpisode) {
                              onPlayEpisode(ep.id, `${detail.title} – S${ep.seasonNumber}:E${ep.episodeNumber} ${ep.title}`, ep.subtitleLanguages);
                            } else if (onPlayUnavailable) {
                              onPlayUnavailable('This episode is not in your library. Add the file and rescan.');
                            }
                          }}
                          className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 transition-colors"
                          aria-label={ep.hasFile ? `Play ${ep.title}` : `${ep.title} (not in library)`}
                        >
                          <PlayArrow sx={{ fontSize: 28 }} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
