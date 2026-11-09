/**
 * "Sign in with Google / Microsoft / Dropbox" — OAuth 2.0 authorization code flow with PKCE.
 *
 * Only used when an app registration is set up in .env.local (see clientId below). The
 * redirect goes back to http://localhost:<port>/api/oauth/callback, so sign-in happens in a
 * browser on the computer running Nyetflix; watching works from anywhere afterwards.
 */

import { createHash, randomBytes } from 'crypto';
import type { CloudProvider, CloudSourceConfig, OAuthTokens } from './types';
import { pendingSignIns } from './oauthPending';
import { updateSourceTokens } from './sources';

interface ProviderDef {
  label: string;
  clientIdEnv: string;
  clientSecretEnv?: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  extraAuthParams: Record<string, string>;
  /** Email / name of the signed-in account. */
  account(accessToken: string): Promise<string>;
}

async function json(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text.slice(0, 300) };
  }
}

export const PROVIDERS: Record<CloudProvider, ProviderDef> = {
  google: {
    label: 'Google Drive',
    clientIdEnv: 'NYETFLIX_GOOGLE_CLIENT_ID',
    clientSecretEnv: 'NYETFLIX_GOOGLE_CLIENT_SECRET',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    // `prompt=consent` makes Google return a refresh token every time, not only the first.
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    async account(token) {
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = (await json(res)) as { user?: { emailAddress?: string; displayName?: string } };
      return d.user?.emailAddress || d.user?.displayName || 'Google account';
    },
  },
  microsoft: {
    label: 'OneDrive',
    clientIdEnv: 'NYETFLIX_MICROSOFT_CLIENT_ID',
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'offline_access Files.Read User.Read',
    extraAuthParams: { response_mode: 'query', prompt: 'select_account' },
    async account(token) {
      const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = (await json(res)) as { mail?: string; userPrincipalName?: string; displayName?: string };
      return d.mail || d.userPrincipalName || d.displayName || 'Microsoft account';
    },
  },
  dropbox: {
    label: 'Dropbox',
    clientIdEnv: 'NYETFLIX_DROPBOX_APP_KEY',
    authorizeUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scope: '',
    extraAuthParams: { token_access_type: 'offline' },
    async account(token) {
      const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: 'null',
      });
      const d = (await json(res)) as { email?: string; name?: { display_name?: string } };
      return d.email || d.name?.display_name || 'Dropbox account';
    },
  },
};

/**
 * Optional: someone who registers their own app with a provider puts its ID (and Google's
 * secret) in .env.local, and Nyetflix then signs in to that provider directly. Without it,
 * Google Drive / OneDrive / Dropbox use the provider's desktop app folder instead.
 */
function clientId(provider: CloudProvider): string | undefined {
  return process.env[PROVIDERS[provider].clientIdEnv]?.trim() || undefined;
}

function clientSecret(provider: CloudProvider): string | undefined {
  const env = PROVIDERS[provider].clientSecretEnv;
  return (env && process.env[env]?.trim()) || undefined;
}

