import type { SharedValue } from 'react-native-reanimated';

import type {
  SwipeDeckActionMotionRecipe,
  SwipeDeckLayout,
  SwipeDeckMotionEasing,
  SwipeDeckTinderDragMode,
  SwipeDeckUndoMotionRecipe,
  SwipeDirection,
} from '../types';
import type { SwipeDeckDirectionPolicy } from './directions';
import type { SwipeDeckRenderedCardMotionConfig } from './renderedCardMotionTypes';

import {
  resolveSwipeDeckActionMotion,
  resolveSwipeDeckActionMotionRecipe,
} from '../motion/actionMotion';
import { resolveSwipeDeckDismissDestination } from '../motion/animation';
import {
  resolveSwipeDeckUndoEntryDirection,
  resolveSwipeDeckUndoMotion,
  resolveSwipeDeckUndoMotionRecipe,
} from '../motion/undoMotion';
import { resolveAllowedSwipeDirection, resolveSwipeIntentWinner } from './directions';

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

type ResetSwipeDeckInteractionSignalsArgs = {
  dismissDirection: SharedValue<SwipeDirection | null>;
  intentDirection: SharedValue<SwipeDirection | null>;
  signedSwipeProgress: SharedValue<number>;
  swipeDirectionSignal: SharedValue<-1 | 0 | 1>;
  swipeProgress: SharedValue<number>;
};

type SwipeDeckLiveProgressIntent = {
  direction: -1 | 0 | 1;
  intentDirection: SwipeDirection | null;
  progress: number;
  signedProgress: number;
};

const DEFAULT_LIVE_DIRECTION_POLICY: SwipeDeckDirectionPolicy = {
  left: true,
  right: true,
  up: false,
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

export function resolveSwipeDirectionSignal(direction: SwipeDirection): -1 | 0 | 1 {
  'worklet';

  if (direction === 'left') {
    return -1;
  }

  if (direction === 'right') {
    return 1;
  }

  return 0;
}

export function resolveSignedSwipeProgress(translationX: number, distance: number): number {
  'worklet';

  const direction = resolveProgressDirection(translationX);

  return direction * Math.min(Math.abs(translationX) / Math.max(distance, 1), 1);
}

export function resolveSwipeProgressIntent({
  translationX,
  translationY,
  distance,
  directionPolicy,
  dragMode = 'free',
}: {
  translationX: number;
  translationY: number;
  distance: number;
  directionPolicy?: SwipeDeckDirectionPolicy;
  dragMode?: SwipeDeckTinderDragMode;
}): SwipeDeckLiveProgressIntent {
  'worklet';

  const normalizedDistance = Math.max(distance, 1);
  const policy = directionPolicy ?? DEFAULT_LIVE_DIRECTION_POLICY;
  const horizontalDirectionSignal = resolveProgressDirection(translationX);
  const horizontalDirection =
    horizontalDirectionSignal === -1 ? 'left' : horizontalDirectionSignal === 1 ? 'right' : null;
  const horizontalProgress = Math.abs(translationX) / normalizedDistance;
  const canResolveUp = policy.up === true && dragMode === 'free';
  const upwardProgress = canResolveUp ? Math.max(-translationY, 0) / normalizedDistance : 0;
  const rawWinner = resolveSwipeIntentWinner({
    horizontalDirection,
    horizontalQualified: horizontalDirection !== null,
    horizontalScore: horizontalProgress,
    upwardQualified: canResolveUp && translationY < 0,
    upwardScore: upwardProgress,
  });
  const intentDirection = resolveAllowedSwipeDirection(rawWinner, policy);

  if (!intentDirection) {
    return {
      direction: 0,
      intentDirection: null,
      progress: 0,
      signedProgress: 0,
    };
  }

  if (intentDirection === 'up') {
    const clampedUpwardProgress = Math.min(upwardProgress, 1);

    return {
      direction: 0,
      intentDirection,
      progress: clampedUpwardProgress,
      signedProgress: 0,
    };
  }

  const clampedHorizontalProgress = Math.min(horizontalProgress, 1);
  const resolvedHorizontalDirection = resolveSwipeDirectionSignal(intentDirection);

  return {
    direction: resolvedHorizontalDirection,
    intentDirection,
    progress: clampedHorizontalProgress,
    signedProgress: resolvedHorizontalDirection * clampedHorizontalProgress,
  };
}

export function resolveSwipeProgress({
  translationX,
  translationY,
  distance,
  directionPolicy,
  dragMode,
}: {
  translationX: number;
  translationY: number;
  distance: number;
  directionPolicy?: SwipeDeckDirectionPolicy;
  dragMode?: SwipeDeckTinderDragMode;
}): number {
  'worklet';

  return resolveSwipeProgressIntent({
    translationX,
    translationY,
    distance,
    directionPolicy,
    dragMode,
  }).progress;
}

export function resetSwipeDeckInteractionSignals({
  dismissDirection,
  intentDirection,
  signedSwipeProgress,
  swipeDirectionSignal,
  swipeProgress,
}: ResetSwipeDeckInteractionSignalsArgs) {
  'worklet';

  swipeProgress.set(0);
  signedSwipeProgress.set(0);
  swipeDirectionSignal.set(0);
  dismissDirection.set(null);
  intentDirection.set(null);
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
  const recipe = resolveSwipeDeckUndoMotionRecipe({
    defaultUndoMotion,
    undoMotion,
  });
  const entryDirection = resolveSwipeDeckUndoEntryDirection(recipe?.from, direction);
  const defaultDestination = resolveSwipeDeckDismissDestination({
    offscreenMultiplier: runtime.offscreenMultiplier,
    layout,
    rotationMaxDegrees: runtime.rotationMaxDegrees,
    rotationMode: runtime.rotationMode,
    rotationOrigin: runtime.rotationOrigin,
    rotationDirection: runtime.rotationDirection,
    gestureStartYRatio: 0.5,
    swipeDirection: entryDirection,
    translationX: 0,
    translationY: 0,
  });
  const defaultEntryDistance =
    defaultDestination.axis === 'x'
      ? Math.abs(defaultDestination.translateX)
      : Math.abs(defaultDestination.translateY);

  return resolveSwipeDeckUndoMotion({
    defaultEntryDistance,
    layout,
    originalDirection: direction,
    recipe,
  });
}
