import { describe, expect, it } from 'vitest';
import { buildLayout, pinnedHeader, revealTop, step, visibleRange } from '../src/lib/window';

// Two sections: A has rows 0-2, B has rows 3-4.
// Tops: hA 0 | r0 20 | r1 45 | r2 70 | hB 95 | r3 115 | r4 140 | total 165
const sectioned = () => buildLayout(5, [{ letter: 'A', start: 0 }, { letter: 'B', start: 3 }]);

describe('buildLayout', () => {
  it('places headers and rows', () => {
    const L = sectioned();
    expect(L.tops).toEqual([0, 20, 45, 70, 95, 115, 140]);
    expect(L.total).toBe(165);
    expect(L.rowEntry).toEqual([1, 2, 3, 5, 6]);
    expect(L.headerEntries).toEqual([0, 4]);
  });
  it('lays out a flat list with no headers', () => {
    const L = buildLayout(3, null);
    expect(L.tops).toEqual([0, 25, 50]);
    expect(L.total).toBe(75);
    expect(L.headerEntries).toEqual([]);
  });
  it('handles an empty list', () => {
    const L = buildLayout(0, []);
    expect(L.total).toBe(0);
    expect(visibleRange(L, 0, 500)).toEqual([0, -1]);
  });
});

describe('visibleRange', () => {
  it('covers the viewport plus overscan, clamped to the list', () => {
    const L = sectioned();
    expect(visibleRange(L, 0, 50, 0)).toEqual([0, 2]); // y 50 falls inside r1 (45-70)
    expect(visibleRange(L, 100, 30, 0)).toEqual([4, 5]);
    expect(visibleRange(L, 100, 30, 8)).toEqual([0, 6]);
  });
  it('stays fast and correct on a long list', () => {
    const L = buildLayout(70000, null);
    expect(visibleRange(L, 25 * 50000, 500, 0)).toEqual([50000, 50020]);
  });
});

describe('pinnedHeader', () => {
  it('pins the current letter and lets the next one push it up', () => {
    const L = sectioned();
    expect(pinnedHeader(L, 0)).toBeNull();
    expect(pinnedHeader(L, 30)).toEqual({ letter: 'A', offset: 0 });
    expect(pinnedHeader(L, 85)).toEqual({ letter: 'A', offset: -10 });
    expect(pinnedHeader(L, 95)).toEqual({ letter: 'B', offset: 0 });
  });
  it('is null for a flat list', () => {
    expect(pinnedHeader(buildLayout(10, null), 100)).toBeNull();
  });
});

describe('revealTop', () => {
  it('scrolls as little as possible, allowing for the pinned header', () => {
    const L = sectioned();
    expect(revealTop(L, 0, 0, 100)).toBeNull(); // visible
    expect(revealTop(L, 4, 0, 100)).toBe(65); // below: bottom 165 - 100
    expect(revealTop(L, 1, 60, 100)).toBe(25); // above: 45 - 20 header
    expect(revealTop(L, 9, 0, 100)).toBeNull(); // no such row
  });
  it('needs no header allowance in a flat list', () => {
    expect(revealTop(buildLayout(10, null), 2, 100, 50)).toBe(50);
  });
});

describe('step', () => {
  it('moves and clamps', () => {
    expect(step(5, 2, 'ArrowDown')).toBe(3);
    expect(step(5, 4, 'ArrowDown')).toBe(4);
    expect(step(5, 0, 'ArrowUp')).toBe(0);
    expect(step(5, 2, 'Home')).toBe(0);
    expect(step(5, 2, 'End')).toBe(4);
    expect(step(50, 5, 'PageDown', 20)).toBe(25);
    expect(step(50, 5, 'PageUp', 20)).toBe(0);
  });
  it('starts at the top or bottom when nothing is selected', () => {
    expect(step(5, null, 'ArrowDown')).toBe(0);
    expect(step(5, null, 'ArrowUp')).toBe(4);
    expect(step(5, 99, 'Home')).toBe(0);
  });
  it('returns null for an empty list', () => {
    expect(step(0, null, 'ArrowDown')).toBeNull();
  });
});
