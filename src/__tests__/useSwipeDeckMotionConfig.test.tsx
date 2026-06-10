import { describe, expect, it } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import { Easing } from 'react-native-reanimated';

import type { SwipeDeckActionMotionRecipe, SwipeDeckUndoMotionRecipe } from '../types';

import { useSwipeDeckMotionConfig } from '../hooks/useSwipeDeckMotionConfig';
import { SwipeDeckActionMotion } from '../motion/actionMotion';
import { SwipeDeckMotion } from '../motion/animation';
import { SwipeDeckUndoMotion } from '../motion/undoMotion';

describe('useSwipeDeckMotionConfig', () => {
  it('preserves factory/root motion merge and root threshold overrides', async () => {
    const factoryMotion = SwipeDeckMotion.tinder({
      drag: { mode: 'horizontal', liftYFactor: 0.2 },
      rotation: { mode: 'grab-position', maxDegrees: 24 },
      dismiss: { threshold: 90, velocityThreshold: 600, minDuration: 100 },
    });
    const rootMotion = SwipeDeckMotion.tinder({
      drag: { liftYFactor: 0.4 },
      dismiss: { maxDuration: 260 },
    });

    const { result } = await renderHook(() =>
      useSwipeDeckMotionConfig({
        factoryMotion,
        layout: { width: 400, height: 600 },
        motion: rootMotion,
        swipeThreshold: ({ width }) => width * 0.25,
        velocityThreshold: 900,
      }),
    );

    expect(result.current.cardMotionConfig.drag).toEqual({
      mode: 'horizontal',
      liftYFactor: 0.4,
    });
    expect(result.current.cardMotionConfig.rotation).toMatchObject({
      mode: 'grab-position',
      maxDegrees: 24,
    });
    expect(result.current.dismissMinDuration).toBe(100);
    expect(result.current.dismissMaxDuration).toBe(260);
    expect(result.current.resolvedSwipeThreshold).toBe(100);
    expect(result.current.resolvedVelocityThreshold).toBe(900);
  });

  it('keeps motion refs stable while refreshing current recipes on rerender', async () => {
    const factoryActionMotion = SwipeDeckActionMotion.direct({ duration: 100 });
    const initialActionMotion = SwipeDeckActionMotion.springboard({ anticipationDuration: 120 });
    const nextActionMotion = SwipeDeckActionMotion.direct({ duration: 220 });
    const factoryUndoMotion = SwipeDeckUndoMotion.timing({ duration: 10 });
    const initialUndoMotion = SwipeDeckUndoMotion.spring({ springConfig: { damping: 24 } });
    const nextUndoMotion = SwipeDeckUndoMotion.timing({ duration: 330 });

    const { result, rerender } = await renderHook(
      (props: {
        actionMotion: SwipeDeckActionMotionRecipe;
        undoMotion: SwipeDeckUndoMotionRecipe;
      }) =>
        useSwipeDeckMotionConfig({
          actionMotion: props.actionMotion,
          factoryActionMotion,
          factoryUndoMotion,
          layout: { width: 300, height: 500 },
          undoMotion: props.undoMotion,
        }),
      {
        initialProps: {
          actionMotion: initialActionMotion,
          undoMotion: initialUndoMotion,
        },
      },
    );
    const actionMotionRef = result.current.actionMotionRef;
    const undoMotionRef = result.current.undoMotionRef;

    expect(actionMotionRef.current).toBe(initialActionMotion);
    expect(undoMotionRef.current).toBe(initialUndoMotion);

    await rerender({
      actionMotion: nextActionMotion,
      undoMotion: nextUndoMotion,
    });

    expect(result.current.actionMotionRef).toBe(actionMotionRef);
    expect(result.current.undoMotionRef).toBe(undoMotionRef);
    expect(result.current.actionMotionRef.current).toBe(nextActionMotion);
    expect(result.current.undoMotionRef.current).toBe(nextUndoMotion);
  });

  it('keeps dismiss runtime ref stable while refreshing layout-dependent runtime values', async () => {
    const initialMotion = SwipeDeckMotion.tinder({
      rotation: { mode: 'fixed', origin: 'center', maxDegrees: 20 },
      dismiss: {
        duration: 200,
        easing: Easing.linear,
        offscreenMultiplier: 1.2,
      },
    });
    const nextMotion = SwipeDeckMotion.tinder({
      rotation: { mode: 'fixed', origin: 'bottom-center', maxDegrees: 25 },
      dismiss: {
        duration: 500,
        offscreenMultiplier: 2,
      },
    });

    const { result, rerender } = await renderHook(
      (props: { motion: typeof initialMotion; width: number }) =>
        useSwipeDeckMotionConfig({
          layout: { width: props.width, height: 500 },
          motion: props.motion,
        }),
      {
        initialProps: {
          motion: initialMotion,
          width: 300,
        },
      },
    );
    const dismissRuntimeRef = result.current.dismissRuntimeRef;

    await waitFor(() => {
      expect(result.current.dismissRuntimeRef.current?.duration).toBe(200);
    });
    expect(dismissRuntimeRef.current).toMatchObject({
      offscreenMultiplier: 1.2,
      rotationMaxDegrees: 20,
      rotationOrigin: 'center',
    });

    await rerender({
      motion: nextMotion,
      width: 400,
    });

    expect(result.current.dismissRuntimeRef).toBe(dismissRuntimeRef);
    await waitFor(() => {
      expect(result.current.dismissRuntimeRef.current?.duration).toBe(500);
    });
    expect(dismissRuntimeRef.current).toMatchObject({
      offscreenMultiplier: 2,
      rotationMaxDegrees: 25,
      rotationOrigin: 'bottom-center',
    });
  });
});
