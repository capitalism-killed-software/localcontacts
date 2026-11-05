import { describe, expect, it } from 'vitest';
import { isNewer, RELEASES_API } from '../src/lib/version';

describe('isNewer', () => {
  it('compares release numbers, with or without a v', () => {
    expect(isNewer('v1.1.0', '1.0.0')).toBe(true);
    expect(isNewer('1.0.1', '1.0.0')).toBe(true);
    expect(isNewer('2.0.0', '1.9.9')).toBe(true);
    expect(isNewer('1.10.0', '1.9.0')).toBe(true);
    expect(isNewer('v1.0.0', '1.0.0')).toBe(false);
    expect(isNewer('1.0.0', '1.1.0')).toBe(false);
  });
  it('counts a final release as newer than its pre-release, and never trusts junk', () => {
    expect(isNewer('1.1.0', '1.1.0-rc.1')).toBe(true);
    expect(isNewer('1.1.0-rc.1', '1.1.0')).toBe(false);
    expect(isNewer('nonsense', '1.0.0')).toBe(false);
    expect(isNewer('', '1.0.0')).toBe(false);
  });
  it('asks this project on GitHub, nobody else', () => {
    expect(RELEASES_API).toBe('https://api.github.com/repos/capitalism-killed-software/localcontacts/releases/latest');
  });
});
