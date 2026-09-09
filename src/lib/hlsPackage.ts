/**
 * Packages a multi-audio MKV as HLS so every audio track stays selectable in the browser.
 *
 * A plain MP4 can hold several audio tracks, but Chrome refuses to switch between them
 * (`HTMLMediaElement.audioTracks` is behind a flag), so a converted file would silently
 * play only its first track. HLS solves it: the video and each audio track become separate
 * renditions, and hls.js — which the player already uses for HLS sources — exposes them as
 * an audio menu.
 *
 * Layout next to the original file:
 *
 *   Movie.m3u8                 marker/master playlist; the library scanner treats this as the title
 *   Movie.hlsdata/master.hlsp  playlist ffmpeg wrote (kept for reference)
 *   Movie.hlsdata/p0.hlsp      video rendition playlist
 *   Movie.hlsdata/p0.m4s       video: one file, segments addressed by byte range
 *   Movie.hlsdata/p1.hlsp      first audio rendition, p2 the second, and so on
 *   Movie.hlsdata/info.json    duration and track labels
 *
 * `single_file` keeps this to a handful of files instead of thousands of segments, and the
 * fMP4 init segment lives inside each rendition's own file.
 */

import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { canCopyAudioCodec, type StreamInfo } from './ffprobeStreams';
import { audioStreamLabel, dedupeLabels } from './subtitleTrackKeys';
import { HLS_MARKER_EXT } from './videoMime';

const DATA_DIR_SUFFIX = '.hlsdata';
/** Rendition playlists deliberately avoid .m3u8 so the library scanner ignores them. */
const PLAYLIST_EXT = '.hlsp';
const MASTER_NAME = `master${PLAYLIST_EXT}`;
const INFO_NAME = 'info.json';
const TARGET_SEGMENT_SECONDS = 6;
const AUDIO_BITRATE = '192k';

export interface HlsAudioTrackInfo {
  label: string;
  lang: string;
  /** True when the stream was copied rather than re-encoded to stereo AAC. */
  copied: boolean;
}

export interface HlsPackageInfo {
  version: 1;
  durationSeconds: number;
  audio: HlsAudioTrackInfo[];
}

export function isHlsMarkerPath(path: string): boolean {
  return path.toLowerCase().endsWith(HLS_MARKER_EXT);
}

/** `C:\Movies\Movie.mkv` → `C:\Movies\Movie.m3u8` */
export function markerPathFor(sourcePath: string, baseName: string): string {
  return join(dirname(sourcePath), baseName + HLS_MARKER_EXT);
}

/** `C:\Movies\Movie.m3u8` → `C:\Movies\Movie.hlsdata` */
export function dataDirFor(markerPath: string): string {
  const base = basename(markerPath).replace(/\.m3u8$/i, '');
  return join(dirname(markerPath), base + DATA_DIR_SUFFIX);
}

