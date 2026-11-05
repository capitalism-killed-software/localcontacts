import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

// public/sw.js only passes the app's own requests through, so a request to any
// other site is left to the browser, where the page's content policy applies.
describe('the service worker', () => {
  const listeners = new Map<string, (e: unknown) => void>();
  const self = { location: { origin: 'http://localhost:3000' }, addEventListener: (t: string, f: (e: unknown) => void) => listeners.set(t, f) };
  runInNewContext(readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf-8'), { self, fetch: () => Promise.resolve('ok'), URL });
  const fetchEvent = (url: string) => {
    let answered = false;
    listeners.get('fetch')!({ request: { url }, respondWith: () => (answered = true) });
    return answered;
  };

  it('passes the app’s own requests through and leaves other sites alone', () => {
    expect(fetchEvent('http://localhost:3000/api/contacts')).toBe(true);
    expect(fetchEvent('https://api.github.com/repos/x/y/releases/latest')).toBe(false);
    expect(fetchEvent('https://example.com/')).toBe(false);
  });
});
