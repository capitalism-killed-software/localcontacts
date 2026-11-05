import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';
import nextConfig from '../next.config.mjs';

const send = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  proxy(new NextRequest(`http://localhost:3000${path}`, { method: init.method ?? 'GET', headers: { host: 'localhost:3000', ...init.headers } }));
const passes = (res: Response) => res.headers.get('x-middleware-next') === '1';

describe('proxy', () => {
  it('refuses hosts it does not know with 421', () => {
    expect(send('/', { headers: { host: 'evil.example' } }).status).toBe(421);
    expect(send('/', { headers: { host: 'localhost:3000@evil.example' } }).status).toBe(421);
    expect(passes(send('/'))).toBe(true);
  });

  it('refuses writes from other sites before any page, action or route runs', () => {
    const action = { 'next-action': 'abc123', 'content-type': 'text/plain;charset=UTF-8' };
    expect(send('/', { method: 'POST', headers: { ...action, origin: 'http://evil.example' } }).status).toBe(403);
    expect(send('/', { method: 'POST', headers: { ...action, 'sec-fetch-site': 'cross-site' } }).status).toBe(403);
    expect(send('/', { method: 'POST', headers: { ...action, origin: 'http://evil.example', 'x-forwarded-host': 'evil.example' } }).status).toBe(403);
    expect(send('/api/import', { method: 'POST', headers: { origin: 'null' } }).status).toBe(403);
    expect(passes(send('/', { method: 'POST', headers: { ...action, origin: 'http://localhost:3000' } }))).toBe(true);
  });

  it('refuses an import over the limit before reading its body', async () => {
    const res = send('/api/import', { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-length': String(2 * 1024 ** 3) } });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'The files add up to more than 100 MB.' });
    expect(passes(send('/api/import', { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-length': '5000' } }))).toBe(true);
  });
});

describe('frame protection', () => {
  it('tells browsers not to show any page inside another site', async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === '/:path*')!;
    expect(all.headers).toEqual(expect.arrayContaining([
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    ]));
  });
});
