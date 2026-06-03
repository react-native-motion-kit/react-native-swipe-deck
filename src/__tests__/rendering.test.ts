import { describe, expect, it } from '@jest/globals';

import { getSwipeRenderItems } from '../rendering';
import { getSwipeCommit, shouldDeferActiveItemSync, shouldResetEndReached } from '../state';

const getProfileKey = (item: { id: string }) => item.id;

const profiles: Array<{ id: string; name: string }> = Array.from({ length: 150 }, (_, index) => ({
  id: `profile-${index}`,
  name: `Profile ${index}`,
}));

describe('getSwipeRenderItems', () => {
  it('creates render info only for the bounded three-card window by default', () => {
    const items = getSwipeRenderItems(profiles, 75, getProfileKey);

    expect(items).toHaveLength(3);
    expect(items.map((item) => item.index)).toEqual([75, 76, 77]);
    expect(items.map((item) => item.itemKey)).toEqual(['profile-75', 'profile-76', 'profile-77']);
    expect(items.map((item) => item.offset)).toEqual([0, 1, 2]);
    expect(items.map((item) => item.role)).toEqual(['current', 'next', 'next']);
    expect(items.map((item) => item.isActive)).toEqual([true, false, false]);
  });

  it('does not backfill dismissed previous cards at the last valid index', () => {
    const items = getSwipeRenderItems(profiles, 149, getProfileKey);

    expect(items).toHaveLength(1);
    expect(items.map((item) => item.index)).toEqual([149]);
    expect(items.map((item) => item.offset)).toEqual([0]);
    expect(items.map((item) => item.role)).toEqual(['current']);
  });

  it('creates no render info for empty or completed decks', () => {
    expect(getSwipeRenderItems([], 0, getProfileKey)).toEqual([]);
    expect(getSwipeRenderItems(profiles, 150, getProfileKey)).toEqual([]);
  });

  it('keeps render identity tied to item keys during next-to-current promotion', () => {
    const currentItems = getSwipeRenderItems(profiles, 75, getProfileKey, 5);
    const nextItems = getSwipeRenderItems(profiles, 76, getProfileKey, 5);

    expect(currentItems.map((item) => item.itemKey)).toEqual([
      'profile-75',
      'profile-76',
      'profile-77',
      'profile-78',
      'profile-79',
    ]);
    expect(nextItems.map((item) => item.itemKey)).toEqual([
      'profile-76',
      'profile-77',
      'profile-78',
      'profile-79',
      'profile-80',
    ]);
    expect(nextItems[0]).toMatchObject({ itemKey: 'profile-76', offset: 0, isActive: true });
  });
});

describe('getSwipeCommit', () => {
  it('returns accepted swipe callback data for a valid card', () => {
    expect(getSwipeCommit(3, 1, false)).toEqual({
      swipedIndex: 1,
      nextIndex: 2,
      isCompleted: false,
      shouldEmitEndReached: false,
    });
  });

  it('marks the final card as completed and emits end reached once', () => {
    expect(getSwipeCommit(3, 2, false)).toEqual({
      swipedIndex: 2,
      nextIndex: 3,
      isCompleted: true,
      shouldEmitEndReached: true,
    });

    expect(getSwipeCommit(3, 2, true)?.shouldEmitEndReached).toBe(false);
  });

  it('does not commit invalid or completed indexes', () => {
    expect(getSwipeCommit(0, 0, false)).toBeNull();
    expect(getSwipeCommit(3, -1, false)).toBeNull();
    expect(getSwipeCommit(3, 3, false)).toBeNull();
  });
});

describe('shouldResetEndReached', () => {
  it('resets end-reached state when data extension makes the active index valid again', () => {
    expect(shouldResetEndReached(1, 1)).toBe(false);
    expect(shouldResetEndReached(1, 2)).toBe(true);
  });
});

describe('shouldDeferActiveItemSync', () => {
  it('defers React-to-shared active item sync during commit animation handoff only', () => {
    expect(shouldDeferActiveItemSync(true, false)).toBe(true);
    expect(shouldDeferActiveItemSync(true, true)).toBe(false);
    expect(shouldDeferActiveItemSync(false, false)).toBe(false);
  });
});
