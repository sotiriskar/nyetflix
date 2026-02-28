import { describe, it, expect } from 'vitest';
import { isWideFriendly, trailerScore, buildStillUrl } from './tmdb';
import type { TmdbVideoResult } from './tmdb';

describe('isWideFriendly', () => {
  it('rejects mobile/vertical indicators', () => {
    expect(isWideFriendly({ name: 'Mobile Trailer' })).toBe(false);
    expect(isWideFriendly({ name: 'Vertical Teaser' })).toBe(false);
    expect(isWideFriendly({ name: 'Instagram clip' })).toBe(false);
    expect(isWideFriendly({ name: 'TikTok reel' })).toBe(false);
    expect(isWideFriendly({ name: '9:16 version' })).toBe(false);
  });

  it('accepts normal trailer names', () => {
    expect(isWideFriendly({ name: 'Official Trailer' })).toBe(true);
    expect(isWideFriendly({ name: 'Teaser' })).toBe(true);
    expect(isWideFriendly({ name: '' })).toBe(true);
  });
});

describe('trailerScore', () => {
  it('prefers higher size (1080 > 720 > 480)', () => {
    const trailer = (size: number): TmdbVideoResult => ({ type: 'Trailer', size, key: 'x', site: 'YouTube' });
    expect(trailerScore(trailer(1080))).toBeGreaterThan(trailerScore(trailer(720)));
    expect(trailerScore(trailer(720))).toBeGreaterThan(trailerScore(trailer(480)));
    expect(trailerScore(trailer(480))).toBeGreaterThan(trailerScore(trailer(0)));
  });

  it('prefers Trailer > Teaser > Clip when size equal', () => {
    const base: TmdbVideoResult = { type: 'Trailer', size: 720, key: 'x', site: 'YouTube' };
    expect(trailerScore({ ...base, type: 'Trailer' })).toBeGreaterThan(trailerScore({ ...base, type: 'Teaser' }));
    expect(trailerScore({ ...base, type: 'Teaser' })).toBeGreaterThan(trailerScore({ ...base, type: 'Clip' }));
  });

  it('adds bonus for official/theatrical in name', () => {
    const v: TmdbVideoResult = { type: 'Trailer', size: 720, key: 'x', site: 'YouTube' };
    expect(trailerScore({ ...v, name: 'Official Trailer' })).toBeGreaterThan(trailerScore({ ...v, name: 'Trailer' }));
  });
});

describe('buildStillUrl', () => {
  it('returns null for empty path', () => {
    expect(buildStillUrl(null)).toBe(null);
    expect(buildStillUrl(undefined)).toBe(null);
    expect(buildStillUrl('')).toBe(null);
  });

  it('builds TMDB still URL', () => {
    expect(buildStillUrl('/abc123')).toContain('image.tmdb.org');
    expect(buildStillUrl('/abc123')).toContain('w300');
  });
});
