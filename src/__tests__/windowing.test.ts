import { describe, expect, it } from '@jest/globals';

import { resolveSwipeDirection } from '../core/directions';
import { getSwipeWindow, normalizeVisibleCardCount } from '../core/windowing';

describe('getSwipeWindow', () => {
  it('returns no descriptors for empty data', () => {
    expect(getSwipeWindow(0, 0)).toEqual([]);
  });

  it('renders only current for one item', () => {
    expect(getSwipeWindow(1, 0)).toEqual([
      { index: 0, offset: 0, role: 'current', isActive: true },
    ]);
  });

  it('renders current and next for the first item', () => {
    expect(getSwipeWindow(2, 0)).toEqual([
      { index: 0, offset: 0, role: 'current', isActive: true },
      { index: 1, offset: 1, role: 'next', isActive: false },
    ]);
  });

  it('renders only current for the last item', () => {
    expect(getSwipeWindow(2, 1)).toEqual([
      { index: 1, offset: 0, role: 'current', isActive: true },
    ]);
  });

  it('renders the default current-plus-two-next window for a middle item in large data', () => {
    const descriptors = getSwipeWindow(150, 75);

    expect(descriptors).toEqual([
      { index: 75, offset: 0, role: 'current', isActive: true },
      { index: 76, offset: 1, role: 'next', isActive: false },
      { index: 77, offset: 2, role: 'next', isActive: false },
    ]);
    expect(descriptors).toHaveLength(3);
  });

  it('clamps negative active indexes to the first item', () => {
    expect(getSwipeWindow(3, -1)).toEqual([
      { index: 0, offset: 0, role: 'current', isActive: true },
      { index: 1, offset: 1, role: 'next', isActive: false },
      { index: 2, offset: 2, role: 'next', isActive: false },
    ]);
  });

  it('keeps the configured visible card count within the remaining data length', () => {
    expect(getSwipeWindow(5, 0, 2)).toHaveLength(2);
    expect(getSwipeWindow(5, 2, 3)).toHaveLength(3);
    expect(getSwipeWindow(9, 4, 5)).toHaveLength(5);
    expect(getSwipeWindow(10, 4, 20)).toHaveLength(6);
    expect(getSwipeWindow(10, 4, 10)).toHaveLength(6);
  });

  it('uses exact even visible counts without rendering dismissed previous cards', () => {
    const descriptors = getSwipeWindow(10, 4, 10);

    expect(descriptors).toHaveLength(6);
    expect(descriptors.map((descriptor) => descriptor.offset)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('does not backfill dismissed previous cards at the edges', () => {
    expect(getSwipeWindow(10, 0, 5).map((descriptor) => descriptor.index)).toEqual([0, 1, 2, 3, 4]);
    expect(getSwipeWindow(10, 9, 5).map((descriptor) => descriptor.index)).toEqual([9]);
  });

  it('returns no descriptors for completed indexes', () => {
    expect(getSwipeWindow(3, 3)).toEqual([]);
    expect(getSwipeWindow(3, 4)).toEqual([]);
  });
});

describe('normalizeVisibleCardCount', () => {
  it('defaults to three cards and clamps to the two-card minimum', () => {
    expect(normalizeVisibleCardCount()).toBe(3);
    expect(normalizeVisibleCardCount(1)).toBe(2);
    expect(normalizeVisibleCardCount(2)).toBe(2);
  });

  it('keeps larger finite integer budgets', () => {
    expect(normalizeVisibleCardCount(10)).toBe(10);
    expect(normalizeVisibleCardCount(10.8)).toBe(10);
  });
});

describe('resolveSwipeDirection', () => {
  it('cancels when below translation and velocity thresholds', () => {
    expect(resolveSwipeDirection({ translationX: 20, velocityX: 100 })).toBeNull();
  });

  it('resolves by translation threshold', () => {
    expect(resolveSwipeDirection({ translationX: 121, velocityX: 0 })).toBe('right');
    expect(resolveSwipeDirection({ translationX: -121, velocityX: 0 })).toBe('left');
  });

  it('resolves by velocity threshold', () => {
    expect(resolveSwipeDirection({ translationX: 20, velocityX: 801 })).toBe('right');
    expect(resolveSwipeDirection({ translationX: -20, velocityX: -801 })).toBe('left');
  });

  it('cancels when disabled', () => {
    expect(resolveSwipeDirection({ translationX: 200, velocityX: 900, disabled: true })).toBeNull();
  });
});
