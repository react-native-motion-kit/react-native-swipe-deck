import { describe, expect, it } from '@jest/globals';

import { getSwipeDeckState } from '../registry/deckState';

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
        hasUndoHistory: true,
      }),
    ).toEqual({
      activeIndex: 0,
      count: 2,
      isCompleted: false,
      canSwipe: true,
      canUndo: true,
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
        hasUndoHistory: false,
      }),
    ).toEqual({
      activeIndex: 0,
      count: 0,
      isCompleted: true,
      canSwipe: false,
      canUndo: false,
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
        hasUndoHistory: true,
      }).canSwipe,
    ).toBe(false);
  });

  it('rejects undo when layout is not measured or runtime is busy', () => {
    expect(
      getSwipeDeckState({
        dataLength: 2,
        activeIndex: 1,
        disabled: false,
        layout: { width: 0, height: 500 },
        isAnimating: false,
        isDragging: false,
        hasUndoHistory: true,
      }).canUndo,
    ).toBe(false);

    expect(
      getSwipeDeckState({
        dataLength: 2,
        activeIndex: 1,
        disabled: false,
        layout: { width: 300, height: 500 },
        isAnimating: true,
        isDragging: false,
        hasUndoHistory: true,
      }).canUndo,
    ).toBe(false);
  });
});
