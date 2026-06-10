import { describe, expect, it } from '@jest/globals';
import { Easing } from 'react-native-reanimated';

import {
  mergeSwipeDeckMotionPreset,
  resolveSwipeDeckDismissDestinationDistance,
  resolveSwipeDeckDismissDuration,
  resolveSwipeDeckDragTranslateY,
  resolveSwipeDeckGestureStartYRatio,
  resolveSwipeDeckMotionConfig,
  resolveSwipeDeckTinderRotationSign,
  resolveSwipeDeckTinderTransformOrigin,
  SwipeDeckMotion,
} from '../motion/animation';

describe('SwipeDeckMotion', () => {
  it('creates a discriminated tinder motion preset', () => {
    expect(SwipeDeckMotion.tinder({ nextScale: 0.9 })).toMatchObject({
      type: 'tinder',
      config: { nextScale: 0.9 },
    });
  });

  it('uses default tinder-like motion values', () => {
    const motion = resolveSwipeDeckMotionConfig(undefined, {
      width: 300,
      height: 500,
    });

    expect(motion).toMatchObject({
      nextScale: 0.95,
      nextOpacity: 1,
      nextTranslateY: 12,
      swipeProgressDistance: 120,
      drag: {
        mode: 'free',
        liftYFactor: 0,
      },
      rotation: {
        mode: 'grab-position',
        maxDegrees: 18,
        inputRange: 300,
      },
      dismiss: {
        minDuration: 120,
        maxDuration: 320,
      },
    });
    expect(motion.dismiss.offscreenMultiplier).toBe(1.5);
    expect(typeof motion.dismiss.easing).toBe('function');
  });

  it('resolves custom tinder motion values', () => {
    const motion = resolveSwipeDeckMotionConfig(
      SwipeDeckMotion.tinder({
        nextScale: 0.9,
        nextOpacity: 0.8,
        nextTranslateY: 24,
        swipeProgressDistance: ({ width }) => width / 2,
        drag: {
          mode: 'horizontal',
          liftYFactor: 0.3,
        },
        rotation: {
          mode: 'grab-position',
          direction: 'reverse',
          maxDegrees: 25,
          inputRange: ({ width }) => width * 0.75,
        },
        dismiss: {
          threshold: ({ width }) => width * 0.3,
          offscreenMultiplier: 1.1,
          velocityThreshold: 600,
          minDuration: 100,
          maxDuration: 280,
          easing: Easing.linear,
        },
      }),
      { width: 400, height: 500 },
    );

    expect(motion).toMatchObject({
      nextScale: 0.9,
      nextOpacity: 0.8,
      nextTranslateY: 24,
      swipeProgressDistance: 200,
      drag: {
        mode: 'horizontal',
        liftYFactor: 0.3,
      },
      rotation: {
        mode: 'grab-position',
        direction: 'reverse',
        maxDegrees: 25,
        inputRange: 300,
      },
      dismiss: {
        threshold: 120,
        velocityThreshold: 600,
        minDuration: 100,
        maxDuration: 280,
      },
    });
    expect(motion.dismiss.offscreenMultiplier).toBe(1.1);
    expect(typeof motion.dismiss.easing).toBe('function');
  });

  it('uses a softer default rotation for bottom-center origin', () => {
    const motion = resolveSwipeDeckMotionConfig(
      SwipeDeckMotion.tinder({
        rotation: {
          mode: 'fixed',
          origin: 'bottom-center',
        },
      }),
      { width: 300, height: 500 },
    );

    expect(motion.rotation).toMatchObject({
      origin: 'bottom-center',
      maxDegrees: 18,
    });
  });

  it('uses a softer default rotation for top-center origin', () => {
    const motion = resolveSwipeDeckMotionConfig(
      SwipeDeckMotion.tinder({
        rotation: {
          mode: 'fixed',
          origin: 'top-center',
        },
      }),
      { width: 300, height: 500 },
    );

    expect(motion.rotation).toMatchObject({
      origin: 'top-center',
      maxDegrees: 18,
    });
  });

  it('uses a softer default rotation for grab-position mode', () => {
    const motion = resolveSwipeDeckMotionConfig(
      SwipeDeckMotion.tinder({
        rotation: {
          mode: 'grab-position',
        },
      }),
      { width: 300, height: 500 },
    );

    expect(motion.rotation).toMatchObject({
      mode: 'grab-position',
      maxDegrees: 18,
    });
  });

  it('keeps explicit edge rotation degrees', () => {
    const motion = resolveSwipeDeckMotionConfig(
      SwipeDeckMotion.tinder({
        rotation: {
          mode: 'fixed',
          origin: 'bottom-center',
          maxDegrees: 25,
        },
      }),
      { width: 300, height: 500 },
    );

    expect(motion.rotation).toMatchObject({
      origin: 'bottom-center',
      maxDegrees: 25,
    });
  });

  it('resolves fixed reverse rotation direction', () => {
    const motion = resolveSwipeDeckMotionConfig(
      SwipeDeckMotion.tinder({
        rotation: {
          mode: 'fixed',
          origin: 'top-center',
          direction: 'reverse',
        },
      }),
      { width: 300, height: 500 },
    );

    expect(motion.rotation).toMatchObject({
      mode: 'fixed',
      origin: 'top-center',
      direction: 'reverse',
    });
  });

  it('deep merges factory motion with root overrides', () => {
    const factoryMotion = SwipeDeckMotion.tinder({
      drag: { mode: 'horizontal', liftYFactor: 0.2 },
      rotation: { mode: 'grab-position', maxDegrees: 25 },
      dismiss: { velocityThreshold: 600, minDuration: 100 },
    });
    const rootMotion = SwipeDeckMotion.tinder({
      drag: { liftYFactor: 0.4 },
      rotation: { mode: 'grab-position', maxDegrees: 12 },
      dismiss: { maxDuration: 240 },
    });

    expect(mergeSwipeDeckMotionPreset(factoryMotion, rootMotion)).toMatchObject({
      type: 'tinder',
      config: {
        drag: {
          mode: 'horizontal',
          liftYFactor: 0.4,
        },
        rotation: {
          mode: 'grab-position',
          maxDegrees: 12,
        },
        dismiss: {
          velocityThreshold: 600,
          minDuration: 100,
          maxDuration: 240,
        },
      },
    });
  });

  it('drops fixed rotation fields when root switches to grab-position mode', () => {
    expect(
      mergeSwipeDeckMotionPreset(
        SwipeDeckMotion.tinder({
          rotation: {
            mode: 'fixed',
            origin: 'bottom-center',
            direction: 'reverse',
            maxDegrees: 24,
          },
        }),
        SwipeDeckMotion.tinder({
          rotation: { mode: 'grab-position' },
        }),
      ),
    ).toMatchObject({
      type: 'tinder',
      config: {
        rotation: {
          mode: 'grab-position',
          maxDegrees: 24,
        },
      },
    });
  });

  it('switches grab-position rotation back to fixed when root provides fixed fields', () => {
    expect(
      mergeSwipeDeckMotionPreset(
        SwipeDeckMotion.tinder({
          rotation: { mode: 'grab-position', maxDegrees: 24 },
        }),
        SwipeDeckMotion.tinder({
          rotation: { mode: 'fixed', origin: 'top-center' },
        }),
      ),
    ).toMatchObject({
      type: 'tinder',
      config: {
        rotation: {
          mode: 'fixed',
          origin: 'top-center',
          maxDegrees: 24,
        },
      },
    });
  });

  it('updates origin default degrees when an origin-only root override changes origin', () => {
    const motion = resolveSwipeDeckMotionConfig(
      mergeSwipeDeckMotionPreset(
        SwipeDeckMotion.tinder(),
        SwipeDeckMotion.tinder({
          rotation: { mode: 'fixed', origin: 'bottom-center' },
        }),
      ),
      { width: 300, height: 500 },
    );

    expect(motion.rotation).toMatchObject({
      origin: 'bottom-center',
      maxDegrees: 18,
    });
  });

  it('keeps custom rotation degrees when an origin-only root override changes origin', () => {
    const motion = resolveSwipeDeckMotionConfig(
      mergeSwipeDeckMotionPreset(
        SwipeDeckMotion.tinder({ rotation: { mode: 'grab-position', maxDegrees: 28 } }),
        SwipeDeckMotion.tinder({
          rotation: { mode: 'fixed', origin: 'bottom-center' },
        }),
      ),
      { width: 300, height: 500 },
    );

    expect(motion.rotation).toMatchObject({
      origin: 'bottom-center',
      maxDegrees: 28,
    });
  });

  it('keeps explicit rotation degrees equal to preset defaults', () => {
    const centerDefault = resolveSwipeDeckMotionConfig(
      mergeSwipeDeckMotionPreset(
        SwipeDeckMotion.tinder({ rotation: { mode: 'fixed', maxDegrees: 20 } }),
        SwipeDeckMotion.tinder({
          rotation: { mode: 'fixed', origin: 'bottom-center' },
        }),
      ),
      { width: 300, height: 500 },
    );
    const bottomCenterDefault = resolveSwipeDeckMotionConfig(
      mergeSwipeDeckMotionPreset(
        SwipeDeckMotion.tinder({ rotation: { mode: 'fixed', maxDegrees: 18 } }),
        SwipeDeckMotion.tinder({
          rotation: { mode: 'fixed', origin: 'center' },
        }),
      ),
      { width: 300, height: 500 },
    );

    expect(centerDefault.rotation).toMatchObject({
      origin: 'bottom-center',
      maxDegrees: 20,
    });
    expect(bottomCenterDefault.rotation).toMatchObject({
      origin: 'center',
      maxDegrees: 18,
    });
  });

  it('normalizes low offscreen multipliers', () => {
    const motion = resolveSwipeDeckMotionConfig(
      SwipeDeckMotion.tinder({
        dismiss: { offscreenMultiplier: 0.5 },
      }),
      { width: 400, height: 500 },
    );

    expect(motion.dismiss.offscreenMultiplier).toBe(1);
  });
});

