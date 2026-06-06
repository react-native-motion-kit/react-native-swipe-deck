import { describe, expect, it } from '@jest/globals';

import { getSwipeDeckState } from '../deckState';

describe('getSwipeDeckState', () => {
  it('treats falsey values as valid active deck items', () => {
    expect(
      getSwipeDeckState({
        dataLength: 2,
        activeIndex: 0,
        disabled: false,
        layout: { width: 300, height: 500 },
        isAnimating: false,
        isDragging: false,
      }),
    ).toEqual({
      activeIndex: 0,
      count: 2,
      isCompleted: false,
      canSwipe: true,
    });
  });

  it('treats an attached empty deck as completed', () => {
    expect(
      getSwipeDeckState({
        dataLength: 0,
        activeIndex: 0,
        disabled: false,
        layout: { width: 300, height: 500 },
        isAnimating: false,
        isDragging: false,
      }),
    ).toEqual({
      activeIndex: 0,
      count: 0,
      isCompleted: true,
      canSwipe: false,
    });
  });

  it('rejects swipes when layout is not measured', () => {
    expect(
      getSwipeDeckState({
        dataLength: 1,
        activeIndex: 0,
        disabled: false,
        layout: { width: 0, height: 500 },
        isAnimating: false,
        isDragging: false,
      }).canSwipe,
    ).toBe(false);
  });
});
