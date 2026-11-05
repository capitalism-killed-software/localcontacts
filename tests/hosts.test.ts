import { describe, expect, it } from 'vitest';
import { safeHref } from '../src/components/CardView';
import { allowedHosts, hostName, isAllowedHost, isReadFromApp, isWriteFromApp } from '../src/lib/hosts';

describe('hostName', () => {
  it('drops the port and handles IPv6', () => {
    expect(hostName('localhost:3000')).toBe('localhost');
    expect(hostName('Contacts.Example.com')).toBe('contacts.example.com');
    expect(hostName('[::1]:3000')).toBe('::1');
    expect(hostName('100.64.1.2:3000')).toBe('100.64.1.2');
  });
  it('refuses anything that is not a plain host and port', () => {
    for (const h of ['localhost:abc', 'localhost:3177@evil.example', '::1', 'localhost/x', 'local host', '', '[::1', 'localhost:']) {
      expect(hostName(h), h).toBeNull();
      expect(isAllowedHost(h, undefined), h).toBe(false);
    }
  });
});

describe('isAllowedHost', () => {
  it('answers localhost names by default and nothing else', () => {
    for (const h of ['localhost:3000', '127.0.0.1:3000', '[::1]:3000', 'localhost', 'app.localhost:3000']) {
      expect(isAllowedHost(h, undefined), h).toBe(true);
    }
    for (const h of ['evil.example', 'evil.example:3000', '192.168.1.5:3000', 'localhost.evil.example', null]) {
      expect(isAllowedHost(h, undefined), String(h)).toBe(false);
    }
  });
  it('adds the names listed in CONTACTS_ALLOWED_HOSTS', () => {
    const env = ' contacts.example.com , 100.64.1.2:3000 ';
    expect(isAllowedHost('contacts.example.com', env)).toBe(true);
    expect(isAllowedHost('100.64.1.2:3000', env)).toBe(true);
    expect(isAllowedHost('other.example.com', env)).toBe(false);
    expect(isAllowedHost('[fe80::1]:3000', 'fe80::1')).toBe(true);
  });
  it('"*" turns the check off', () => {
    expect(allowedHosts('*')).toBe('any');
    expect(isAllowedHost('anything.example', '*')).toBe(true);
  });
});

describe('isWriteFromApp', () => {
  const from = (h: Record<string, string>, env?: string) => isWriteFromApp(new Headers(h), env);

  it('accepts the app’s own pages and scripts on this machine', () => {
    expect(from({ host: 'localhost:3000', origin: 'http://localhost:3000' })).toBe(true);
    expect(from({ host: 'localhost:3000' })).toBe(true); // curl, the CLI's friends
    expect(from({ host: 'localhost:3000', 'sec-fetch-site': 'same-origin' })).toBe(true);
  });

  it('refuses other sites however the request is dressed up', () => {
    expect(from({ host: 'localhost:3000', origin: 'http://evil.example' })).toBe(false);
    expect(from({ host: 'localhost:3000', origin: 'null' })).toBe(false);
    expect(from({ host: 'localhost:3000', origin: 'http://localhost:9999' })).toBe(false);
    expect(from({ host: 'localhost:3000', 'sec-fetch-site': 'cross-site' })).toBe(false);
    expect(from({ host: 'localhost:3000', 'sec-fetch-site': 'same-site' })).toBe(false);
    expect(from({ host: 'localhost:3000', origin: 'http://evil.example', 'x-forwarded-host': 'evil.example' })).toBe(false);
  });

  it('trusts a forwarded host only when it is an allowed name', () => {
    const proxied = { host: '127.0.0.1:3000', origin: 'https://contacts.example.com', 'x-forwarded-host': 'contacts.example.com' };
    expect(from(proxied, 'contacts.example.com')).toBe(true);
    expect(from(proxied)).toBe(false);
  });
});

describe('safeHref', () => {
  it('links web, mail and phone addresses and nothing else', () => {
    expect(safeHref('https://example.com/a')).toBe('https://example.com/a');
    expect(safeHref('example.com/ada')).toBe('https://example.com/ada');
    expect(safeHref('mailto:ada@example.com')).toBe('mailto:ada@example.com');
    expect(safeHref('tel:+12025550101')).toBe('tel:+12025550101');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref(' JavaScript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,<script>')).toBeNull();
    expect(safeHref('file:///etc/passwd')).toBeNull();
    expect(safeHref('not a link')).toBeNull();
  });
});

describe('isReadFromApp', () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it('accepts the app’s own pages, a typed address and scripts; refuses other sites, other local apps too', () => {
    expect(isReadFromApp(h({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isReadFromApp(h({ 'sec-fetch-site': 'none' }))).toBe(true);
    expect(isReadFromApp(h({}))).toBe(true);
    expect(isReadFromApp(h({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(isReadFromApp(h({ 'sec-fetch-site': 'same-site' }))).toBe(false);
  });
});

