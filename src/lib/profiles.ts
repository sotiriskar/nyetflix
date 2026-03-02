/** Avatar paths under /static. User can replace these files. */
export const AVATAR_PATHS = [
  '/static/avatar_1.png',
  '/static/avatar_2.jpg',
  '/static/avatar_3.jpg',
  '/static/avatar_4.jpg',
  '/static/avatar_5.jpg',
] as const;

/** Returns the first avatar not used by any of the given profiles. */
export function getFirstUnusedAvatar(usedPaths: string[]): string {
  const used = new Set(usedPaths);
  return AVATAR_PATHS.find((p) => !used.has(p)) ?? AVATAR_PATHS[0];
}

export const MAX_PROFILES = 5;

export type ProfileId = 1 | 2 | 3 | 4 | 5;

export function isProfileId(n: number): n is ProfileId {
  return n >= 1 && n <= MAX_PROFILES;
}
