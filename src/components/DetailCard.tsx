import { useEffect, useState, useCallback, useRef } from 'react';
import Add from '@mui/icons-material/Add';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import PlayArrow from '@mui/icons-material/PlayArrow';
import ThumbUp from '@mui/icons-material/ThumbUp';
import SubtitlesOutlined from '@mui/icons-material/SubtitlesOutlined';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import type { MovieDetail, SeriesSeason } from '../types/movie';
import { useProgress } from '@/context/ProgressContext';

interface DetailCardProps {
  detail: MovieDetail;
  onClose: () => void;
  /** Called when "Play" is clicked – e.g. open video player. */
  onPlay?: (detail: MovieDetail) => void;
  /** Called when an episode is selected for playback (series only). seriesTitle = show name for TMDB metadata. */
  onPlayEpisode?: (episodeId: string, episodeTitle?: string, subtitleLanguages?: string[], seriesTitle?: string) => void;
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
  const { getProgress } = useProgress();
  const [seasons, setSeasons] = useState<SeriesSeason[]>([]);
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const seasonDropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!seasonDropdownOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (seasonDropdownRef.current && !seasonDropdownRef.current.contains(e.target as Node)) {
        setSeasonDropdownOpen(false);
      }
    };
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, [seasonDropdownOpen]);

  const imageUrl = detail.backdropUrl ?? detail.posterUrl ?? undefined;
  const currentSeason = seasons.find((s) => s.number === selectedSeasonNum);
  const episodes = currentSeason?.episodes ?? [];

  /** Format duration string for display: "145m" -> "2h 25m", "45m" -> "45m", "1h 39m" -> as-is */
  const formatDuration = (d: string | undefined): string | undefined => {
    if (!d?.trim()) return undefined;
    const hm = d.trim().match(/^(\d+)\s*h(?:ours?)?\s*(\d+)\s*m(?:in)?$/i);
    if (hm) return `${hm[1]}h ${hm[2]}m`;
    const minOnly = d.trim().match(/^(\d+)\s*m(?:in)?$/i);
    if (minOnly) {
      const totalM = parseInt(minOnly[1], 10);
      if (totalM >= 60) return `${Math.floor(totalM / 60)}h ${totalM % 60}m`;
      return `${totalM}m`;
    }
    return d;
  };
  const durationDisplay = !isSeries && detail.duration ? formatDuration(detail.duration) : undefined;

  const handleMainPlay = () => {
    if (isSeries && seasons.length > 0 && episodes.length > 0) {
      const first = episodes[0];
      if (first.hasFile && first.id && onPlayEpisode) {
        onPlayEpisode(
          first.id,
          `${detail.title} – S${first.seasonNumber}:E${first.episodeNumber} ${first.title}`,
          first.subtitleLanguages,
          detail.title
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
      className="fixed inset-0 z-50 flex justify-center items-start p-4 pt-8 pb-8 bg-black/80 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${detail.title}`}
    >
      <div
        className="relative flex flex-col w-full max-w-4xl min-w-0 rounded-lg bg-[#181818] shadow-2xl overflow-hidden"
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
          {/* Transition fade at bottom of image into modal content (same as hero banner) */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[40%] pointer-events-none z-[1]"
            style={{
              background: 'linear-gradient(to bottom, transparent 0%, rgba(24,24,24,0.15) 20%, rgba(24,24,24,0.4) 40%, rgba(24,24,24,0.65) 60%, rgba(24,24,24,0.88) 80%, #181818 100%)',
            }}
            aria-hidden
          />
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-white hover:text-black transition-colors duration-200 z-10"
            aria-label="Close"
          >
            <Close sx={{ fontSize: 24 }} />
          </button>
          {/* Title + controls over image */}
          <div className="absolute bottom-8 left-8 flex flex-col gap-4 z-10">
            {detail.titleLogoUrl ? (
              <img
                src={detail.titleLogoUrl}
                alt={detail.title ?? ''}
                className="max-h-14 md:max-h-16 w-auto object-contain object-left drop-shadow-lg"
              />
            ) : (
              <h2 className="text-white text-2xl md:text-3xl font-bold drop-shadow-lg">
                {detail.title}
              </h2>
            )}
            <div className="flex items-center gap-3">
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
          </div>
        </div>

        {/* Bottom: metadata + episodes (single scroll = overlay) */}
        <div className="min-w-0 p-6 md:p-8 pb-20 md:pb-24">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {detail.year && <span className="text-sm text-white/80">{detail.year}</span>}
            {durationDisplay && (
              <span className="text-sm text-white/80">{durationDisplay}</span>
            )}
            {isSeries && seasons.length > 0 && (
              <span className="text-sm text-white/80">{seasons.length} Season{seasons.length !== 1 ? 's' : ''}</span>
            )}
            <span className="inline-flex items-center justify-center rounded border border-white/60 bg-white/10 px-1.5 py-0.5 text-xs font-semibold text-white/90">
              HD
            </span>
            {(detail.hasSubtitles ?? (detail.subtitleLanguages?.length ?? 0) > 0) && (
              <span className="inline-flex items-center justify-center rounded border border-white/60 bg-white/10 p-0.5 text-white/90">
                <SubtitlesOutlined sx={{ fontSize: 18 }} />
              </span>
            )}
          </div>
          {detail.contentRating && (
            <p className="text-sm text-white/70 mb-2">
              <span className="inline-block border border-white/70 rounded px-1.5 py-0.5 text-white/90">{detail.contentRating}</span>
            </p>
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
            </div>
          </div>

          {isSeries && (
            <div className="mt-8 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h3 className="text-lg font-semibold text-white">Episodes</h3>
                {seasons.length > 1 && (
                  <div className="relative w-[220px]" ref={seasonDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setSeasonDropdownOpen((o) => !o)}
                      className={`flex items-center gap-2.5 h-10 w-full bg-[#202020] text-white font-semibold text-base px-4 border border-[#606060] focus:outline-none focus:ring-2 focus:ring-white/50 justify-between ${seasonDropdownOpen ? 'rounded-t' : 'rounded'}`}
                      aria-expanded={seasonDropdownOpen}
                      aria-haspopup="listbox"
                      id="season-select"
                    >
                      <span>Season {selectedSeasonNum}</span>
                      {seasonDropdownOpen ? (
                        <ExpandLess sx={{ fontSize: 20, color: 'white' }} />
                      ) : (
                        <ExpandMore sx={{ fontSize: 20, color: 'white' }} />
                      )}
                    </button>
                    {seasonDropdownOpen && (
                      <ul
                        className="absolute left-0 right-0 top-full z-10 mt-0 rounded-b bg-[#252525] border border-[#606060] border-t-0 max-h-48 overflow-y-auto py-1"
                        role="listbox"
                        aria-labelledby="season-select"
                      >
                        {seasons.map((s) => {
                          const count = s.episodes?.length ?? 0;
                          const label = count > 0 ? `Season ${s.number} (${count} Episode${count !== 1 ? 's' : ''})` : `Season ${s.number}`;
                          const isSelected = s.number === selectedSeasonNum;
                          return (
                            <li
                              key={s.number}
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setSelectedSeasonNum(s.number);
                                setSeasonDropdownOpen(false);
                              }}
                              className={`px-4 py-2.5 text-sm text-white cursor-pointer whitespace-nowrap ${isSelected ? 'bg-[#383838]' : 'hover:bg-[#323232]'}`}
                            >
                              {label}
                            </li>
                          );
                        })}
                      </ul>
                    )}
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
              {!episodesLoading && episodes.length > 0 && (() => {
                const currentEpisodeId = detail.id ? getProgress(detail.id)?.lastEpisodeId : undefined;
                return (
                <ul className="min-w-0">
                  {episodes.map((ep, index) => {
                    const isCurrentEpisode = ep.id != null && ep.id === currentEpisodeId;
                    const isFirstAndNoProgress = index === 0 && !currentEpisodeId;
                    const isHighlighted = isCurrentEpisode || isFirstAndNoProgress;
                    return (
                    <li
                      key={ep.id ?? `s${ep.seasonNumber}e${ep.episodeNumber}`}
                      className={`group flex items-start gap-4 min-w-0 overflow-hidden py-4 cursor-pointer border-b border-white/10 last:border-b-0 ${isHighlighted ? 'bg-[#2e2e2e] rounded-md' : ''}`}
                      onClick={() => {
                        if (ep.hasFile && ep.id && onPlayEpisode) {
                          onPlayEpisode(ep.id, `${detail.title} – S${ep.seasonNumber}:E${ep.episodeNumber} ${ep.title}`, ep.subtitleLanguages, detail.title);
                        } else if (onPlayUnavailable) {
                          onPlayUnavailable('This episode is not in your library. Add the file and rescan.');
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (ep.hasFile && ep.id && onPlayEpisode) {
                            onPlayEpisode(ep.id, `${detail.title} – S${ep.seasonNumber}:E${ep.episodeNumber} ${ep.title}`, ep.subtitleLanguages, detail.title);
                          } else if (onPlayUnavailable) {
                            onPlayUnavailable('This episode is not in your library. Add the file and rescan.');
                          }
                        }
                      }}
                      aria-label={ep.hasFile ? `Play ${ep.title}` : `${ep.title} (not in library)`}
                    >
                      <div className="flex-shrink-0 w-10 flex items-center justify-center self-stretch">
                        <span className={`text-2xl font-bold tabular-nums ${isHighlighted ? 'text-white' : 'text-white/70'}`}>{ep.episodeNumber}</span>
                      </div>
                      <div className="relative flex-shrink-0 w-40 aspect-video bg-white/10 flex items-center justify-center overflow-hidden rounded pointer-events-none">
                        {ep.posterUrl ? (
                          <img src={ep.posterUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className={`text-2xl font-bold ${isHighlighted ? 'text-white' : 'text-white/50'}`}>{ep.episodeNumber}</span>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <span className="w-14 h-14 rounded-full border-2 border-white flex items-center justify-center bg-black/40">
                            <PlayArrow sx={{ fontSize: 32, color: 'white' }} />
                          </span>
                        </div>
                        {ep.id != null && (() => {
                          const p = Math.min(1, getProgress(ep.id)?.progress ?? 0);
                          if (p <= 0) return null;
                          return (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 pointer-events-none">
                              <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${p * 100}%` }} />
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden py-3 pr-4">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className={`truncate ${isHighlighted ? 'text-white font-semibold' : 'text-white/80 font-normal'}`}>
                            Episode {ep.episodeNumber} – {ep.title}
                          </span>
                          {ep.durationMinutes != null && (
                            <span className={`text-sm shrink-0 ${isHighlighted ? 'text-white font-semibold' : 'text-white/50'}`}>{ep.durationMinutes}m</span>
                          )}
                        </div>
                        <p className={`text-sm mt-1 line-clamp-2 break-words ${isHighlighted ? 'text-white' : 'text-white/70'}`}>
                          {ep.description ?? 'No description available.'}
                        </p>
                      </div>
                    </li>
                  );
                  })}
                </ul>
              );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