describe('resolveSwipeDeckDismissDestinationDistance', () => {
  it('resolves the release target from the rotated card bounds', () => {
    expect(
      resolveSwipeDeckDismissDestinationDistance({
        offscreenMultiplier: 1,
        layout: { width: 300, height: 500 },
        rotationMaxDegrees: 18,
        rotationMode: 'grab-position',
        gestureStartYRatio: 0.25,
        swipeDirection: 'right',
      }),
    ).toBeCloseTo(447.17);
    expect(
      resolveSwipeDeckDismissDestinationDistance({
        offscreenMultiplier: 1,
        layout: { width: 300, height: 500 },
        rotationMaxDegrees: 18,
        rotationMode: 'grab-position',
        gestureStartYRatio: 0.75,
        swipeDirection: 'right',
      }),
    ).toBeCloseTo(447.17);
  });

  it('keeps reverse grab-position releases symmetric for upper and lower grabs', () => {
    expect(
      resolveSwipeDeckDismissDestinationDistance({
        offscreenMultiplier: 1,
        layout: { width: 300, height: 500 },
        rotationMaxDegrees: 18,
        rotationMode: 'grab-position',
        rotationDirection: 'reverse',
        gestureStartYRatio: 0.25,
        swipeDirection: 'right',
      }),
    ).toBeCloseTo(292.66);
    expect(
      resolveSwipeDeckDismissDestinationDistance({
        offscreenMultiplier: 1,
        layout: { width: 300, height: 500 },
        rotationMaxDegrees: 18,
        rotationMode: 'grab-position',
        rotationDirection: 'reverse',
        gestureStartYRatio: 0.75,
        swipeDirection: 'right',
      }),
    ).toBeCloseTo(292.66);
  });

  it('applies offscreen multiplier to the actual clear distance', () => {
    expect(
      resolveSwipeDeckDismissDestinationDistance({
        offscreenMultiplier: 1.2,
        layout: { width: 300, height: 500 },
        rotationMaxDegrees: 18,
        rotationMode: 'grab-position',
        gestureStartYRatio: 0.25,
        swipeDirection: 'right',
      }),
    ).toBeCloseTo(536.6);
    expect(
      resolveSwipeDeckDismissDestinationDistance({
        offscreenMultiplier: 0.5,
        layout: { width: 300, height: 500 },
        rotationMaxDegrees: 18,
        rotationMode: 'grab-position',
        gestureStartYRatio: 0.25,
        swipeDirection: 'right',
      }),
    ).toBeCloseTo(447.17);
  });
});

