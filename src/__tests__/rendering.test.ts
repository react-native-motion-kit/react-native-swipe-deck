import { describe, expect, it } from '@jest/globals';

import {
  getSwipeDeckStackRenderItems,
  getSwipeRenderItems,
  getSwipeStackRenderItems,
  getSwipeUndoRenderItems,
} from '../core/rendering';
import { getSwipeCommit, shouldDeferActiveItemSync, shouldResetEndReached } from '../core/state';

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

  it('orders mounted cards back-to-front so current renders above next cards', () => {
    const items = getSwipeRenderItems(profiles, 75, getProfileKey);

    expect(getSwipeStackRenderItems(items).map((item) => item.index)).toEqual([77, 76, 75]);
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

  it('creates undo render info as a restored current plus old stack slots', () => {
    const items = getSwipeUndoRenderItems({
      data: profiles,
      currentIndex: 2,
      getKey: getProfileKey,
      restoredIndex: 1,
    });

    expect(items.map((item) => item.index)).toEqual([1, 2, 3]);
    expect(items.map((item) => item.offset)).toEqual([0, 1, 2]);
    expect(items.map((item) => item.role)).toEqual(['current', 'next', 'next']);
    expect(items.map((item) => item.isActive)).toEqual([true, false, false]);
    expect(items.map((item) => item.transition)).toEqual([
      undefined,
      { fromOffset: 0, toOffset: 1 },
      { fromOffset: 1, toOffset: 2 },
    ]);
  });

  it('skips the restored index from the old stack when data reorder moves it after current', () => {
    const items = getSwipeUndoRenderItems({
      data: profiles,
      currentIndex: 1,
      getKey: getProfileKey,
      restoredIndex: 2,
    });

    expect(items.map((item) => item.index)).toEqual([2, 1, 3]);
    expect(items.map((item) => item.itemKey)).toEqual(['profile-2', 'profile-1', 'profile-3']);
    expect(items.map((item) => item.transition)).toEqual([
      undefined,
      { fromOffset: 0, toOffset: 1 },
      { fromOffset: 2, toOffset: 2 },
    ]);
  });

  it('resolves undo stack render items from the current key instead of a stale index', () => {
    const reorderedProfiles = [
      profiles[1] as { id: string; name: string },
      profiles[0] as { id: string; name: string },
    ];
    const items = getSwipeDeckStackRenderItems({
      data: reorderedProfiles,
      activeIndex: 0,
      getKey: getProfileKey,
      undoKey: 'profile-0',
    });

    expect(items.map((item) => item.itemKey)).toEqual(['profile-1', 'profile-0']);
    expect(items.at(-1)).toMatchObject({ itemKey: 'profile-0', isActive: true, offset: 0 });
  });

  it('treats an empty string undo key as a valid item key', () => {
    const emptyKeyProfiles = [
      { id: '', name: 'Empty key' },
      { id: 'profile-1', name: 'Profile 1' },
    ];
    const items = getSwipeDeckStackRenderItems({
      data: emptyKeyProfiles,
      activeIndex: 1,
      getKey: getProfileKey,
      undoKey: '',
    });

    expect(items.map((item) => item.itemKey)).toEqual(['profile-1', '']);
    expect(items.at(-1)).toMatchObject({ itemKey: '', isActive: true, offset: 0 });
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
