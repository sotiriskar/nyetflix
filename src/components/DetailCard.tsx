import { useEffect, useState, useRef } from 'react';
import Box from '@mui/material/Box';
import Add from '@mui/icons-material/Add';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import PlayArrow from '@mui/icons-material/PlayArrow';
import ThumbUp from '@mui/icons-material/ThumbUp';
import VolumeOff from '@mui/icons-material/VolumeOff';
import VolumeUp from '@mui/icons-material/VolumeUp';
import SubtitlesOutlined from '@mui/icons-material/SubtitlesOutlined';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import type { CarouselItem, MovieDetail, SeriesSeason, SeriesEpisode } from '../types/movie';
import { getContentRatingDescriptors, getContentRatingRecommendation } from '@/lib/contentRating';
import { truncateToWords } from '@/lib/description';
import { useProgress } from '@/context/ProgressContext';
import { useTrailerMute } from '@/context/TrailerMuteContext';
import { useTrailerResume } from '@/context/TrailerResumeContext';

const DETAIL_TRAILER_PLAYER_ID = 'detail-modal-trailer';
const YT_PLAYER_ENDED = 0;

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
  /** Up to 6 items for "More Like This" (exclude current). Shown after episodes for series. */
  moreLikeThisItems?: CarouselItem[];
  /** Resolve detail for a "More Like This" item (duration, description, etc.). */
  getDetailForId?: (id: string) => MovieDetail | undefined;
  /** When user clicks a "More Like This" card – play that item (e.g. close modal and start playback). */
  onMoreLikeThisPlay?: (item: CarouselItem) => void;
  /** When user clicks Add to list on a "More Like This" card. */
  onMoreLikeThisAddClick?: (item: CarouselItem) => void;
  /** Whether a given item id is in My List (for More Like This card state). */
  getIsInList?: (id: string) => boolean;
}

interface YTPlayer {
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
}

