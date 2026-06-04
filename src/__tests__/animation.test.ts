import { describe, expect, it } from '@jest/globals';
import { Easing } from 'react-native-reanimated';

import {
  mergeSwipeDeckMotionPreset,
  resolveSwipeDeckDismissDuration,
  resolveSwipeDeckMotionConfig,
  SwipeDeckMotion,
} from '../animation';

describe('SwipeDeckMotion', () => {
  it('creates a discriminated tinder motion preset', () => {
    expect(SwipeDeckMotion.tinder({ nextScale: 0.9 })).toMatchObject({
      type: 'tinder',
      config: { nextScale: 0.9 },
    });
  });

  it('uses default tinder motion values', () => {
    const motion = resolveSwipeDeckMotionConfig(undefined, {
      width: 300,
      height: 500,
    });

    expect(motion).toMatchObject({
      nextScale: 0.95,
      nextOpacity: 1,
      nextTranslateY: 12,
      swipeProgressDistance: 120,
      rotation: {
        origin: 'center',
        maxDegrees: 20,
        inputRange: 300,
      },
      liftYFactor: 0,
      dismiss: {
        destinationDistance: 450,
        minDuration: 120,
        maxDuration: 320,
      },
    });
    expect(typeof motion.dismiss.easing).toBe('function');
  });

  it('resolves custom tinder motion values', () => {
    const motion = resolveSwipeDeckMotionConfig(
      SwipeDeckMotion.tinder({
        nextScale: 0.9,
        nextOpacity: 0.8,
        nextTranslateY: 24,
        swipeProgressDistance: ({ width }) => width / 2,
        rotation: {
          origin: 'bottom-center',
          maxDegrees: 25,
          inputRange: ({ width }) => width * 0.75,
        },
        liftYFactor: 0.3,
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
      rotation: {
        origin: 'bottom-center',
        maxDegrees: 25,
        inputRange: 300,
      },
      liftYFactor: 0.3,
      dismiss: {
        threshold: 120,
        velocityThreshold: 600,
        minDuration: 100,
        maxDuration: 280,
      },
    });
    expect(motion.dismiss.destinationDistance).toBeCloseTo(440);
    expect(typeof motion.dismiss.easing).toBe('function');
  });

  it('uses a softer default rotation for bottom-center origin', () => {
    const motion = resolveSwipeDeckMotionConfig(
      SwipeDeckMotion.tinder({
        rotation: {
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

  it('keeps explicit bottom-center rotation degrees', () => {
    const motion = resolveSwipeDeckMotionConfig(
      SwipeDeckMotion.tinder({
        rotation: {
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

  it('deep merges factory motion with root overrides', () => {
    const factoryMotion = SwipeDeckMotion.tinder({
      rotation: { origin: 'bottom-center', maxDegrees: 25 },
      dismiss: { velocityThreshold: 600, minDuration: 100 },
    });
    const rootMotion = SwipeDeckMotion.tinder({
      rotation: { maxDegrees: 12 },
      dismiss: { maxDuration: 240 },
    });

    expect(mergeSwipeDeckMotionPreset(factoryMotion, rootMotion)).toMatchObject({
      type: 'tinder',
      config: {
        rotation: {
          origin: 'bottom-center',
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

  it('updates origin default degrees when an origin-only root override changes origin', () => {
    const motion = resolveSwipeDeckMotionConfig(
      mergeSwipeDeckMotionPreset(
        SwipeDeckMotion.tinder(),
        SwipeDeckMotion.tinder({
          rotation: { origin: 'bottom-center' },
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
        SwipeDeckMotion.tinder({ rotation: { maxDegrees: 28 } }),
        SwipeDeckMotion.tinder({
          rotation: { origin: 'bottom-center' },
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
        SwipeDeckMotion.tinder({ rotation: { maxDegrees: 20 } }),
        SwipeDeckMotion.tinder({
          rotation: { origin: 'bottom-center' },
        }),
      ),
      { width: 300, height: 500 },
    );
    const bottomCenterDefault = resolveSwipeDeckMotionConfig(
      mergeSwipeDeckMotionPreset(
        SwipeDeckMotion.tinder({ rotation: { maxDegrees: 18 } }),
        SwipeDeckMotion.tinder({
          rotation: { origin: 'center' },
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

  it('normalizes low offscreen multipliers to one deck width', () => {
    const motion = resolveSwipeDeckMotionConfig(
      SwipeDeckMotion.tinder({
        dismiss: { offscreenMultiplier: 0.5 },
      }),
      { width: 400, height: 500 },
    );

    expect(motion.dismiss.destinationDistance).toBe(400);
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
