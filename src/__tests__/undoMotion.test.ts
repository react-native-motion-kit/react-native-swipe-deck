import type { GestureResponderEvent } from 'react-native';

import { describe, expect, it } from '@jest/globals';
import { Easing } from 'react-native-reanimated';

import type { SwipeDeckUndoAction } from '../types';

import { SwipeDeckUndoMotion as RootSwipeDeckUndoMotion } from '../index';
import {
  isSwipeDeckUndoMotionRecipe,
  resolveSwipeDeckUndoMotion,
  resolveSwipeDeckUndoMotionRecipe,
  SwipeDeckUndoMotion,
} from '../motion/undoMotion';

describe('SwipeDeckUndoMotion', () => {
  it('keeps undo actions assignable to React Native press callbacks', () => {
    const action = (() => true) as SwipeDeckUndoAction;
    const pressHandler: (event: GestureResponderEvent) => void = action;

    expect(typeof pressHandler).toBe('function');
    expect(action(SwipeDeckUndoMotion.spring())).toBe(true);
  });

  it('exports the helper namespace from the package root', () => {
    expect(RootSwipeDeckUndoMotion.spring()).toMatchObject({
      kind: 'swipe-deck-undo-motion',
      type: 'spring',
    });
  });

  it('creates spring and timing undo motion recipes', () => {
    expect(
      SwipeDeckUndoMotion.spring({
        from: 'left',
        entryDistance: 320,
        springConfig: {
          damping: 14,
        },
      }),
    ).toMatchObject({
      kind: 'swipe-deck-undo-motion',
      type: 'spring',
      from: 'left',
      entryDistance: 320,
    });

    expect(
      SwipeDeckUndoMotion.timing({
        duration: 260,
        easing: Easing.ease,
      }),
    ).toMatchObject({
      kind: 'swipe-deck-undo-motion',
      type: 'timing',
      duration: 260,
    });
  });

  it('guards recipe values from callback event objects', () => {
    expect(isSwipeDeckUndoMotionRecipe(SwipeDeckUndoMotion.spring())).toBe(true);
    expect(isSwipeDeckUndoMotionRecipe({ nativeEvent: {} })).toBe(false);
    expect(isSwipeDeckUndoMotionRecipe({ type: 'spring' })).toBe(false);
  });

  it('resolves undo motion precedence by replacement', () => {
    const factoryUndoMotion = SwipeDeckUndoMotion.spring({
      entryDistance: 100,
    });
    const rootUndoMotion = SwipeDeckUndoMotion.timing({
      duration: 240,
    });
    const perCallUndoMotion = SwipeDeckUndoMotion.spring({
      entryDistance: 20,
    });

    expect(
      resolveSwipeDeckUndoMotionRecipe({
        defaultUndoMotion: factoryUndoMotion,
      }),
    ).toBe(factoryUndoMotion);
    expect(
      resolveSwipeDeckUndoMotionRecipe({
        defaultUndoMotion: factoryUndoMotion,
        rootUndoMotion,
      }),
    ).toBe(rootUndoMotion);
    expect(
      resolveSwipeDeckUndoMotionRecipe({
        defaultUndoMotion: factoryUndoMotion,
        rootUndoMotion,
        undoMotion: perCallUndoMotion,
      }),
    ).toBe(perCallUndoMotion);
  });

  it('resolves auto entry side from original swipe direction', () => {
    expect(
      resolveSwipeDeckUndoMotion({
        defaultEntryDistance: 450,
        layout: { width: 300, height: 500 },
        originalDirection: 'right',
        recipe: SwipeDeckUndoMotion.spring(),
      }),
    ).toMatchObject({
      type: 'spring',
      from: {
        translateX: 450,
      },
    });

    expect(
      resolveSwipeDeckUndoMotion({
        defaultEntryDistance: 450,
        layout: { width: 300, height: 500 },
        originalDirection: 'left',
        recipe: SwipeDeckUndoMotion.timing(),
      }),
    ).toMatchObject({
      type: 'timing',
      from: {
        translateX: -450,
      },
      duration: 0,
    });
  });

  it('uses zero-duration timing as the default restore motion', () => {
    expect(
      resolveSwipeDeckUndoMotion({
        defaultEntryDistance: 450,
        layout: { width: 300, height: 500 },
        originalDirection: 'right',
      }),
    ).toMatchObject({
      type: 'timing',
      duration: 0,
      from: {
        translateX: 450,
      },
    });
  });

  it('resolves explicit entry distance and side overrides', () => {
    expect(
      resolveSwipeDeckUndoMotion({
        defaultEntryDistance: 450,
        layout: { width: 300, height: 500 },
        originalDirection: 'right',
        recipe: SwipeDeckUndoMotion.timing({
          from: 'left',
          entryDistance: ({ width }) => width * 2,
          duration: 180,
        }),
      }),
    ).toMatchObject({
      type: 'timing',
      from: {
        translateX: -600,
      },
      duration: 180,
    });
  });
});
