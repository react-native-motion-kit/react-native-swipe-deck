import { describe, expect, it } from '@jest/globals';

import { resolveSwipeDeckDirectionTranslation } from '../motion/motionGeometry';

describe('resolveSwipeDeckDirectionTranslation', () => {
  it('resolves left, right, and up vectors with a consistent axis shape', () => {
    expect(resolveSwipeDeckDirectionTranslation({ direction: 'left', distance: 320 })).toEqual({
      translateX: -320,
      translateY: 0,
      axis: 'x',
    });
    expect(resolveSwipeDeckDirectionTranslation({ direction: 'right', distance: 320 })).toEqual({
      translateX: 320,
      translateY: 0,
      axis: 'x',
    });
    expect(resolveSwipeDeckDirectionTranslation({ direction: 'up', distance: 520 })).toEqual({
      translateX: 0,
      translateY: -520,
      axis: 'y',
    });
  });

  it('preserves cross-axis displacement for dismiss destinations', () => {
    expect(
      resolveSwipeDeckDirectionTranslation({
        direction: 'right',
        distance: 320,
        crossAxisTranslation: 12,
      }),
    ).toEqual({
      translateX: 320,
      translateY: 12,
      axis: 'x',
    });
    expect(
      resolveSwipeDeckDirectionTranslation({
        direction: 'up',
        distance: 520,
        crossAxisTranslation: 25,
      }),
    ).toEqual({
      translateX: 25,
      translateY: -520,
      axis: 'y',
    });
  });
});
