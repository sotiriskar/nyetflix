import { describe, it, expect } from 'vitest';
import { titleFromPath } from './titleFromPath';

describe('titleFromPath', () => {
  it('strips extension', () => {
    expect(titleFromPath('Movie.Title.2024.mkv')).toBe('Movie Title 2024');
    expect(titleFromPath('Show S01E01.mp4')).toBe('Show S01E01');
  });

  it('strips year in parentheses', () => {
    expect(titleFromPath('Dune (2021)')).toBe('Dune');
    expect(titleFromPath('Dune.2021.1080p')).toBe('Dune');
  });

  it('strips resolution and codec', () => {
    expect(titleFromPath('Film 1080p x264')).toBe('Film');
    expect(titleFromPath('Film.720p.hevc')).toBe('Film');
  });

  it('normalizes separators', () => {
    expect(titleFromPath('The.Movie_Name')).toBe('The Movie Name');
    expect(titleFromPath('Show--S01E01')).toBe('Show S01E01');
  });

  it('returns original name when nothing to strip', () => {
    expect(titleFromPath('Short')).toBe('Short');
  });
});