export function isProviderConfigured(provider: CloudProvider): boolean {
  return !!clientId(provider);
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Starts a sign-in: returns the provider URL to send the browser to, and its `state`. */
export function beginSignIn(provider: CloudProvider, profileId: number, port: string): { url: string; state: string } {
  const id = clientId(provider);
  if (!id) throw new Error(`${PROVIDERS[provider].label} needs an app registration in .env.local.`);
  const state = base64url(randomBytes(24));
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  // Registered redirect URIs use `localhost`; all three providers accept loopback redirects.
  const redirectUri = `http://localhost${port ? `:${port}` : ''}/api/oauth/callback`;
  pendingSignIns().set(state, {
    provider,
    profileId,
    verifier,
    redirectUri,
    createdAt: Date.now(),
    status: 'pending',
  });
  const def = PROVIDERS[provider];
  const params = new URLSearchParams({
    client_id: id,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...def.extraAuthParams,
  });
  if (def.scope) params.set('scope', def.scope);
  return { url: `${def.authorizeUrl}?${params}`, state };
}

function tokensFrom(d: Record<string, unknown>, previousRefresh?: string): OAuthTokens {
  const accessToken = typeof d.access_token === 'string' ? d.access_token : '';
  // Dropbox and Google keep the old refresh token on refresh; Microsoft rotates it.
  const refreshToken = typeof d.refresh_token === 'string' ? d.refresh_token : previousRefresh ?? '';
  const expiresIn = typeof d.expires_in === 'number' ? d.expires_in : Number(d.expires_in) || 3600;
  if (!accessToken) throw new Error(String(d.error_description ?? d.error ?? 'No access token returned'));
  if (!refreshToken) throw new Error('The provider did not return a refresh token');
  return { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 };
}

async function tokenRequest(provider: CloudProvider, body: Record<string, string>): Promise<Record<string, unknown>> {
  const id = clientId(provider);
  if (!id) throw new Error(`${PROVIDERS[provider].label} needs an app registration in .env.local.`);
  const params = new URLSearchParams({ client_id: id, ...body });
  const secret = clientSecret(provider);
  if (secret) params.set('client_secret', secret);
  if (provider === 'microsoft') params.set('scope', PROVIDERS.microsoft.scope);
  const res = await fetch(PROVIDERS[provider].tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const d = await json(res);
  if (!res.ok) {
    const err = new Error(String(d.error_description ?? d.error ?? `HTTP ${res.status}`)) as Error & { code?: string };
    err.code = typeof d.error === 'string' ? d.error : undefined;
    throw err;
  }
  return d;
}

/** Called by /api/oauth/callback: trades the code for tokens and records the account. */
export async function completeSignIn(state: string, code: string | null, error: string | null): Promise<void> {
  const p = pendingSignIns().get(state);
  if (!p) throw new Error('This sign-in expired. Close this window and click Sign in again.');
  if (error || !code) {
    p.status = 'error';
    p.error = error === 'access_denied' ? 'Sign-in was cancelled.' : error || 'No authorization code returned';
    return;
  }
  try {
    const tokens = tokensFrom(
      await tokenRequest(p.provider, {
        grant_type: 'authorization_code',
        code,
        redirect_uri: p.redirectUri,
        code_verifier: p.verifier,
      }),
    );
    p.account = await PROVIDERS[p.provider].account(tokens.accessToken);
    p.tokens = tokens;
    p.status = 'done';
  } catch (e) {
    p.status = 'error';
    p.error = e instanceof Error ? e.message : String(e);
  }
}

// ---------------------------------------------------------------------------------------------
// Access tokens for a connected source
// ---------------------------------------------------------------------------------------------

const refreshing = new Map<string, Promise<OAuthTokens>>();

async function refresh(cfg: CloudSourceConfig): Promise<OAuthTokens> {
  let inFlight = refreshing.get(cfg.id);
  if (!inFlight) {
    inFlight = tokenRequest(cfg.provider, { grant_type: 'refresh_token', refresh_token: cfg.tokens.refreshToken })
      .then((d) => tokensFrom(d, cfg.tokens.refreshToken))
      .catch((e: Error & { code?: string }) => {
        if (e.code === 'invalid_grant') {
          throw new Error(`The ${PROVIDERS[cfg.provider].label} sign-in expired or was revoked. Edit the source and sign in again.`);
        }
        throw e;
      })
      .finally(() => refreshing.delete(cfg.id));
    refreshing.set(cfg.id, inFlight);
  }
  const tokens = await inFlight;
  cfg.tokens = tokens;
  updateSourceTokens(cfg.id, tokens);
  return tokens;
}

/**
 * fetch() with the source's access token, refreshing it when it is about to expire and once
 * more if the provider still answers 401.
 */
export async function cloudFetch(cfg: CloudSourceConfig, url: string, init: RequestInit = {}): Promise<Response> {
  if (cfg.tokens.expiresAt - 60_000 < Date.now()) await refresh(cfg);
  const send = () =>
    fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${cfg.tokens.accessToken}` } });
  let res = await send();
  if (res.status === 401) {
    await refresh(cfg);
    res = await send();
  }
  return res;
}
