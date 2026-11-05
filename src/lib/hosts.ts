// Which Host headers the app answers. The app has no login, so it must not
// answer requests addressed to some other name that happens to point at this
// machine: that is how DNS rebinding lets a website read a localhost app.
//
// Allowed by default: localhost, 127.0.0.1, ::1 and names under .localhost
// (browsers send those to this machine without asking DNS). Add the names you
// use to reach it (a Tailscale address, a hostname behind Caddy) to
// CONTACTS_ALLOWED_HOSTS, comma-separated; "*" turns the check off.

const LOCAL = new Set(['localhost', '127.0.0.1', '::1']);

/** The name in a Host header, without the port; null when the header isn't a plain host[:port]. */
export function hostName(hostHeader: string): string | null {
  const h = hostHeader.trim().toLowerCase();
  const m = h.match(/^\[([0-9a-f:.]+)\](?::\d{1,5})?$/) ?? h.match(/^([a-z0-9_-]+(?:\.[a-z0-9_-]+)*)(?::\d{1,5})?$/);
  return m ? m[1] : null;
}

export function allowedHosts(env: string | undefined): Set<string> | 'any' {
  const extra = (env ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (extra.includes('*')) return 'any';
  // In the setting an IPv6 address may be written without brackets.
  const names = extra.map((s) => hostName(s) ?? (/^[0-9a-f:.]+$/.test(s) ? s : null)).filter((s): s is string => !!s);
  return new Set([...LOCAL, ...names]);
}

export function isAllowedHost(hostHeader: string | null, env: string | undefined): boolean {
  const allowed = allowedHosts(env);
  if (allowed === 'any') return true;
  const name = hostHeader ? hostName(hostHeader) : null;
  if (!name) return false;
  return allowed.has(name) || name.endsWith('.localhost');
}

type HeaderSource = { get(name: string): string | null };

/**
 * Whether a write (a POST from a form, an action or the import page) comes from
 * this app's own pages. Browsers send Origin with every write, so it must name
 * the host the request was sent to. A request with no Origin at all comes from
 * a script on this machine, unless the browser marks it as sent by another site.
 * X-Forwarded-Host counts only when a proxy in front sets it to an allowed name.
 */
export function isWriteFromApp(headers: HeaderSource, env: string | undefined): boolean {
  const origin = headers.get('origin');
  if (origin === null) {
    const site = headers.get('sec-fetch-site');
    return site === null || site === 'same-origin' || site === 'none';
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false; // "null" and other opaque origins
  }
  const host = headers.get('host')?.trim().toLowerCase();
  if (host && originHost === host) return true;
  const forwarded = headers.get('x-forwarded-host')?.trim().toLowerCase();
  return !!forwarded && originHost === forwarded && isAllowedHost(forwarded, env);
}
