import { describe, expect, it } from '@jest/globals';

import { createSwipeSlots, reconcileSwipeSlots } from '../slots';
import { getSwipeWindow } from '../windowing';

describe('createSwipeSlots', () => {
  it('creates stable slot ids for the initial visible window', () => {
    const slots = createSwipeSlots(getSwipeWindow(150, 75));

    expect(slots.map((slot) => slot.id)).toEqual([0, 1, 2, 3, 4]);
    expect(slots.map((slot) => slot.descriptor.index)).toEqual([73, 74, 75, 76, 77]);
  });
});

describe('reconcileSwipeSlots', () => {
  it('keeps slot ids for items that remain visible and recycles the leaving slot', () => {
    const currentSlots = createSwipeSlots(getSwipeWindow(150, 75));
    const nextSlots = reconcileSwipeSlots(currentSlots, getSwipeWindow(150, 76));

    expect(nextSlots).toHaveLength(5);
    expect(nextSlots.map((slot) => slot.id)).toEqual([0, 1, 2, 3, 4]);
    expect(nextSlots.map((slot) => slot.descriptor.index)).toEqual([78, 74, 75, 76, 77]);
    expect(nextSlots.map((slot) => slot.descriptor.offset)).toEqual([2, -2, -1, 0, 1]);
  });

  it('resets slot ids when the visible slot count changes', () => {
    const currentSlots = createSwipeSlots(getSwipeWindow(150, 75, 5));
    const nextSlots = reconcileSwipeSlots(currentSlots, getSwipeWindow(150, 75, 7));

    expect(nextSlots.map((slot) => slot.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(nextSlots.map((slot) => slot.descriptor.index)).toEqual([72, 73, 74, 75, 76, 77, 78]);
  });
});
