import { describe, expect, it } from '@jest/globals';

import { resolveSwipeDirection } from '../directions';
import { getSwipeWindow } from '../windowing';

describe('getSwipeWindow', () => {
  it('returns no descriptors for empty data', () => {
    expect(getSwipeWindow(0, 0)).toEqual([]);
  });

  it('renders only current for one item', () => {
    expect(getSwipeWindow(1, 0)).toEqual([{ index: 0, role: 'current', isActive: true }]);
  });

  it('renders current and next for the first item', () => {
    expect(getSwipeWindow(2, 0)).toEqual([
      { index: 0, role: 'current', isActive: true },
      { index: 1, role: 'next', isActive: false },
    ]);
  });

  it('renders previous and current for the last item', () => {
    expect(getSwipeWindow(2, 1)).toEqual([
      { index: 0, role: 'previous', isActive: false },
      { index: 1, role: 'current', isActive: true },
    ]);
  });

  it('renders previous, current, and next for a middle item in large data', () => {
    const descriptors = getSwipeWindow(150, 75);

    expect(descriptors).toEqual([
      { index: 74, role: 'previous', isActive: false },
      { index: 75, role: 'current', isActive: true },
      { index: 76, role: 'next', isActive: false },
    ]);
    expect(descriptors).toHaveLength(3);
  });

  it('clamps negative active indexes to the first item', () => {
    expect(getSwipeWindow(3, -1)).toEqual([
      { index: 0, role: 'current', isActive: true },
      { index: 1, role: 'next', isActive: false },
    ]);
  });

  it('returns no descriptors for completed indexes', () => {
    expect(getSwipeWindow(3, 3)).toEqual([]);
    expect(getSwipeWindow(3, 4)).toEqual([]);
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