export function readHlsInfo(markerPath: string): HlsPackageInfo | null {
  try {
    const raw = readFileSync(join(dataDirFor(markerPath), INFO_NAME), 'utf-8');
    const parsed = JSON.parse(raw) as HlsPackageInfo;
    return parsed && typeof parsed.durationSeconds === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

/** Duration recorded when the package was built, so nothing has to demux the playlist. */
export function getHlsDurationSeconds(markerPath: string): number | null {
  const info = readHlsInfo(markerPath);
  return info && info.durationSeconds > 0 ? info.durationSeconds : null;
}

export interface HlsBuildPlan {
  /** Complete ffmpeg argument list. */
  args: string[];
  dataDir: string;
  markerPath: string;
  audio: HlsAudioTrackInfo[];
}

/**
 * Builds the ffmpeg command for the package: video copied as-is, each audio stream copied
 * when it is already AAC and re-encoded to stereo AAC otherwise (browsers can't decode
 * DTS/TrueHD, and a 5.1 downmix keeps dialogue audible on laptop speakers).
 */
export function planHlsPackage(
  sourcePath: string,
  baseName: string,
  audioStreams: StreamInfo[],
  options?: { reencodeVideo?: boolean },
): HlsBuildPlan {
  const markerPath = markerPathFor(sourcePath, baseName);
  const dataDir = dataDirFor(markerPath);

  const labels = dedupeLabels(audioStreams.map((stream) => audioStreamLabel(stream)));
  const audio: HlsAudioTrackInfo[] = audioStreams.map((stream, i) => ({
    label: labels[i]!,
    lang: stream.lang,
    copied: canCopyAudioCodec(stream.codec),
  }));

  const mapArgs = ['-map', '0:v:0'];
  const codecArgs: string[] = options?.reencodeVideo
    ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p']
    : ['-c:v', 'copy'];
  audioStreams.forEach((stream, i) => {
    mapArgs.push('-map', `0:${stream.index}`);
    if (canCopyAudioCodec(stream.codec)) {
      codecArgs.push(`-c:a:${i}`, 'copy');
    } else {
      codecArgs.push(`-c:a:${i}`, 'aac', `-b:a:${i}`, AUDIO_BITRATE, `-ac:a:${i}`, '2');
    }
    codecArgs.push(`-metadata:s:a:${i}`, `language=${stream.lang}`);
    codecArgs.push(`-metadata:s:a:${i}`, `title=${audio[i]!.label}`);
  });

  // "v:0,agroup:aud" is the video rendition; each audio rendition joins the same group so
  // players offer them as alternatives to one video stream.
  const streamMap = [
    'v:0,agroup:aud',
    ...audioStreams.map(
      (stream, i) => `a:${i},agroup:aud,language:${stream.lang}${i === 0 ? ',default:yes' : ''}`,
    ),
  ].join(' ');

  const args = [
    '-nostdin',
    '-i',
    sourcePath,
    ...mapArgs,
    ...codecArgs,
    '-sn',
    '-dn',
    '-map_chapters',
    '-1',
    '-stats_period',
    '1',
    '-f',
    'hls',
    '-hls_time',
    String(TARGET_SEGMENT_SECONDS),
    '-hls_playlist_type',
    'vod',
    '-hls_segment_type',
    'fmp4',
    '-hls_flags',
    'single_file+independent_segments',
    '-hls_segment_filename',
    join(dataDir, `p%v.m4s`),
    '-master_pl_name',
    MASTER_NAME,
    '-var_stream_map',
    streamMap,
    '-y',
    join(dataDir, `p%v${PLAYLIST_EXT}`),
  ];

  return { args, dataDir, markerPath, audio };
}

export async function prepareHlsDataDir(dataDir: string): Promise<void> {
  await rm(dataDir, { recursive: true, force: true }).catch(() => {});
  await mkdir(dataDir, { recursive: true });
}

export async function removeHlsPackage(markerPath: string): Promise<void> {
  await rm(dataDirFor(markerPath), { recursive: true, force: true }).catch(() => {});
  await rm(markerPath, { force: true }).catch(() => {});
}

/** Rewrites a URI in ffmpeg's master playlist to point inside the data folder. */
function withDataDirPrefix(uri: string, dataDirName: string): string {
  return `${dataDirName}/${uri}`;
}

/**
 * Writes the marker playlist: ffmpeg's master with rendition URIs pointed into the data
 * folder and the auto-generated NAME attributes ("audio_1") replaced by real labels, which
 * is what the player shows in its audio menu.
 */
export async function writeHlsMarker(plan: HlsBuildPlan): Promise<void> {
  const master = await readFile(join(plan.dataDir, MASTER_NAME), 'utf-8');
  const dataDirName = basename(plan.dataDir);
  const lines = master.replace(/\r\n/g, '\n').split('\n');
  let audioIndex = 0;

  const rewritten = lines.map((line) => {
    if (line.startsWith('#EXT-X-MEDIA:')) {
      const label = plan.audio[audioIndex]?.label;
      audioIndex += 1;
      let out = line.replace(/URI="([^"]+)"/, (_m, uri: string) => `URI="${withDataDirPrefix(uri, dataDirName)}"`);
      if (label) {
        const escaped = label.replace(/"/g, '');
        out = /NAME="[^"]*"/.test(out)
          ? out.replace(/NAME="[^"]*"/, `NAME="${escaped}"`)
          : out.replace('#EXT-X-MEDIA:', `#EXT-X-MEDIA:NAME="${escaped}",`);
      }
      return out;
    }
    if (!line.startsWith('#') && line.trim() !== '') {
      return withDataDirPrefix(line.trim(), dataDirName);
    }
    return line;
  });

  await writeFile(plan.markerPath, rewritten.join('\n'), 'utf-8');
}

export async function writeHlsInfo(plan: HlsBuildPlan, durationSeconds: number): Promise<void> {
  const info: HlsPackageInfo = { version: 1, durationSeconds, audio: plan.audio };
  await writeFile(join(plan.dataDir, INFO_NAME), JSON.stringify(info), 'utf-8');
}

/** True when the package has everything playback needs. */
export function isHlsPackageComplete(markerPath: string): boolean {
  if (!existsSync(markerPath)) return false;
  const dataDir = dataDirFor(markerPath);
  return existsSync(join(dataDir, MASTER_NAME)) && existsSync(join(dataDir, `p0${PLAYLIST_EXT}`));
}
