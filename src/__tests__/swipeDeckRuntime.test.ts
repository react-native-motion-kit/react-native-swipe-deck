import { describe, expect, it } from '@jest/globals';
import { Easing } from 'react-native-reanimated';

import { resolveSwipeIntentWinner } from '../core/directions';
import {
  getActiveRenderItemId,
  resolveProgressDirection,
  resolveSignedSwipeProgress,
  resolveSwipeProgress,
  resolveSwipeProgressIntent,
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

describe('resolveSwipeProgress', () => {
  it('keeps X-only progress when up is disabled', () => {
    expect(
      resolveSwipeProgress({
        translationX: 25,
        translationY: -80,
        distance: 100,
        directionPolicy: { left: true, right: true, up: false },
      }),
    ).toBe(0.25);
  });

  it('uses the narrow upward cone with horizontal equality and clamps to one', () => {
    expect(
      resolveSwipeProgress({
        translationX: 48,
        translationY: -80,
        distance: 100,
        directionPolicy: { left: true, right: true, up: true },
      }),
    ).toBe(0.8);
    expect(
      resolveSwipeProgress({
        translationX: 80,
        translationY: -120,
        distance: 100,
        directionPolicy: { left: true, right: true, up: true },
      }),
    ).toBe(0.8);
    expect(
      resolveSwipeProgress({
        translationX: 20,
        translationY: -180,
        distance: 100,
        directionPolicy: { left: true, right: true, up: true },
      }),
    ).toBe(1);
  });

  it('ignores upward progress outside free drag mode', () => {
    expect(
      resolveSwipeProgress({
        translationX: 25,
        translationY: -80,
        distance: 100,
        directionPolicy: { left: true, right: true, up: true },
        dragMode: 'horizontal',
      }),
    ).toBe(0.25);
  });

  it('zeros filtered-null live progress without changing raw geometry', () => {
    expect(
      resolveSwipeProgress({
        translationX: 80,
        translationY: -25,
        distance: 100,
        directionPolicy: { left: false, right: false, up: true },
      }),
    ).toBe(0);
  });

  it('ignores downward displacement for upward progress', () => {
    expect(
      resolveSwipeProgress({
        translationX: 20,
        translationY: 180,
        distance: 100,
        directionPolicy: { left: true, right: true, up: true },
      }),
    ).toBe(0.2);
  });
});

describe('resolveSwipeProgressIntent', () => {
  it('zeros horizontal signed signals when upward free-drag intent is inside the cone', () => {
    expect(
      resolveSwipeProgressIntent({
        translationX: 25,
        translationY: -80,
        distance: 100,
        directionPolicy: { left: true, right: true, up: true },
        dragMode: 'free',
      }),
    ).toEqual({
      direction: 0,
      intentDirection: 'up',
      progress: 0.8,
      signedProgress: 0,
    });
  });

  it('keeps horizontal signals on ties', () => {
    expect(
      resolveSwipeProgressIntent({
        translationX: 80,
        translationY: -80,
        distance: 100,
        directionPolicy: { left: true, right: true, up: true },
        dragMode: 'free',
      }),
    ).toEqual({
      direction: 1,
      intentDirection: 'right',
      progress: 0.8,
      signedProgress: 0.8,
    });
  });

  it('preserves horizontal intent when up is disabled or drag is horizontal', () => {
    expect(
      resolveSwipeProgressIntent({
        translationX: -25,
        translationY: -80,
        distance: 100,
        directionPolicy: { left: true, right: true, up: false },
      }),
    ).toEqual({
      direction: -1,
      intentDirection: 'left',
      progress: 0.25,
      signedProgress: -0.25,
    });
    expect(
      resolveSwipeProgressIntent({
        translationX: 25,
        translationY: -80,
        distance: 100,
        directionPolicy: { left: true, right: true, up: true },
        dragMode: 'horizontal',
      }),
    ).toEqual({
      direction: 1,
      intentDirection: 'right',
      progress: 0.25,
      signedProgress: 0.25,
    });
  });

  it('keeps the raw/filter seam distinct for up-only outside-cone drags', () => {
    expect(
      resolveSwipeIntentWinner({
        horizontalDirection: 'right',
        horizontalQualified: true,
        horizontalScore: 1.2,
        upwardQualified: true,
        upwardScore: 1.6,
      }),
    ).toBe('right');
    expect(
      resolveSwipeProgressIntent({
        translationX: 120,
        translationY: -160,
        distance: 100,
        directionPolicy: { left: false, right: false, up: true },
        dragMode: 'free',
      }),
    ).toEqual({
      direction: 0,
      intentDirection: null,
      progress: 0,
      signedProgress: 0,
    });
    expect(
      resolveSwipeProgressIntent({
        translationX: -120,
        translationY: -160,
        distance: 100,
        directionPolicy: { left: false, right: false, up: true },
        dragMode: 'free',
      }),
    ).toEqual({
      direction: 0,
      intentDirection: null,
      progress: 0,
      signedProgress: 0,
    });
  });
});

describe('resolveSwipeIntentWinner', () => {
  it('selects up only inside the strict 1.5x cone', () => {
    expect(
      resolveSwipeIntentWinner({
        horizontalDirection: 'right',
        horizontalQualified: true,
        horizontalScore: 0.48,
        upwardQualified: true,
        upwardScore: 1.6,
      }),
    ).toBe('up');
    expect(
      resolveSwipeIntentWinner({
        horizontalDirection: 'right',
        horizontalQualified: true,
        horizontalScore: 0.8,
        upwardQualified: true,
        upwardScore: 1.2,
      }),
    ).toBe('right');
    expect(
      resolveSwipeIntentWinner({
        horizontalDirection: 'left',
        horizontalQualified: true,
        horizontalScore: 1.2,
        upwardQualified: true,
        upwardScore: 1.6,
      }),
    ).toBe('left');
  });

  it('does not fabricate horizontal intent when a failed cone has no horizontal candidate', () => {
    expect(
      resolveSwipeIntentWinner({
        horizontalDirection: null,
        horizontalQualified: false,
        horizontalScore: 0.92,
        upwardQualified: true,
        upwardScore: 1.34,
      }),
    ).toBeNull();
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
    expect(motion.from.translateY).toBe(0);
  });

  it('resolves symmetrical horizontal undo vectors with no vertical displacement', () => {
    const rightMotion = resolveSwipeDeckProgrammaticUndoMotion({
      direction: 'right',
      layout: { width: 300, height: 500 },
      runtime,
    });
    const leftMotion = resolveSwipeDeckProgrammaticUndoMotion({
      direction: 'left',
      layout: { width: 300, height: 500 },
      runtime,
    });

    expect(rightMotion.from.translateX).toBeCloseTo(447.17);
    expect(leftMotion.from.translateX).toBeCloseTo(-447.17);
    expect(rightMotion.from.translateY).toBe(0);
    expect(leftMotion.from.translateY).toBe(0);
  });

  it('resolves upward undo vectors from above', () => {
    const motion = resolveSwipeDeckProgrammaticUndoMotion({
      direction: 'up',
      layout: { width: 300, height: 500 },
      runtime,
    });

    expect(motion.from.translateX).toBe(0);
    expect(motion.from.translateY).toBeLessThan(-500);
  });

  it('resolves default undo entry distance from an overridden entry axis', () => {
    const horizontalMotion = resolveSwipeDeckProgrammaticUndoMotion({
      direction: 'up',
      layout: { width: 600, height: 200 },
      runtime,
      undoMotion: SwipeDeckUndoMotion.timing({ from: 'left' }),
    });
    const upwardMotion = resolveSwipeDeckProgrammaticUndoMotion({
      direction: 'right',
      layout: { width: 200, height: 600 },
      runtime,
      undoMotion: SwipeDeckUndoMotion.timing({ from: 'up' }),
    });

    expect(horizontalMotion.from.translateX).toBeLessThan(-600);
    expect(horizontalMotion.from.translateY).toBe(0);
    expect(upwardMotion.from.translateX).toBe(0);
    expect(upwardMotion.from.translateY).toBeLessThan(-600);
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
        translateY: 0,
      },
    });
  });
});
