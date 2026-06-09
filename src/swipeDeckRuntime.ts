import type { SwipeDeckRenderedCardMotionConfig } from './SwipeDeckRenderedCard';
import type {
  SwipeDeckActionMotionRecipe,
  SwipeDeckLayout,
  SwipeDeckMotionEasing,
  SwipeDeckUndoMotionRecipe,
  SwipeDirection,
} from './types';

import { resolveSwipeDeckActionMotion, resolveSwipeDeckActionMotionRecipe } from './actionMotion';
import { resolveSwipeDeckDismissDestinationDistance } from './animation';
import { resolveSwipeDeckUndoMotion, resolveSwipeDeckUndoMotionRecipe } from './undoMotion';

type SwipeDeckProgrammaticDismissRuntime = {
  duration?: number;
  easing: SwipeDeckMotionEasing;
  offscreenMultiplier: number;
};

type SwipeDeckProgrammaticUndoRuntime = SwipeDeckProgrammaticDismissRuntime & {
  rotationDirection: SwipeDeckRenderedCardMotionConfig['rotation']['direction'];
  rotationMaxDegrees: number;
  rotationMode: SwipeDeckRenderedCardMotionConfig['rotation']['mode'];
  rotationOrigin: SwipeDeckRenderedCardMotionConfig['rotation']['origin'];
};

type ResolveSwipeDeckProgrammaticActionMotionArgs = {
  actionMotion?: SwipeDeckActionMotionRecipe;
  defaultActionMotion?: SwipeDeckActionMotionRecipe;
  layout: SwipeDeckLayout;
  runtime: SwipeDeckProgrammaticDismissRuntime | null;
};

type ResolveSwipeDeckProgrammaticUndoMotionArgs = {
  defaultUndoMotion?: SwipeDeckUndoMotionRecipe;
  direction: SwipeDirection;
  layout: SwipeDeckLayout;
  runtime: SwipeDeckProgrammaticUndoRuntime;
  undoMotion?: SwipeDeckUndoMotionRecipe;
};

export function resolveProgressDirection(translationX: number): -1 | 0 | 1 {
  'worklet';

  if (translationX < 0) {
    return -1;
  }

  if (translationX > 0) {
    return 1;
  }

  return 0;
}

export function resolveSignedSwipeProgress(translationX: number, distance: number): number {
  'worklet';

  const direction = resolveProgressDirection(translationX);

  return direction * Math.min(Math.abs(translationX) / Math.max(distance, 1), 1);
}

export function getActiveRenderItemId(dataLength: number, activeIndex: number): number {
  if (activeIndex < 0 || activeIndex >= dataLength) {
    return -1;
  }

  return activeIndex;
}

export function resolveSwipeDeckProgrammaticActionMotion({
  actionMotion,
  defaultActionMotion,
  layout,
  runtime,
}: ResolveSwipeDeckProgrammaticActionMotionArgs): ReturnType<
  typeof resolveSwipeDeckActionMotion
> | null {
  if (!runtime) {
    return null;
  }

  return resolveSwipeDeckActionMotion({
    fallback: {
      dismissDuration: runtime.duration,
      dismissEasing: runtime.easing,
      offscreenMultiplier: runtime.offscreenMultiplier,
    },
    layout,
    recipe: resolveSwipeDeckActionMotionRecipe({
      defaultActionMotion,
      actionMotion,
    }),
  });
}

export function resolveSwipeDeckProgrammaticUndoMotion({
  defaultUndoMotion,
  direction,
  layout,
  runtime,
  undoMotion,
}: ResolveSwipeDeckProgrammaticUndoMotionArgs): ReturnType<typeof resolveSwipeDeckUndoMotion> {
  const defaultEntryDistance = resolveSwipeDeckDismissDestinationDistance({
    offscreenMultiplier: runtime.offscreenMultiplier,
    layout,
    rotationMaxDegrees: runtime.rotationMaxDegrees,
    rotationMode: runtime.rotationMode,
    rotationOrigin: runtime.rotationOrigin,
    rotationDirection: runtime.rotationDirection,
    gestureStartYRatio: 0.5,
    swipeDirection: direction,
  });

  return resolveSwipeDeckUndoMotion({
    defaultEntryDistance,
    layout,
    originalDirection: direction,
    recipe: resolveSwipeDeckUndoMotionRecipe({
      defaultUndoMotion,
      undoMotion,
    }),
  });
}
