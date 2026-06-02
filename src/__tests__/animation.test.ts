import { describe, expect, it } from '@jest/globals';

import { resolveSwipeDeckAnimationConfig } from '../animation';

describe('resolveSwipeDeckAnimationConfig', () => {
  it('uses default stacked-card animation values', () => {
    expect(resolveSwipeDeckAnimationConfig(undefined, { width: 300, height: 500 })).toEqual({
      nextScale: 0.95,
      nextOpacity: 1,
      nextTranslateY: 12,
      previousScale: 0.92,
      previousOpacity: 1,
      previousTranslateY: 20,
      swipeProgressDistance: 120,
    });
  });

  it('resolves custom animation values', () => {
    expect(
      resolveSwipeDeckAnimationConfig(
        {
          nextScale: 0.9,
          nextOpacity: 0.8,
          nextTranslateY: 24,
          previousScale: 0.88,
          previousOpacity: 0.6,
          previousTranslateY: 32,
          swipeProgressDistance: ({ width }) => width / 2,
        },
        { width: 400, height: 500 },
      ),
    ).toEqual({
      nextScale: 0.9,
      nextOpacity: 0.8,
      nextTranslateY: 24,
      previousScale: 0.88,
      previousOpacity: 0.6,
      previousTranslateY: 32,
      swipeProgressDistance: 200,
    });
  });
});
