import { describe, expect, it } from '@jest/globals';
import { Easing } from 'react-native-reanimated';

import {
  getActiveRenderItemId,
  resolveProgressDirection,
  resolveSignedSwipeProgress,
  resolveSwipeDeckProgrammaticActionMotion,
  resolveSwipeDeckProgrammaticUndoMotion,
} from '../core/swipeDeckRuntime';
import { SwipeDeckActionMotion } from '../motion/actionMotion';
import { SwipeDeckUndoMotion } from '../motion/undoMotion';

describe('resolveProgressDirection', () => {
  it('resolves the horizontal progress direction', () => {
    expect(resolveProgressDirection(-1)).toBe(-1);
    expect(resolveProgressDirection(0)).toBe(0);
    expect(resolveProgressDirection(1)).toBe(1);
  });
});

describe('resolveSignedSwipeProgress', () => {
  it('normalizes translation by distance while preserving direction', () => {
    expect(resolveSignedSwipeProgress(-25, 100)).toBe(-0.25);
    expect(resolveSignedSwipeProgress(25, 100)).toBe(0.25);
  });

  it('clamps progress to one in either direction', () => {
    expect(resolveSignedSwipeProgress(-150, 100)).toBe(-1);
    expect(resolveSignedSwipeProgress(150, 100)).toBe(1);
  });

  it('uses a minimum positive distance for zero or negative distances', () => {
    expect(resolveSignedSwipeProgress(0.5, 0)).toBe(0.5);
    expect(resolveSignedSwipeProgress(2, 0)).toBe(1);
    expect(resolveSignedSwipeProgress(-2, -1)).toBe(-1);
  });
});

describe('getActiveRenderItemId', () => {
  it('returns the active index while it points to a valid data item', () => {
    expect(getActiveRenderItemId(3, 0)).toBe(0);
    expect(getActiveRenderItemId(3, 2)).toBe(2);
  });

  it('returns -1 for empty, negative, or completed indexes', () => {
    expect(getActiveRenderItemId(0, 0)).toBe(-1);
    expect(getActiveRenderItemId(3, -1)).toBe(-1);
    expect(getActiveRenderItemId(3, 3)).toBe(-1);
  });
});

describe('resolveSwipeDeckProgrammaticActionMotion', () => {
  it('returns null when no dismiss runtime is available', () => {
    expect(
      resolveSwipeDeckProgrammaticActionMotion({
        layout: { width: 300, height: 500 },
        runtime: null,
      }),
    ).toBeNull();
  });

  it('resolves action motion from the deck dismiss runtime fallback', () => {
    expect(
      resolveSwipeDeckProgrammaticActionMotion({
        layout: { width: 300, height: 500 },
        runtime: {
          duration: 320,
          easing: Easing.linear,
          offscreenMultiplier: 1.5,
        },
      }),
    ).toMatchObject({
      type: 'direct',
      dismissDuration: 320,
      dismissEasing: Easing.linear,
      offscreenMultiplier: 1.5,
    });
  });

  it('lets a one-call action motion override the default action motion', () => {
    expect(
      resolveSwipeDeckProgrammaticActionMotion({
        actionMotion: SwipeDeckActionMotion.direct({
          duration: 180,
        }),
        defaultActionMotion: SwipeDeckActionMotion.springboard({
          anticipationDistance: 40,
        }),
        layout: { width: 300, height: 500 },
        runtime: {
          easing: Easing.linear,
          offscreenMultiplier: 1.5,
        },
      }),
    ).toMatchObject({
      type: 'direct',
      dismissDuration: 180,
    });
  });
});

describe('resolveSwipeDeckProgrammaticUndoMotion', () => {
  const runtime = {
    duration: 320,
    easing: Easing.linear,
    offscreenMultiplier: 1,
    rotationDirection: 'default' as const,
    rotationMaxDegrees: 18,
    rotationMode: 'grab-position' as const,
    rotationOrigin: undefined,
  };

  it('resolves undo entry distance from the same dismiss geometry used by actions', () => {
    const motion = resolveSwipeDeckProgrammaticUndoMotion({
      direction: 'right',
      layout: { width: 300, height: 500 },
      runtime,
    });

    expect(motion).toMatchObject({
      type: 'timing',
      from: expect.any(Object),
    });
    expect(motion.from.translateX).toBeCloseTo(447.17);
  });

  it('lets a one-call undo motion override the default undo motion', () => {
    expect(
      resolveSwipeDeckProgrammaticUndoMotion({
        defaultUndoMotion: SwipeDeckUndoMotion.spring({
          entryDistance: 999,
        }),
        direction: 'right',
        layout: { width: 300, height: 500 },
        runtime,
        undoMotion: SwipeDeckUndoMotion.timing({
          duration: 160,
          entryDistance: 120,
          from: 'left',
        }),
      }),
    ).toMatchObject({
      type: 'timing',
      duration: 160,
      from: {
        translateX: -120,
      },
    });
  });
});
