import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// The container image workflow publishes only from a release tag, and never
// without first checking that the image starts.
describe('the image workflow', () => {
  const yml = readFileSync('.github/workflows/image.yml', 'utf8');

  it('publishes only for a release tag', () => {
    expect(yml).toMatch(/RELEASE: \$\{\{ startsWith\(github\.ref, 'refs\/tags\/v'\) \}\}/);
    expect(yml).toMatch(/push: \$\{\{ env\.RELEASE == 'true' \}\}/);
    expect(yml.match(/push: true/g)).toBeNull();
    expect(yml).toMatch(/if: env\.RELEASE == 'true'\n\s+uses: docker\/login-action/);
  });

  it('checks the image answers before building for both architectures', () => {
    const check = yml.indexOf('Your address book is empty');
    const multi = yml.indexOf('linux/amd64,linux/arm64');
    expect(check).toBeGreaterThan(0);
    expect(multi).toBeGreaterThan(check);
  });

  it('names the image after this repository, which compose uses', () => {
    expect(yml).toContain('IMAGE: ghcr.io/capitalism-killed-software/localcontacts');
    expect(readFileSync('docker-compose.yml', 'utf8')).toMatch(/image: ghcr\.io\/capitalism-killed-software\/localcontacts:1\b/);
  });
});
