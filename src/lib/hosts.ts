// Which Host headers the app answers. The app has no login, so it must not
// answer requests addressed to some other name that happens to point at this
// machine: that is how DNS rebinding lets a website read a localhost app.
//
// Allowed by default: localhost, 127.0.0.1 and ::1. Add the names you use to
// reach it (a Tailscale address, a hostname behind Caddy) to
// CONTACTS_ALLOWED_HOSTS, comma-separated; "*" turns the check off.

const LOCAL = new Set(['localhost', '127.0.0.1', '::1']);

export function hostName(hostHeader: string): string {
  const h = hostHeader.trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(1, h.indexOf(']') === -1 ? undefined : h.indexOf(']'));
  const colon = h.lastIndexOf(':');
  return colon > -1 && h.indexOf(':') === colon ? h.slice(0, colon) : h;
}

export function allowedHosts(env: string | undefined): Set<string> | 'any' {
  const extra = (env ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (extra.includes('*')) return 'any';
  return new Set([...LOCAL, ...extra.map(hostName)]);
}

export function isAllowedHost(hostHeader: string | null, env: string | undefined): boolean {
  const allowed = allowedHosts(env);
  if (allowed === 'any') return true;
  if (!hostHeader) return false;
  const name = hostName(hostHeader);
  return allowed.has(name) || name.endsWith('.localhost');
}
