import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { useCallback, useLayoutEffect, useRef } from 'react';
import { withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { SwipeDeckRenderedCardMotionConfig } from '../core/renderedCardMotionTypes';
import type {
  SwipeDeckActionMotionRecipe,
  SwipeDeckLayout,
  SwipeDeckMotionEasing,
  SwipeDirection,
} from '../types';

import { getSwipeCommit, shouldDeferActiveItemSync } from '../core/state';
import { resolveSwipeDeckProgrammaticActionMotion } from '../core/swipeDeckRuntime';
import {
  resolveSwipeDeckDismissDestinationDistance,
  resolveSwipeDeckDismissDuration,
} from '../motion/animation';

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

type RecordSwipeForUndo<T> = (event: {
  direction: SwipeDirection;
  index: number;
  item: T;
}) => boolean;

type UseSwipeDeckDismissRuntimeArgs<T> = {
  actionMotionRef: RefObject<SwipeDeckActionMotionRecipe | undefined>;
  activeIndex: number;
  activeIndexRef: RefObject<number>;
  activeItemIndex: SharedValue<number>;
  activeRenderItemId: number;
  activeTranslateX: SharedValue<number>;
  activeTranslateY: SharedValue<number>;
  applyImmediateRuntimeState: (isAnimating: boolean, isDragging: boolean) => void;
  attachmentGeneration: SharedValue<number>;
  attachmentGenerationRef: RefObject<number>;
  cancelActiveInteractionAnimations: () => void;
  dataRef: RefObject<readonly T[]>;
  disabledRef: RefObject<boolean>;
  dismissRuntimeRef: RefObject<SwipeDeckDismissRuntime | null>;
  dragItemIndex: SharedValue<number>;
  endReachedRef: RefObject<boolean>;
  gestureStartYRatio: SharedValue<number>;
  isAnimating: SharedValue<boolean>;
  isDragging: SharedValue<boolean>;
  layoutRef: RefObject<SwipeDeckLayout>;
  onEndReachedRef: RefObject<(() => void) | undefined>;
  onIndexChangeRef: RefObject<((index: number) => void) | undefined>;
  onSwipeRef: RefObject<
    ((event: { direction: SwipeDirection; index: number; item: T }) => void) | undefined
  >;
  recordSwipeForUndo: RecordSwipeForUndo<T>;
  setActiveIndex: Dispatch<SetStateAction<number>>;
  setEndReached: Dispatch<SetStateAction<boolean>>;
  signedSwipeProgress: SharedValue<number>;
  swipeDirectionSignal: SharedValue<-1 | 0 | 1>;
  swipeProgress: SharedValue<number>;
};

type UseSwipeDeckDismissRuntimeResult = {
  completeSwipeDismiss: (
    finished: boolean | undefined,
    currentAttachmentGeneration: number,
    direction: SwipeDirection,
  ) => void;
  swipeProgrammatically: (
    direction: SwipeDirection,
    motionOverride?: SwipeDeckActionMotionRecipe,
  ) => boolean;
};

/**
 * Owns the dismiss -> commit -> post-dismiss reset runtime.
 *
 * Root intentionally keeps registry attachment, render composition, and public deck-state
 * publication. This hook uses `activeIndex` only to synchronize the active render item and
 * post-dismiss reset after React commits the next index.
 *
 * That split keeps external snapshot publication in Root while preserving the timing-sensitive
 * ordering between UI-runtime dismiss completion, RN commit callbacks, and final reset.
 */
export function useSwipeDeckDismissRuntime<T>({
  actionMotionRef,
  activeIndex,
  activeIndexRef,
  activeItemIndex,
  activeRenderItemId,
  activeTranslateX,
  activeTranslateY,
  applyImmediateRuntimeState,
  attachmentGeneration,
  attachmentGenerationRef,
  cancelActiveInteractionAnimations,
  dataRef,
  disabledRef,
  dismissRuntimeRef,
  dragItemIndex,
  endReachedRef,
  gestureStartYRatio,
  isAnimating,
  isDragging,
  layoutRef,
  onEndReachedRef,
  onIndexChangeRef,
  onSwipeRef,
  recordSwipeForUndo,
  setActiveIndex,
  setEndReached,
  signedSwipeProgress,
  swipeDirectionSignal,
  swipeProgress,
}: UseSwipeDeckDismissRuntimeArgs<T>): UseSwipeDeckDismissRuntimeResult {
  const pendingCommitResetRef = useRef(false);

  const commitSwipe = useCallback(
    (direction: SwipeDirection) => {
      const currentData = dataRef.current;
      const commit = getSwipeCommit(
        currentData.length,
        activeIndexRef.current,
        endReachedRef.current,
      );

      if (!commit) {
        return;
      }

      const item = currentData[commit.swipedIndex] as T;

      recordSwipeForUndo({ item, index: commit.swipedIndex, direction });
      onSwipeRef.current?.({ item, index: commit.swipedIndex, direction });
      onIndexChangeRef.current?.(commit.nextIndex);
      activeIndexRef.current = commit.nextIndex;
      pendingCommitResetRef.current = true;
      setActiveIndex(commit.nextIndex);

      if (commit.shouldEmitEndReached) {
        endReachedRef.current = true;
        setEndReached(true);
        onEndReachedRef.current?.();
      }
    },
    [
      activeIndexRef,
      dataRef,
      endReachedRef,
      onEndReachedRef,
      onIndexChangeRef,
      onSwipeRef,
      recordSwipeForUndo,
      setActiveIndex,
      setEndReached,
    ],
  );

  const commitSwipeIfCurrent = useCallback(
    (generation: number, direction: SwipeDirection) => {
      if (generation !== attachmentGenerationRef.current) {
        return;
      }

      commitSwipe(direction);
    },
    [attachmentGenerationRef, commitSwipe],
  );

  const resetInteractionAfterDismiss = useCallback(() => {
    cancelActiveInteractionAnimations();
    activeTranslateX.set(0);
    activeTranslateY.set(0);
    swipeProgress.set(0);
    signedSwipeProgress.set(0);
    swipeDirectionSignal.set(0);
    isDragging.set(false);
    gestureStartYRatio.set(0.5);
    dragItemIndex.set(-1);
  }, [
    activeTranslateX,
    activeTranslateY,
    cancelActiveInteractionAnimations,
    dragItemIndex,
    gestureStartYRatio,
    isDragging,
    signedSwipeProgress,
    swipeDirectionSignal,
    swipeProgress,
  ]);

  const completeSwipeDismiss = useCallback(
    (
      finished: boolean | undefined,
      currentAttachmentGeneration: number,
      direction: SwipeDirection,
    ) => {
      'worklet';

      if (!finished || currentAttachmentGeneration !== attachmentGeneration.get()) {
        return;
      }

      const nextActiveItemIndex = activeItemIndex.get() + 1;

      activeItemIndex.set(nextActiveItemIndex);
      activeTranslateX.set(0);
      activeTranslateY.set(0);
      swipeProgress.set(0);
      signedSwipeProgress.set(0);
      swipeDirectionSignal.set(0);
      isDragging.set(false);
      dragItemIndex.set(-1);
      scheduleOnRN(commitSwipeIfCurrent, currentAttachmentGeneration, direction);
    },
    [
      activeItemIndex,
      activeTranslateX,
      activeTranslateY,
      attachmentGeneration,
      commitSwipeIfCurrent,
      dragItemIndex,
      isDragging,
      signedSwipeProgress,
      swipeDirectionSignal,
      swipeProgress,
    ],
  );

  const swipeProgrammatically = useCallback(
    (direction: SwipeDirection, motionOverride?: SwipeDeckActionMotionRecipe) => {
      const currentData = dataRef.current;
      const currentIndex = activeIndexRef.current;
      const currentLayout = layoutRef.current;
      const runtime = dismissRuntimeRef.current;
      const actionRuntime = resolveSwipeDeckProgrammaticActionMotion({
        actionMotion: motionOverride,
        defaultActionMotion: actionMotionRef.current,
        layout: currentLayout,
        runtime,
      });
      const currentAttachmentGeneration = attachmentGenerationRef.current;

      if (!runtime || !actionRuntime) {
        return false;
      }

      if (disabledRef.current || isAnimating.get() || isDragging.get()) {
        return false;
      }

      if (currentLayout.width <= 0 || currentLayout.height <= 0) {
        return false;
      }

      if (currentIndex < 0 || currentIndex >= currentData.length) {
        return false;
      }

      isAnimating.set(true);
      isDragging.set(true);
      applyImmediateRuntimeState(true, true);
      gestureStartYRatio.set(0.5);
      dragItemIndex.set(activeItemIndex.get());

      const destinationDistance = resolveSwipeDeckDismissDestinationDistance({
        offscreenMultiplier: actionRuntime.offscreenMultiplier,
        layout: currentLayout,
        rotationMaxDegrees: runtime.rotationMaxDegrees,
        rotationMode: runtime.rotationMode,
        rotationOrigin: runtime.rotationOrigin,
        rotationDirection: runtime.rotationDirection,
        gestureStartYRatio: 0.5,
        swipeDirection: direction,
      });
      const exitX = direction === 'right' ? destinationDistance : -destinationDistance;
      const progressDirection = direction === 'right' ? 1 : -1;
      const resolvedDismissDuration = resolveSwipeDeckDismissDuration({
        translationX: activeTranslateX.get(),
        velocityX: 0,
        destinationX: exitX,
        duration: actionRuntime.dismissDuration,
        minDuration: runtime.minDuration,
        maxDuration: runtime.maxDuration,
      });
      const dismissTimingConfig = {
        duration: resolvedDismissDuration,
        easing: actionRuntime.dismissEasing,
      };
      const handleDismissCompletion = (finished: boolean | undefined) => {
        'worklet';

        completeSwipeDismiss(finished, currentAttachmentGeneration, direction);
      };

      if (actionRuntime.type === 'springboard') {
        const anticipationTimingConfig = {
          duration: actionRuntime.anticipationDuration,
          easing: actionRuntime.anticipationEasing,
        };
        const anticipationX = -progressDirection * actionRuntime.anticipationDistance;
        const handleAnticipationCompletion = (finished: boolean | undefined) => {
          'worklet';

          if (!finished || currentAttachmentGeneration !== attachmentGeneration.get()) {
            return;
          }

          swipeDirectionSignal.set(progressDirection);
        };

        swipeDirectionSignal.set(0);
        signedSwipeProgress.set(
          withSequence(
            withTiming(0, anticipationTimingConfig),
            withTiming(progressDirection, dismissTimingConfig),
          ),
        );
        swipeProgress.set(
          withSequence(withTiming(0, anticipationTimingConfig), withTiming(1, dismissTimingConfig)),
        );
        activeTranslateY.set(
          withSequence(withTiming(0, anticipationTimingConfig), withTiming(0, dismissTimingConfig)),
        );
        activeTranslateX.set(
          withSequence(
            withTiming(anticipationX, anticipationTimingConfig, handleAnticipationCompletion),
            withTiming(exitX, dismissTimingConfig, handleDismissCompletion),
          ),
        );

        return true;
      }

      swipeDirectionSignal.set(progressDirection);
      signedSwipeProgress.set(withTiming(progressDirection, dismissTimingConfig));
      swipeProgress.set(withTiming(1, dismissTimingConfig));
      activeTranslateY.set(withTiming(0, dismissTimingConfig));
      activeTranslateX.set(withTiming(exitX, dismissTimingConfig, handleDismissCompletion));

      return true;
    },
    [
      actionMotionRef,
      activeIndexRef,
      activeItemIndex,
      activeTranslateX,
      activeTranslateY,
      applyImmediateRuntimeState,
      attachmentGeneration,
      attachmentGenerationRef,
      completeSwipeDismiss,
      dataRef,
      disabledRef,
      dismissRuntimeRef,
      dragItemIndex,
      gestureStartYRatio,
      isAnimating,
      isDragging,
      layoutRef,
      signedSwipeProgress,
      swipeDirectionSignal,
      swipeProgress,
    ],
  );

  useLayoutEffect(() => {
    activeIndexRef.current = activeIndex;

    const hasPendingCommitReset = pendingCommitResetRef.current;

    if (shouldDeferActiveItemSync(isAnimating.get(), hasPendingCommitReset)) {
      return;
    }

    activeItemIndex.set(activeRenderItemId);

    if (!hasPendingCommitReset) {
      return;
    }

    pendingCommitResetRef.current = false;
    resetInteractionAfterDismiss();
    isAnimating.set(false);
    applyImmediateRuntimeState(false, false);
  }, [
    activeIndex,
    activeIndexRef,
    activeItemIndex,
    activeRenderItemId,
    applyImmediateRuntimeState,
    isAnimating,
    resetInteractionAfterDismiss,
  ]);

  return {
    completeSwipeDismiss,
    swipeProgrammatically,
  };
}
