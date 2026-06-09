import { describe, expect, it } from '@jest/globals';

import {
  getActiveRenderItemId,
  resolveProgressDirection,
  resolveSignedSwipeProgress,
} from '../swipeDeckRuntime';

describe('resolveProgressDirection', () => {
  it('resolves the horizontal progress direction', () => {
    expect(resolveProgressDirection(-1)).toBe(-1);
    expect(resolveProgressDirection(0)).toBe(0);
    expect(resolveProgressDirection(1)).toBe(1);
  });
});

describe('resolveSignedSwipeProgress', () => {
  it('normalizes translation by distance while preserving direction', () => {
    expect(resolveSignedSwipeProgress(-25, 100)).toBe(-0.25);
    expect(resolveSignedSwipeProgress(25, 100)).toBe(0.25);
  });

  it('clamps progress to one in either direction', () => {
    expect(resolveSignedSwipeProgress(-150, 100)).toBe(-1);
    expect(resolveSignedSwipeProgress(150, 100)).toBe(1);
  });

  it('uses a minimum positive distance for zero or negative distances', () => {
    expect(resolveSignedSwipeProgress(0.5, 0)).toBe(0.5);
    expect(resolveSignedSwipeProgress(2, 0)).toBe(1);
    expect(resolveSignedSwipeProgress(-2, -1)).toBe(-1);
  });
});

describe('getActiveRenderItemId', () => {
  it('returns the active index while it points to a valid data item', () => {
    expect(getActiveRenderItemId(3, 0)).toBe(0);
    expect(getActiveRenderItemId(3, 2)).toBe(2);
  });

  it('returns -1 for empty, negative, or completed indexes', () => {
    expect(getActiveRenderItemId(0, 0)).toBe(-1);
    expect(getActiveRenderItemId(3, -1)).toBe(-1);
    expect(getActiveRenderItemId(3, 3)).toBe(-1);
  });
});
