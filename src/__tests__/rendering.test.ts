import { describe, expect, it } from '@jest/globals';

import { getSwipeRenderItems, getSwipeSlotRenderItems } from '../rendering';
import { createSwipeSlots, reconcileSwipeSlots } from '../slots';
import { getSwipeCommit, shouldResetEndReached } from '../state';
import { getSwipeWindow } from '../windowing';

const profiles: Array<{ id: string; name: string }> = Array.from({ length: 150 }, (_, index) => ({
  id: `profile-${index}`,
  name: `Profile ${index}`,
}));

describe('getSwipeRenderItems', () => {
  it('creates render info only for the bounded five-card window', () => {
    const items = getSwipeRenderItems(profiles, 75);

    expect(items).toHaveLength(5);
    expect(items.map((item) => item.index)).toEqual([73, 74, 75, 76, 77]);
    expect(items.map((item) => item.offset)).toEqual([-2, -1, 0, 1, 2]);
    expect(items.map((item) => item.role)).toEqual([
      'previous',
      'previous',
      'current',
      'next',
      'next',
    ]);
    expect(items.map((item) => item.isActive)).toEqual([false, false, true, false, false]);
  });

  it('fills the five-card render window at the last valid index', () => {
    const items = getSwipeRenderItems(profiles, 149);

    expect(items).toHaveLength(5);
    expect(items.map((item) => item.index)).toEqual([145, 146, 147, 148, 149]);
    expect(items.map((item) => item.offset)).toEqual([-4, -3, -2, -1, 0]);
    expect(items.map((item) => item.role)).toEqual([
      'previous',
      'previous',
      'previous',
      'previous',
      'current',
    ]);
  });

  it('creates no render info for empty or completed decks', () => {
    expect(getSwipeRenderItems([], 0)).toEqual([]);
    expect(getSwipeRenderItems(profiles, 150)).toEqual([]);
  });
});

describe('getSwipeSlotRenderItems', () => {
  it('keeps outer slot ids stable while item keys follow item identity after recycling', () => {
    const currentSlots = createSwipeSlots(getSwipeWindow(profiles.length, 75));
    const nextSlots = reconcileSwipeSlots(currentSlots, getSwipeWindow(profiles.length, 76));
    const items = getSwipeSlotRenderItems(profiles, nextSlots, (item) => item.id);

    expect(items.map((item) => item.slotId)).toEqual([0, 1, 2, 3, 4]);
    expect(items.map((item) => item.itemKey)).toEqual([
      'profile-78',
      'profile-74',
      'profile-75',
      'profile-76',
      'profile-77',
    ]);
    expect(items.map((item) => item.offset)).toEqual([2, -2, -1, 0, 1]);
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
