import type { GestureResponderEvent } from 'react-native';

import { describe, expect, it } from '@jest/globals';
import { Easing } from 'react-native-reanimated';

import type { SwipeDeckAction } from '../types';

import {
  isSwipeDeckActionMotionRecipe,
  resolveSwipeDeckActionMotion,
  resolveSwipeDeckActionMotionRecipe,
  SwipeDeckActionMotion,
} from '../actionMotion';

const fallback = {
  dismissDuration: undefined,
  dismissEasing: Easing.linear,
  offscreenMultiplier: 1.5,
};

describe('SwipeDeckActionMotion', () => {
  it('keeps deck actions assignable to React Native press callbacks', () => {
    const action = (() => true) as SwipeDeckAction;
    const pressHandler: (event: GestureResponderEvent) => void = action;

    expect(typeof pressHandler).toBe('function');
    expect(action(SwipeDeckActionMotion.direct())).toBe(true);
  });

  it('creates direct action motion recipes', () => {
    expect(
      SwipeDeckActionMotion.direct({
        duration: 240,
        easing: Easing.ease,
        offscreenMultiplier: 2,
      }),
    ).toMatchObject({
      kind: 'swipe-deck-action-motion',
      type: 'direct',
      duration: 240,
      offscreenMultiplier: 2,
    });
  });

  it('creates springboard action motion recipes', () => {
    expect(
      SwipeDeckActionMotion.springboard({
        anticipationDistance: 24,
        anticipationDuration: 90,
        dismissDuration: 320,
      }),
    ).toMatchObject({
      kind: 'swipe-deck-action-motion',
      type: 'springboard',
      anticipationDistance: 24,
      anticipationDuration: 90,
      dismissDuration: 320,
    });
  });

  it('guards recipe values from callback event objects', () => {
    expect(isSwipeDeckActionMotionRecipe(SwipeDeckActionMotion.direct())).toBe(true);
    expect(isSwipeDeckActionMotionRecipe({ nativeEvent: {} })).toBe(false);
    expect(isSwipeDeckActionMotionRecipe({ type: 'direct' })).toBe(false);
  });

  it('resolves action motion precedence by replacement', () => {
    const factoryActionMotion = SwipeDeckActionMotion.springboard({
      anticipationDistance: 100,
    });
    const rootActionMotion = SwipeDeckActionMotion.direct({
      duration: 220,
    });
    const perCallActionMotion = SwipeDeckActionMotion.springboard({
      anticipationDistance: 20,
    });

    expect(
      resolveSwipeDeckActionMotionRecipe({
        defaultActionMotion: factoryActionMotion,
      }),
    ).toBe(factoryActionMotion);
    expect(
      resolveSwipeDeckActionMotionRecipe({
        defaultActionMotion: factoryActionMotion,
        rootActionMotion,
      }),
    ).toBe(rootActionMotion);
    expect(
      resolveSwipeDeckActionMotionRecipe({
        defaultActionMotion: factoryActionMotion,
        rootActionMotion,
        actionMotion: perCallActionMotion,
      }),
    ).toBe(perCallActionMotion);
  });

  it('resolves direct recipes with fallback dismiss semantics', () => {
    expect(
      resolveSwipeDeckActionMotion({
        fallback,
        layout: { width: 400, height: 600 },
        recipe: SwipeDeckActionMotion.direct(),
      }),
    ).toMatchObject({
      type: 'direct',
      dismissDuration: undefined,
      dismissEasing: fallback.dismissEasing,
      offscreenMultiplier: 1.5,
    });

    expect(
      resolveSwipeDeckActionMotion({
        fallback,
        layout: { width: 400, height: 600 },
        recipe: SwipeDeckActionMotion.direct({
          duration: 180,
          offscreenMultiplier: 1.1,
        }),
      }),
    ).toMatchObject({
      type: 'direct',
      dismissDuration: 180,
      offscreenMultiplier: 1.1,
    });
  });

  it('resolves springboard recipes with opposite-direction anticipation defaults', () => {
    expect(
      resolveSwipeDeckActionMotion({
        fallback,
        layout: { width: 400, height: 600 },
        recipe: SwipeDeckActionMotion.springboard(),
      }),
    ).toMatchObject({
      type: 'springboard',
      anticipationDistance: 16,
      anticipationDuration: 80,
      anticipationEasing: fallback.dismissEasing,
      dismissDuration: undefined,
      dismissEasing: fallback.dismissEasing,
      offscreenMultiplier: 1.5,
    });
  });

  it('resolves springboard layout distance and dismiss overrides', () => {
    expect(
      resolveSwipeDeckActionMotion({
        fallback,
        layout: { width: 500, height: 600 },
        recipe: SwipeDeckActionMotion.springboard({
          anticipationDistance: ({ width }) => width * 0.1,
          anticipationDuration: 100,
          dismissDuration: 360,
          dismissEasing: Easing.ease,
          offscreenMultiplier: 1.2,
        }),
      }),
    ).toMatchObject({
      type: 'springboard',
      anticipationDistance: 50,
      anticipationDuration: 100,
      dismissDuration: 360,
      dismissEasing: Easing.ease,
      offscreenMultiplier: 1.2,
    });
  });
});
