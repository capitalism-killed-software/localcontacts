// The update check on the About sheet. It runs in the browser, only when the
// button is pressed, and asks GitHub one thing: the latest release of this
// project. Nothing about the book goes with it.

export const RELEASES_API = 'https://api.github.com/repos/capitalism-killed-software/localcontacts/releases/latest';
export const RELEASES_PAGE = 'https://github.com/capitalism-killed-software/localcontacts/releases';

const parse = (v: string): { nums: number[]; pre: string | null } | null => {
  const m = v.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  return m ? { nums: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? null } : null;
};

/** Whether `latest` is a later release than `current` (1.10.0 > 1.9.0; 1.1.0 > 1.1.0-rc.1). */
export function isNewer(latest: string, current: string): boolean {
  const a = parse(latest);
  const b = parse(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a.nums[i] !== b.nums[i]) return a.nums[i] > b.nums[i];
  if (a.pre === b.pre) return false;
  if (a.pre === null) return true; // the final release after its pre-release
  if (b.pre === null) return false;
  return a.pre.localeCompare(b.pre, 'en', { numeric: true }) > 0;
}