describe('resolveSwipeDeckDismissDuration', () => {
  it('uses fixed duration when provided', () => {
    expect(
      resolveSwipeDeckDismissDuration({
        translationX: 80,
        velocityX: 500,
        destinationX: 450,
        duration: 180,
        minDuration: 120,
        maxDuration: 320,
      }),
    ).toBe(180);
  });

  it('derives duration from release velocity and clamps it', () => {
    expect(
      resolveSwipeDeckDismissDuration({
        translationX: 100,
        velocityX: 1000,
        destinationX: 300,
        minDuration: 120,
        maxDuration: 320,
      }),
    ).toBe(200);
    expect(
      resolveSwipeDeckDismissDuration({
        translationX: 100,
        velocityX: -1000,
        destinationX: 300,
        minDuration: 120,
        maxDuration: 320,
      }),
    ).toBe(320);
    expect(
      resolveSwipeDeckDismissDuration({
        translationX: -100,
        velocityX: -1000,
        destinationX: -300,
        minDuration: 120,
        maxDuration: 320,
      }),
    ).toBe(200);
    expect(
      resolveSwipeDeckDismissDuration({
        translationX: 100,
        velocityX: 10_000,
        destinationX: 300,
        minDuration: 120,
        maxDuration: 320,
      }),
    ).toBe(120);
    expect(
      resolveSwipeDeckDismissDuration({
        translationX: 100,
        velocityX: 1,
        destinationX: 300,
        minDuration: 120,
        maxDuration: 320,
      }),
    ).toBe(320);
  });
});

