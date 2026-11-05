#!/usr/bin/env node
// Starts the production server (`npm start`). It listens on this machine only
// (127.0.0.1) unless CONTACTS_LISTEN names another address, for example a
// Tailscale IP or 0.0.0.0 inside a container. The app has no login, so listening
// on every network address would let anyone on the same network open the book.
// PORT works as usual (default 3000); an explicit -H/--hostname wins.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const DEFAULT_LISTEN = '127.0.0.1';

/** Arguments for `next`: `start`, the caller's own arguments, then the address. */
export function startArgs(args = [], env = process.env) {
  const given = args.some((a) => a === '-H' || a === '--hostname' || a.startsWith('--hostname='));
  if (given) return ['start', ...args];
  return ['start', ...args, '-H', env.CONTACTS_LISTEN?.trim() || DEFAULT_LISTEN];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const next = createRequire(import.meta.url).resolve('next/dist/bin/next');
  process.argv = [process.argv[0], next, ...startArgs(process.argv.slice(2))];
  await import(pathToFileURL(next).href);
}
