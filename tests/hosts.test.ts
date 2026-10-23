import { describe, expect, it } from 'vitest';
import { safeHref } from '../src/components/CardView';
import { allowedHosts, hostName, isAllowedHost } from '../src/lib/hosts';

describe('hostName', () => {
  it('drops the port and handles IPv6', () => {
    expect(hostName('localhost:3000')).toBe('localhost');
    expect(hostName('Contacts.Example.com')).toBe('contacts.example.com');
    expect(hostName('[::1]:3000')).toBe('::1');
    expect(hostName('100.64.1.2:3000')).toBe('100.64.1.2');
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
  });
  it('"*" turns the check off', () => {
    expect(allowedHosts('*')).toBe('any');
    expect(isAllowedHost('anything.example', '*')).toBe(true);
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