describe('resolveSwipeDeckDragTranslateY', () => {
  it('follows vertical finger movement in free mode', () => {
    expect(
      resolveSwipeDeckDragTranslateY({
        mode: 'free',
        liftYFactor: 0.25,
        translationX: 80,
        translationY: 30,
      }),
    ).toBe(10);
  });

  it('ignores vertical finger movement in horizontal mode', () => {
    expect(
      resolveSwipeDeckDragTranslateY({
        mode: 'horizontal',
        liftYFactor: 0.25,
        translationX: 80,
        translationY: 30,
      }),
    ).toBe(-20);
  });
});

describe('resolveSwipeDeckTinderRotationSign', () => {
  it('keeps fixed origins on the default rotation sign', () => {
    expect(
      resolveSwipeDeckTinderRotationSign({
        mode: 'fixed',
        gestureStartYRatio: 0.25,
      }),
    ).toBe(1);
    expect(
      resolveSwipeDeckTinderRotationSign({
        mode: 'fixed',
        gestureStartYRatio: 0.25,
      }),
    ).toBe(1);
    expect(
      resolveSwipeDeckTinderRotationSign({
        mode: 'fixed',
        gestureStartYRatio: 0.75,
      }),
    ).toBe(1);
  });

  it('reverses fixed rotation when direction is reverse', () => {
    expect(
      resolveSwipeDeckTinderRotationSign({
        mode: 'fixed',
        direction: 'reverse',
        gestureStartYRatio: 0.75,
      }),
    ).toBe(-1);
  });

  it('keeps upper-half grab-position rotation on the default sign', () => {
    expect(
      resolveSwipeDeckTinderRotationSign({
        mode: 'grab-position',
        gestureStartYRatio: 0.25,
      }),
    ).toBe(1);
  });

  it('reverses lower-half grab-position rotation on the default mapping', () => {
    expect(
      resolveSwipeDeckTinderRotationSign({
        mode: 'grab-position',
        gestureStartYRatio: 0.75,
      }),
    ).toBe(-1);
  });

  it('flips grab-position mapping when direction is reverse', () => {
    expect(
      resolveSwipeDeckTinderRotationSign({
        mode: 'grab-position',
        direction: 'reverse',
        gestureStartYRatio: 0.25,
      }),
    ).toBe(-1);
    expect(
      resolveSwipeDeckTinderRotationSign({
        mode: 'grab-position',
        direction: 'reverse',
        gestureStartYRatio: 0.75,
      }),
    ).toBe(1);
  });
});

