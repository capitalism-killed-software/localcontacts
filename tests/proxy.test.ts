import { describe, expect, it, vi } from 'vitest';
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

  it('refuses reads of the API from other sites', () => {
    for (const path of ['/api/export?format=csv', '/api/vcard/1', '/api/contacts', '/api/photo/1']) {
      expect(send(path, { headers: { 'sec-fetch-site': 'cross-site' } }).status, path).toBe(403);
      expect(send(path, { headers: { 'sec-fetch-site': 'same-site' } }).status, path).toBe(403);
      expect(passes(send(path, { headers: { 'sec-fetch-site': 'same-origin' } })), path).toBe(true);
    }
    // Pages may still be opened from a link on another site.
    expect(passes(send('/', { headers: { 'sec-fetch-site': 'cross-site' } }))).toBe(true);
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
    expect(rules.find((r) => r.source === '/:path*')!.headers).toContainEqual({ key: 'X-Frame-Options', value: 'DENY' });
    const csp = { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" };
    expect(rules.find((r) => r.source === '/')!.headers).toContainEqual(csp);
    // Every other path except the photo route, which keeps its own stricter policy.
    const rest = rules.find((r) => r.source.includes('api/photo'))!;
    expect(rest.headers).toContainEqual(csp);
    const re = new RegExp(`^/${rest.source.match(/\((\(\?!.*\)\.\+)\)$/)![1]}$`);
    expect(re.test('/api/contacts')).toBe(true);
    expect(re.test('/api/photo/12')).toBe(false);
  });
});

describe('content policy', () => {
  it('lets a production page connect only to itself and GitHub (for the update check)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const rules = await nextConfig.headers!();
      const csp = rules.find((r) => r.source === '/')!.headers.find((h) => h.key === 'Content-Security-Policy')!.value;
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("connect-src 'self' https://api.github.com");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('leaves connections alone while developing (live reload needs its own)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    try {
      const rules = await nextConfig.headers!();
      const csp = rules.find((r) => r.source === '/')!.headers.find((h) => h.key === 'Content-Security-Policy')!.value;
      expect(csp).toBe("frame-ancestors 'none'");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

