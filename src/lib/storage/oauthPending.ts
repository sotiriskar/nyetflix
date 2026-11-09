/**
 * Sign-ins in progress. `state` (random, from the authorize URL) identifies one: the callback
 * fills in the tokens, and the source form picks them up by `state` when it saves. Nothing here
 * is ever sent to the browser except the account name and the status.
 */

import type { CloudProvider, OAuthTokens } from './types';

export interface PendingSignIn {
  provider: CloudProvider;
  profileId: number;
  verifier: string;
  redirectUri: string;
  createdAt: number;
  status: 'pending' | 'done' | 'error';
  tokens?: OAuthTokens;
  account?: string;
  error?: string;
}

const TTL_MS = 15 * 60 * 1000;
const key = Symbol.for('nyetflix-oauth-pending');

export function pendingSignIns(): Map<string, PendingSignIn> {
  const g = globalThis as unknown as Record<symbol, Map<string, PendingSignIn>>;
  if (!g[key]) g[key] = new Map();
  const map = g[key];
  const now = Date.now();
  for (const [state, p] of map) if (now - p.createdAt > TTL_MS) map.delete(state);
  return map;
}

/** Tokens of a finished sign-in, if it belongs to this profile and provider. Leaves it in place. */
export function peekSignIn(
  state: string,
  profileId: number,
  provider: CloudProvider,
): { tokens: OAuthTokens; account: string } | undefined {
  const p = pendingSignIns().get(state);
  if (!p || p.status !== 'done' || p.profileId !== profileId || p.provider !== provider) return undefined;
  return p.tokens && p.account ? { tokens: p.tokens, account: p.account } : undefined;
}

export function discardSignIn(state: string): void {
  pendingSignIns().delete(state);
}