describe('resolveSwipeDeckGestureStartYRatio', () => {
  it('normalizes gesture start y against the deck height', () => {
    expect(resolveSwipeDeckGestureStartYRatio({ y: 25, height: 100 })).toBe(0.25);
    expect(resolveSwipeDeckGestureStartYRatio({ y: 75, height: 100 })).toBe(0.75);
  });

  it('clamps gesture start y ratio', () => {
    expect(resolveSwipeDeckGestureStartYRatio({ y: -10, height: 100 })).toBe(0);
    expect(resolveSwipeDeckGestureStartYRatio({ y: 110, height: 100 })).toBe(1);
  });

  it('falls back to center when gesture y cannot be read', () => {
    expect(resolveSwipeDeckGestureStartYRatio({ y: undefined, height: 100 })).toBe(0.5);
    expect(resolveSwipeDeckGestureStartYRatio({ y: Number.NaN, height: 100 })).toBe(0.5);
    expect(resolveSwipeDeckGestureStartYRatio({ y: 20, height: 0 })).toBe(0.5);
  });
});

describe('resolveSwipeDeckTinderTransformOrigin', () => {
  it('keeps center origin as the platform default transform origin', () => {
    expect(
      resolveSwipeDeckTinderTransformOrigin({
        mode: 'fixed',
        origin: 'center',
        gestureStartYRatio: 0.8,
      }),
    ).toBeUndefined();
  });

  it('keeps bottom-center origin fixed to the bottom edge', () => {
    expect(
      resolveSwipeDeckTinderTransformOrigin({
        mode: 'fixed',
        origin: 'bottom-center',
        gestureStartYRatio: 0.25,
      }),
    ).toEqual(['50%', '100%', 0]);
  });

  it('keeps top-center origin fixed to the top edge', () => {
    expect(
      resolveSwipeDeckTinderTransformOrigin({
        mode: 'fixed',
        origin: 'top-center',
        gestureStartYRatio: 0.75,
      }),
    ).toEqual(['50%', '0%', 0]);
  });

  it('uses the top edge for upper-half grab-position origin', () => {
    expect(
      resolveSwipeDeckTinderTransformOrigin({
        mode: 'grab-position',
        gestureStartYRatio: 0.25,
      }),
    ).toEqual(['50%', '0%', 0]);
  });

  it('uses the bottom edge for lower-half grab-position origin', () => {
    expect(
      resolveSwipeDeckTinderTransformOrigin({
        mode: 'grab-position',
        gestureStartYRatio: 0.75,
      }),
    ).toEqual(['50%', '100%', 0]);
  });

  it('uses the bottom edge for centered grab-position origin', () => {
    expect(
      resolveSwipeDeckTinderTransformOrigin({
        mode: 'grab-position',
        gestureStartYRatio: 0.5,
      }),
    ).toEqual(['50%', '100%', 0]);
  });
});
