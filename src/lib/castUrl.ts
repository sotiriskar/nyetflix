/**
 * Google Cast makes the TV fetch the media URL itself, so anything we hand the player
 * has to be reachable from the network — never a loopback address.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

const PROBE_TIMEOUT_MS = 1500;

let lanOriginPromise: Promise<string | null> | null = null;

export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

async function probe(origin: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${origin}/api/lan-address`, { signal: controller.signal, cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The server's LAN origin, verified by request so we never pick a dead adapter
 * (VPN, VM bridge) over the one the Cast device shares with us.
 */
export async function getLanOrigin(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!isLoopbackHost(window.location.hostname)) return window.location.origin;
  lanOriginPromise ??= (async () => {
    try {
      const res = await fetch('/api/lan-address', { cache: 'no-store' });
      const data: { origins?: string[] } = res.ok ? await res.json() : {};
      for (const origin of data.origins ?? []) {
        if (await probe(origin)) return origin;
      }
    } catch {
      // No LAN address available; caller falls back to the page origin.
    }
    return null;
  })();
  return lanOriginPromise;
}

/** Swaps a loopback URL onto the LAN origin. Returns the URL untouched when that isn't possible. */
export function toLanUrl(url: string, lanOrigin: string | null): string {
  if (!url || !lanOrigin) return url;
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : undefined;
    const parsed = new URL(url, base);
    if (!isLoopbackHost(parsed.hostname)) return url;
    const lan = new URL(lanOrigin);
    parsed.protocol = lan.protocol;
    parsed.hostname = lan.hostname;
    parsed.port = lan.port;
    return parsed.toString();
  } catch {
    return url;
  }
}