export function DetailCard({ detail, onClose, onPlay, onPlayEpisode, onPlayUnavailable, onAddClick, isInList = false, onLikeClick, isLiked = false, moreLikeThisItems, getDetailForId, onMoreLikeThisPlay, onMoreLikeThisAddClick, getIsInList }: DetailCardProps) {
  const { getProgress } = useProgress();
  const { isMuted, setMuted } = useTrailerMute();
  const { getAndClearResume } = useTrailerResume();
  const [seasons, setSeasons] = useState<SeriesSeason[]>([]);
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const seasonDropdownRef = useRef<HTMLDivElement>(null);

  const [trailerEnded, setTrailerEnded] = useState(false);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const ytApiReadyRef = useRef(false);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const isSeries = detail.mediaType === 'series';
  const trailerId = detail.trailerYouTubeId ?? undefined;
  const showTrailer = Boolean(trailerId && !trailerEnded);

  // Fetch episodes only when series id changes. Don't depend on detail object identity or detail.title
  // so parent re-renders (e.g. progress updates) don't re-run this and cause loading flicker.
  useEffect(() => {
    if (!isSeries || !detail.id) return;
    const title = detail.title ?? '';
    setEpisodesLoading(true);
    setEpisodesError(null);
    fetch(`/api/series-episodes?id=${encodeURIComponent(detail.id)}&title=${encodeURIComponent(title)}`)
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
    setTrailerEnded(false);
    return () => {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
    };
  }, [detail.id, trailerId]);

  useEffect(() => {
    if (!trailerId || typeof document === 'undefined') return;
    const initYt = () => {
      const w = window as Window & { YT?: { Player: new (el: string | HTMLElement, opts: Record<string, unknown>) => YTPlayer } };
      if (!w.YT?.Player) return;
      const el = document.getElementById(DETAIL_TRAILER_PLAYER_ID);
      if (!el) return;
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
      const Player = w.YT.Player;
      const player = new Player(el, {
        videoId: trailerId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          loop: 0,
          rel: 0,
          modestbranding: 1,
          disablekb: 1,
          fs: 0,
          start: 8,
        },
        events: {
          onStateChange: (e: { data: number }) => {
            if (e.data === YT_PLAYER_ENDED) setTrailerEnded(true);
          },
          onReady: () => {
            const p = ytPlayerRef.current as (YTPlayer & { unMute?: () => void; seekTo?: (s: number) => void }) | null;
            if (p?.unMute && !isMutedRef.current) p.unMute();
            const resume = getAndClearResume();
            if (resume && resume.videoId === trailerId && resume.currentTime > 0 && p?.seekTo) {
              p.seekTo(resume.currentTime);
            }
          },
        },
      }) as YTPlayer & { getPlayerState?: () => number };
      ytPlayerRef.current = player;
    };
    if (ytApiReadyRef.current) {
      initYt();
      return;
    }
    const win = window as Window & { YT?: { Player: new (el: string | HTMLElement, opts: Record<string, unknown>) => YTPlayer } };
    if (win.YT?.Player) {
      ytApiReadyRef.current = true;
      initYt();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript?.parentNode?.insertBefore(tag, firstScript);
    (window as Window & { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = () => {
      ytApiReadyRef.current = true;
      initYt();
    };
    return () => {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
    };
  }, [trailerId, getAndClearResume]);

  useEffect(() => {
    const p = ytPlayerRef.current as (YTPlayer & { mute?: () => void; unMute?: () => void }) | null;
    if (!p?.mute || !p?.unMute) return;
    if (isMuted) p.mute();
    else p.unMute();
  }, [isMuted]);

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
      const prog = getProgress(detail.id ?? '');
      const resumeEpisodeId = prog?.lastEpisodeId;
      let targetEp: SeriesEpisode | undefined;
      if (resumeEpisodeId) {
        for (const s of seasons) {
          const ep = s.episodes?.find((e) => e.id === resumeEpisodeId);
          if (ep && ep.hasFile !== false) {
            targetEp = ep;
            break;
          }
        }
      }
      const ep = targetEp ?? episodes[0];
      if (ep.hasFile && ep.id && onPlayEpisode) {
        onPlayEpisode(
          ep.id,
          `${detail.title} – S${ep.seasonNumber}:E${ep.episodeNumber} ${ep.title}`,
          ep.subtitleLanguages,
          detail.title
        );
      } else if (!ep.hasFile && onPlayUnavailable) {
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
        className="relative flex flex-col w-full max-w-4xl min-w-0 rounded-md bg-[#181818] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top: trailer (when available and not ended) or image / backdrop */}
        <div className="relative flex-shrink-0 aspect-video w-full bg-white/5 border-0 outline-none" style={{ border: 'none', outline: 'none' }}>
          {showTrailer ? (
            <div className="absolute inset-0 w-full h-full overflow-hidden">
              <div
                id={DETAIL_TRAILER_PLAYER_ID}
                className="absolute inset-0 w-full h-full origin-center"
                style={{ transform: 'scale(1.5)' }}
              />
              <div className="absolute inset-0 w-full h-full z-[2] pointer-events-auto" aria-hidden />
            </div>
          ) : imageUrl ? (
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
          {/* Transition fade at bottom – extend 4px past container to hide seam under content */}
          <div
            className="absolute left-0 right-0 pointer-events-none z-[1]"
            style={{
              bottom: -4,
              height: 'calc(40% + 4px)',
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
          {/* Title + controls bottom-left; mute bottom-right (same margin), row a bit higher */}
          <div className="absolute bottom-14 left-6 right-6 md:left-8 md:right-8 flex justify-between items-end gap-4 z-10">
            <div className="flex flex-col gap-4 min-w-0">
              {detail.titleLogoUrl ? (
                <img
                  src={detail.titleLogoUrl}
                  alt={detail.title ?? ''}
                  className="max-h-20 md:max-h-20 w-auto object-contain object-left drop-shadow-lg [filter:drop-shadow(0_0_8px_rgba(255,255,255,0.4))_drop-shadow(0_2px_6px_rgba(0,0,0,0.5))]"
                />
              ) : (
                <h2 className="text-white text-lg md:text-xl font-bold drop-shadow-lg">
                  {detail.title}
                </h2>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleMainPlay}
                  className="flex items-center justify-center gap-3 rounded-md px-8 py-3 bg-white text-black text-lg font-semibold hover:bg-white/90 transition-colors shrink-0"
                  aria-label="Play"
                >
                  <PlayArrow sx={{ fontSize: 32, color: 'black' }} />
                  <span>Play</span>
                </button>
                <button
                  type="button"
                  onClick={onAddClick}
                  className={`w-13 h-13 rounded-full border-2 flex bg-black/20 items-center justify-center transition-colors shrink-0 ${
                    isInList ? 'border-white bg-white text-black' : 'border-white/70 text-white hover:bg-white/20'
                  }`}
                  aria-label={isInList ? 'In My List' : 'Add to My List'}
                >
                  {isInList ? <Check sx={{ fontSize: 30 }} /> : <Add sx={{ fontSize: 26 }} />}
                </button>
                <button
                  type="button"
                  onClick={onLikeClick}
                  className={`w-13 h-13 rounded-full border-2 bg-black/20 flex items-center justify-center transition-colors shrink-0 ${
                    isLiked ? 'border-white bg-white text-black' : 'border-white/70 text-white hover:bg-white/20'
                  }`}
                  aria-label={isLiked ? 'Liked' : 'Like'}
                >
                  <ThumbUp sx={{ fontSize: 24 }} />
                </button>
              </div>
            </div>
            <button
              type="button"
              className="w-13 h-13 rounded-full border-2 border-white/30 hover:border-white/80 bg-black/20 text-white/30 hover:text-white/80 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0 self-end"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              onClick={(e) => { e.stopPropagation(); setMuted(!isMuted); }}
            >
              {isMuted ? <VolumeOff sx={{ fontSize: 24 }} /> : <VolumeUp sx={{ fontSize: 24 }} />}
            </button>
          </div>
        </div>

        {/* Bottom: metadata + episodes – overlap video area to hide boundary line */}
        <div className="relative z-[2] -mt-6 pt-6 min-w-0 mx-4 p-6 md:p-8 pb-8 md:pb-10 bg-[#181818]">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'flex-start',
              gap: 3,
            }}
          >
            {/* Left column: meta, rating, description */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                {detail.year && <span className="text-base text-white/80">{detail.year}</span>}
                {durationDisplay && <span className="text-base text-white/80">{durationDisplay}</span>}
                {isSeries && seasons.length > 0 && (
                  <span className="text-base text-white/80">{seasons.length} Season{seasons.length !== 1 ? 's' : ''}</span>
                )}
                <span className="inline-flex items-center justify-center rounded border border-white/50 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/80">HD</span>
                {(detail.hasSubtitles ?? (detail.subtitleLanguages?.length ?? 0) > 0) && (
                  <span className="inline-flex items-center text-white/80"><SubtitlesOutlined sx={{ fontSize: 22 }} /></span>
                )}
              </Box>
              {detail.contentRating && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                  <span className="inline-block border border-white/70 rounded px-1.5 py-0.5 text-white/90">{detail.contentRating}</span>
                  {getContentRatingDescriptors(detail.contentRating) && (
                    <span className="text-white/90">{getContentRatingDescriptors(detail.contentRating)}</span>
                  )}
                </Box>
              )}
              <Box component="p" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem', lineHeight: 1.6, m: 0, mt: 2.2 }}>
                {truncateToWords(detail.description ?? 'No description available.', 50)}
              </Box>
            </Box>
            {/* Right column: cast, genres – aligned to top, text flows left */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flexShrink: 0, minWidth: { sm: 200 }, maxWidth: { sm: 280 } }}>
              <div>
                <span className="text-sm text-white/35">Cast: </span>
                <span className="text-sm font-medium text-white/90">{detail.cast ?? '—'}</span>
              </div>
              <div>
                <span className="text-sm text-white/35">Genres: </span>
                <span className="text-sm font-medium text-white/90">{detail.genres ?? '—'}</span>
              </div>
            </Box>
          </Box>

          {isSeries && (
            <div className="mt-8 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h3 className="text-2xl font-semibold text-white">Episodes</h3>
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
                          <span className="w-13 h-13 rounded-full border-2 border-white flex items-center justify-center bg-black/40">
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

          {moreLikeThisItems && moreLikeThisItems.length > 0 && (
            <div className="mt-10 pt-8">
              <h3 className="text-2xl font-semibold text-white mb-4">More Like This</h3>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 2,
                  maxWidth: 960,
                  alignItems: 'stretch',
                }}
              >
                {moreLikeThisItems.slice(0, 6).map((item) => {
                  const d = getDetailForId?.(item.id);
                  const isItemSeries = d?.mediaType === 'series';
                  const meta = isItemSeries && d?.seasonsCount != null
                    ? `${d.seasonsCount} Season${d.seasonsCount !== 1 ? 's' : ''}`
                    : d?.duration ?? d?.year ?? '';
                  const itemInList = getIsInList?.(item.id) ?? false;
                  return (
                    <div key={item.id} className="rounded-lg overflow-hidden bg-[#2F2F2F] flex flex-col h-full">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onMoreLikeThisPlay?.(item)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMoreLikeThisPlay?.(item); } }}
                        className="w-full text-left flex flex-col flex-1 min-w-0 cursor-pointer group"
                      >
                        <div className="relative aspect-video w-full bg-white/10 rounded-t-lg overflow-hidden flex-shrink-0">
                          <img
                            src={item.backdropUrl ?? item.posterUrl ?? ''}
                            alt=""
                            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                          />
                          {/* Triangle shade gradient in top-right corner (right angle at corner) */}
                          <div
                            className=" rounded-tr-lg absolute top-0 right-0 w-[130px] h-[130px] pointer-events-none"
                            style={{
                              background: 'linear-gradient(to bottom left, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.12) 22%, rgba(0,0,0,0) 40%)',
                              clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
                            }}
                            aria-hidden
                          />
                          {meta && (
                            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-white text-xs font-medium z-[1]">
                              {meta}
                            </span>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="w-13 h-13 rounded-full border-2 border-white flex items-center justify-center bg-black/50">
                              <PlayArrow sx={{ fontSize: 28, color: 'white' }} />
                            </span>
                          </div>
                        </div>
                        <div className="px-2.5 pt-2 flex flex-wrap items-center justify-between gap-1.5 text-xs text-white/80">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {d?.contentRating && (
                              <span className="inline-block border border-white/60 rounded px-1 py-0.5 text-white/90">{d.contentRating}</span>
                            )}
                            <span className="inline-flex rounded border border-white/50 bg-white/5 px-1 py-0.5 font-medium text-white/80">HD</span>
                            {d?.year && <span>{d.year}</span>}
                          </div>
                          {onMoreLikeThisAddClick && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMoreLikeThisAddClick(item); }}
                              title="Add to my list"
                              className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                                itemInList ? 'border-white bg-white text-black' : 'border-white/70 text-white hover:bg-white/20'
                              }`}
                              aria-label={itemInList ? 'In My List' : 'Add to my list'}
                            >
                              {itemInList ? <Check sx={{ fontSize: 22 }} /> : <Add sx={{ fontSize: 22 }} />}
                            </button>
                          )}
                        </div>
                        <p className="px-2.5 pb-14 pt-1.5 text-sm text-white/90 line-clamp-4 leading-snug">{truncateToWords(d?.description ?? item.title ?? '', 25)}</p>
                      </div>
                    </div>
                  );
                })}
              </Box>
            </div>
          )}
        {/* Horizontal rule between episodes and about */}
        <hr className="mt-25 border-t-2 border-white/20" aria-hidden />

          {/* About <title> */}
          <section className="mt-5 pt-8">
            <h3 className="text-2xl font-semibold text-white mb-4">About {detail.title ?? 'this title'}</h3>
            <div className="flex flex-col gap-3 text-sm">
              {detail.director && (
                <div>
                  <span className="font-base text-white/50">Director: </span>
                  <span className="font-medium text-white/95">{detail.director}</span>
                </div>
              )}
              {detail.cast && (
                <div>
                  <span className="font-base text-white/50">Cast: </span>
                  <span className="font-medium text-white/95">{detail.cast}</span>
                </div>
              )}
              {detail.writer && (
                <div>
                  <span className="font-base text-white/50">Writer: </span>
                  <span className="font-medium text-white/95">{detail.writer}</span>
                </div>
              )}
              {detail.genres && (
                <div>
                  <span className="font-base text-white/50">Genres: </span>
                  <span className="font-medium text-white/95">{detail.genres}</span>
                </div>
              )}
              {detail.contentRating && (
                <div>
                  <span className="font-base text-white/50">Age rating: </span>
                  <span className="inline-block border border-white/60 rounded px-1.5 py-0.5 text-white/95 font-medium align-middle mr-1.5">{detail.contentRating}</span>
                  {getContentRatingDescriptors(detail.contentRating) && (
                    <span className="text-white/90">{getContentRatingDescriptors(detail.contentRating)}</span>
                  )}
                  {getContentRatingRecommendation(detail.contentRating) && (
                    <span className="text-white/70"> {getContentRatingRecommendation(detail.contentRating)}</span>
                  )}
                </div>
              )}
              {!detail.director && !detail.cast && !detail.writer && !detail.genres && !detail.contentRating && (
                <p className="font-base text-white/50">No additional details available.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
