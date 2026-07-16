import { describe, expect, it } from '@jest/globals';

import {
  createSwipeDeckDirectionPolicy,
  hasAllowedSwipeDirection,
  resolveAllowedSwipeDirection,
  resolveSwipeDirection,
} from '../core/directions';
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
    expect(getSwipeWindow(5, 0, 1)).toHaveLength(1);
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
  it('defaults to three cards and clamps to the one-card minimum', () => {
    expect(normalizeVisibleCardCount()).toBe(3);
    expect(normalizeVisibleCardCount(0)).toBe(1);
    expect(normalizeVisibleCardCount(1)).toBe(1);
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

  it('keeps upward gestures disabled unless up is explicitly allowed', () => {
    expect(
      resolveSwipeDirection({
        translationX: 0,
        translationY: -120,
        velocityX: 0,
        velocityY: 0,
        directionPolicy: createSwipeDeckDirectionPolicy(),
      }),
    ).toBeNull();
  });

  it('resolves upward distance and velocity inclusively in free drag mode', () => {
    const directionPolicy = createSwipeDeckDirectionPolicy(['up']);

    expect(
      resolveSwipeDirection({
        translationX: 0,
        translationY: -120,
        velocityX: 0,
        velocityY: 0,
        directionPolicy,
      }),
    ).toBe('up');
    expect(
      resolveSwipeDirection({
        translationX: 0,
        translationY: 0,
        velocityX: 0,
        velocityY: -800,
        directionPolicy,
      }),
    ).toBe('up');
  });

  it('rejects downward motion and horizontal drag mode as upward candidates', () => {
    const directionPolicy = createSwipeDeckDirectionPolicy(['up']);

    expect(
      resolveSwipeDirection({
        translationX: 0,
        translationY: 200,
        velocityX: 0,
        velocityY: 900,
        directionPolicy,
      }),
    ).toBeNull();
    expect(
      resolveSwipeDirection({
        translationX: 0,
        translationY: -200,
        velocityX: 0,
        velocityY: -900,
        directionPolicy,
        dragMode: 'horizontal',
      }),
    ).toBeNull();
  });

  it('arbitrates diagonal gestures by normalized score with horizontal winning ties', () => {
    const directionPolicy = createSwipeDeckDirectionPolicy(['left', 'right', 'up']);

    expect(
      resolveSwipeDirection({
        translationX: 120,
        translationY: -180,
        velocityX: 0,
        velocityY: 0,
        directionPolicy,
      }),
    ).toBe('right');
    expect(
      resolveSwipeDirection({
        translationX: 48,
        translationY: -160,
        velocityX: 0,
        velocityY: 0,
        directionPolicy,
      }),
    ).toBe('up');
    expect(
      resolveSwipeDirection({
        translationX: -120,
        translationY: -160,
        velocityX: 0,
        velocityY: 0,
        directionPolicy,
      }),
    ).toBe('left');
  });

  it('keeps outside-cone upper diagonals horizontal', () => {
    const directionPolicy = createSwipeDeckDirectionPolicy(['left', 'right', 'up']);

    expect(
      resolveSwipeDirection({
        translationX: 120,
        translationY: -160,
        velocityX: 0,
        velocityY: 0,
        directionPolicy,
      }),
    ).toBe('right');
    expect(
      resolveSwipeDirection({
        translationX: -120,
        translationY: -160,
        velocityX: 0,
        velocityY: 0,
        directionPolicy,
      }),
    ).toBe('left');
  });

  it('does not fall back to a weaker allowed upward candidate when horizontal wins', () => {
    const resolvedDirection = resolveSwipeDirection({
      translationX: 120,
      translationY: -160,
      velocityX: 0,
      velocityY: 0,
      directionPolicy: createSwipeDeckDirectionPolicy(['up']),
    });

    expect(resolvedDirection).toBeNull();
  });

  it('returns null when upward qualifies but fails the cone with no horizontal release candidate', () => {
    expect(
      resolveSwipeDirection({
        translationX: 110,
        translationY: -160,
        velocityX: 0,
        velocityY: 0,
        directionPolicy: createSwipeDeckDirectionPolicy(['left', 'right', 'up']),
      }),
    ).toBeNull();
  });
});

describe('createSwipeDeckDirectionPolicy', () => {
  it('allows both directions when omitted', () => {
    const policy = createSwipeDeckDirectionPolicy();

    expect(policy).toEqual({ left: true, right: true, up: false });
    expect(hasAllowedSwipeDirection(policy)).toBe(true);
  });

  it('supports empty, one-sided, and up allow lists', () => {
    expect(createSwipeDeckDirectionPolicy([])).toEqual({ left: false, right: false, up: false });
    expect(createSwipeDeckDirectionPolicy(['left'])).toEqual({
      left: true,
      right: false,
      up: false,
    });
    expect(createSwipeDeckDirectionPolicy(['right'])).toEqual({
      left: false,
      right: true,
      up: false,
    });
    expect(createSwipeDeckDirectionPolicy(['up'])).toEqual({ left: false, right: false, up: true });
    expect(createSwipeDeckDirectionPolicy(['left', 'right', 'up'])).toEqual({
      left: true,
      right: true,
      up: true,
    });
    expect(hasAllowedSwipeDirection(createSwipeDeckDirectionPolicy([]))).toBe(false);
  });

  it('filters resolved directions through the policy', () => {
    const rightOnly = createSwipeDeckDirectionPolicy(['right']);

    expect(resolveAllowedSwipeDirection('right', rightOnly)).toBe('right');
    expect(resolveAllowedSwipeDirection('left', rightOnly)).toBeNull();
    expect(resolveAllowedSwipeDirection('up', createSwipeDeckDirectionPolicy(['up']))).toBe('up');
    expect(resolveAllowedSwipeDirection('up', rightOnly)).toBeNull();
    expect(resolveAllowedSwipeDirection(null, rightOnly)).toBeNull();
  });
});
