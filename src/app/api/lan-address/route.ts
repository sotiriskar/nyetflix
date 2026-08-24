import { NextRequest, NextResponse } from 'next/server';
import { networkInterfaces } from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Adapters for VMs, containers and VPNs: reachable from this machine but not from a Cast device. */
const VIRTUAL_ADAPTER = /(vethernet|virtualbox|vmware|hyper-?v|loopback|tailscale|zerotier|docker|wsl|tap|tun|utun)/i;

/** Private ranges first: a Cast device sits on the same LAN as the server. */
function rank(address: string): number {
  if (/^192\.168\./.test(address)) return 0;
  if (/^10\./.test(address)) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return 2;
  return 3;
}

function getLanAddresses(): string[] {
  const found: string[] = [];
  for (const [name, nets] of Object.entries(networkInterfaces())) {
    if (VIRTUAL_ADAPTER.test(name)) continue;
    for (const net of nets ?? []) {
      const isIPv4 = net.family === 'IPv4' || (net.family as unknown as number) === 4;
      if (!isIPv4 || net.internal) continue;
      if (net.address.startsWith('169.254.')) continue;
      found.push(net.address);
    }
  }
  return [...new Set(found)].sort((a, b) => rank(a) - rank(b));
}

/** Origins this server can be reached at from other devices on the network, best guess first. */
export async function GET(request: NextRequest) {
  const port = request.nextUrl.port;
  const suffix = port ? `:${port}` : '';
  const origins = getLanAddresses().map((address) => `http://${address}${suffix}`);
  return NextResponse.json({ origins }, { headers: { 'Cache-Control': 'no-store' } });
}
