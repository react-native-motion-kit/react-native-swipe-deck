import type { RefObject } from 'react';
import type { WithSpringConfig } from 'react-native-reanimated';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import type { SwipeDeckRenderedCardMotionConfig } from '../components/SwipeDeckRenderedCard';
import type {
  SwipeDeckActionMotionRecipe,
  SwipeDeckLayout,
  SwipeDeckMotionEasing,
  SwipeDeckMotionPreset,
  SwipeDeckUndoMotionRecipe,
} from '../types';

import { resolveSwipeDeckActionMotionRecipe } from '../motion/actionMotion';
import { mergeSwipeDeckMotionPreset, resolveSwipeDeckMotionConfig } from '../motion/animation';
import { resolveSwipeDeckUndoMotionRecipe } from '../motion/undoMotion';

type SwipeDeckDismissRuntime = {
  duration?: number;
  easing: SwipeDeckMotionEasing;
  maxDuration: number;
  minDuration: number;
  offscreenMultiplier: number;
  rotationDirection: SwipeDeckRenderedCardMotionConfig['rotation']['direction'];
  rotationMaxDegrees: number;
  rotationMode: SwipeDeckRenderedCardMotionConfig['rotation']['mode'];
  rotationOrigin: SwipeDeckRenderedCardMotionConfig['rotation']['origin'];
};

type UseSwipeDeckMotionConfigArgs = {
  actionMotion?: SwipeDeckActionMotionRecipe;
  factoryActionMotion?: SwipeDeckActionMotionRecipe;
  factoryMotion?: SwipeDeckMotionPreset;
  factoryUndoMotion?: SwipeDeckUndoMotionRecipe;
  layout: SwipeDeckLayout;
  motion?: SwipeDeckMotionPreset;
  swipeThreshold?: number | ((layout: SwipeDeckLayout) => number);
  undoMotion?: SwipeDeckUndoMotionRecipe;
  velocityThreshold?: number;
};

type SwipeDeckMotionConfigResult = {
  actionMotionRef: RefObject<SwipeDeckActionMotionRecipe | undefined>;
  cardMotionConfig: SwipeDeckRenderedCardMotionConfig;
  cancelSpringConfig?: WithSpringConfig;
  dismissDuration?: number;
  dismissEasing: SwipeDeckMotionEasing;
  dismissMaxDuration: number;
  dismissMinDuration: number;
  dismissOffscreenMultiplier: number;
  dismissRuntimeRef: RefObject<SwipeDeckDismissRuntime | null>;
  resolvedSwipeThreshold?: number;
  resolvedVelocityThreshold?: number;
  swipeProgressDistance: number;
  undoMotionRef: RefObject<SwipeDeckUndoMotionRecipe | undefined>;
};

export function useSwipeDeckMotionConfig({
  actionMotion,
  factoryActionMotion,
  factoryMotion,
  factoryUndoMotion,
  layout,
  motion,
  swipeThreshold,
  undoMotion,
  velocityThreshold,
}: UseSwipeDeckMotionConfigArgs): SwipeDeckMotionConfigResult {
  const actionMotionRef = useRef<SwipeDeckActionMotionRecipe | undefined>(
    resolveSwipeDeckActionMotionRecipe({
      defaultActionMotion: factoryActionMotion,
      rootActionMotion: actionMotion,
    }),
  );
  const undoMotionRef = useRef<SwipeDeckUndoMotionRecipe | undefined>(
    resolveSwipeDeckUndoMotionRecipe({
      defaultUndoMotion: factoryUndoMotion,
      rootUndoMotion: undoMotion,
    }),
  );
  const dismissRuntimeRef = useRef<SwipeDeckDismissRuntime | null>(null);
  const motionConfig = useMemo(() => {
    const rootMotion = mergeSwipeDeckMotionPreset(factoryMotion, motion);

    return resolveSwipeDeckMotionConfig(rootMotion, {
      width: layout.width,
      height: layout.height,
    });
  }, [factoryMotion, layout.height, layout.width, motion]);
  const cardMotionConfig = useMemo<SwipeDeckRenderedCardMotionConfig>(
    () => ({
      nextScale: motionConfig.nextScale,
      nextOpacity: motionConfig.nextOpacity,
      nextTranslateY: motionConfig.nextTranslateY,
      drag: {
        mode: motionConfig.drag.mode,
        liftYFactor: motionConfig.drag.liftYFactor,
      },
      rotation: {
        mode: motionConfig.rotation.mode,
        origin: motionConfig.rotation.origin,
        direction: motionConfig.rotation.direction,
        maxDegrees: motionConfig.rotation.maxDegrees,
        inputRange: motionConfig.rotation.inputRange,
      },
    }),
    [motionConfig],
  );
  const resolvedSwipeThreshold =
    typeof swipeThreshold === 'function'
      ? swipeThreshold(layout)
      : (swipeThreshold ?? motionConfig.dismiss.threshold);
  const resolvedVelocityThreshold = velocityThreshold ?? motionConfig.dismiss.velocityThreshold;
  const cancelSpringConfig = motionConfig.cancelSpringConfig;
  const dismissDuration = motionConfig.dismiss.duration;
  const dismissEasing = motionConfig.dismiss.easing;
  const dismissMaxDuration = motionConfig.dismiss.maxDuration;
  const dismissMinDuration = motionConfig.dismiss.minDuration;
  const dismissOffscreenMultiplier = motionConfig.dismiss.offscreenMultiplier;
  const swipeProgressDistance = motionConfig.swipeProgressDistance;

  // Action and undo controls can be called from descendants immediately after a prop rerender,
  // so their recipes refresh in layout effects before those controls can observe stale refs.
  useLayoutEffect(() => {
    actionMotionRef.current = resolveSwipeDeckActionMotionRecipe({
      defaultActionMotion: factoryActionMotion,
      rootActionMotion: actionMotion,
    });
  }, [actionMotion, factoryActionMotion]);

  useLayoutEffect(() => {
    undoMotionRef.current = resolveSwipeDeckUndoMotionRecipe({
      defaultUndoMotion: factoryUndoMotion,
      rootUndoMotion: undoMotion,
    });
  }, [factoryUndoMotion, undoMotion]);

  // Dismiss runtime is only consumed by user-driven gesture/action callbacks after commit,
  // so it preserves the previous passive-effect timing from SwipeDeck.tsx.
  useEffect(() => {
    dismissRuntimeRef.current = {
      duration: dismissDuration,
      easing: dismissEasing,
      maxDuration: dismissMaxDuration,
      minDuration: dismissMinDuration,
      offscreenMultiplier: dismissOffscreenMultiplier,
      rotationDirection: cardMotionConfig.rotation.direction,
      rotationMaxDegrees: cardMotionConfig.rotation.maxDegrees,
      rotationMode: cardMotionConfig.rotation.mode,
      rotationOrigin: cardMotionConfig.rotation.origin,
    };
  }, [
    cardMotionConfig.rotation.direction,
    cardMotionConfig.rotation.maxDegrees,
    cardMotionConfig.rotation.mode,
    cardMotionConfig.rotation.origin,
    dismissDuration,
    dismissEasing,
    dismissMaxDuration,
    dismissMinDuration,
    dismissOffscreenMultiplier,
  ]);

  return {
    actionMotionRef,
    cardMotionConfig,
    cancelSpringConfig,
    dismissDuration,
    dismissEasing,
    dismissMaxDuration,
    dismissMinDuration,
    dismissOffscreenMultiplier,
    dismissRuntimeRef,
    resolvedSwipeThreshold,
    resolvedVelocityThreshold,
    swipeProgressDistance,
    undoMotionRef,
  };
}
