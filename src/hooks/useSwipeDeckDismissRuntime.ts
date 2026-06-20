import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { useCallback, useLayoutEffect, useRef } from 'react';
import { withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { SwipeDeckDirectionPolicy } from '../core/directions';
import type { SwipeDeckRenderedCardMotionConfig } from '../core/renderedCardMotionTypes';
import type {
  SwipeDeckActionMotionRecipe,
  SwipeDeckEventMap,
  SwipeDeckInteractionPhase,
  SwipeDeckLayout,
  SwipeDeckMotionEasing,
  SwipeDirection,
  SwipeEventSource,
} from '../types';

import { isSwipeDirectionAllowed } from '../core/directions';
import { getSwipeCommit, shouldDeferActiveItemSync } from '../core/state';
import {
  resetSwipeDeckInteractionSignals,
  resolveSwipeDeckProgrammaticActionMotion,
} from '../core/swipeDeckRuntime';
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
  allowedDirectionPolicyRef: RefObject<SwipeDeckDirectionPolicy>;
  applyImmediateRuntimeState: (isAnimating: boolean, isDragging: boolean) => void;
  attachmentGeneration: SharedValue<number>;
  attachmentGenerationRef: RefObject<number>;
  cancelActiveInteractionAnimations: () => void;
  dataRef: RefObject<readonly T[]>;
  disabledRef: RefObject<boolean>;
  dismissRuntimeRef: RefObject<SwipeDeckDismissRuntime | null>;
  dismissDirection: SharedValue<SwipeDirection | null>;
  dragItemIndex: SharedValue<number>;
  endReachedRef: RefObject<boolean>;
  emitDeckEvent: <K extends keyof SwipeDeckEventMap<T>>(
    eventName: K,
    event: SwipeDeckEventMap<T>[K],
  ) => void;
  gestureStartYRatio: SharedValue<number>;
  isAnimating: SharedValue<boolean>;
  isDragging: SharedValue<boolean>;
  interactionPhase: SharedValue<SwipeDeckInteractionPhase>;
  layoutRef: RefObject<SwipeDeckLayout>;
  recordSwipeForUndo: RecordSwipeForUndo<T>;
  setActiveIndex: Dispatch<SetStateAction<number>>;
  setEndReached: Dispatch<SetStateAction<boolean>>;
  signedSwipeProgress: SharedValue<number>;
  swipeDirectionSignal: SharedValue<-1 | 0 | 1>;
  swipeProgress: SharedValue<number>;
};

type UseSwipeDeckDismissRuntimeResult = {
  /**
   * Shared dismiss completion boundary for every accepted swipe source.
   *
   * Keep all future gesture/action dismiss entry points on this path so `SwipeEvent.source` remains
   * commit-time truth instead of an app- or caller-inferred label.
   */
  completeSwipeDismiss: (
    finished: boolean | undefined,
    currentAttachmentGeneration: number,
    direction: SwipeDirection,
    source: SwipeEventSource,
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
  allowedDirectionPolicyRef,
  applyImmediateRuntimeState,
  attachmentGeneration,
  attachmentGenerationRef,
  cancelActiveInteractionAnimations,
  dataRef,
  disabledRef,
  dismissRuntimeRef,
  dismissDirection,
  dragItemIndex,
  endReachedRef,
  emitDeckEvent,
  gestureStartYRatio,
  isAnimating,
  isDragging,
  interactionPhase,
  layoutRef,
  recordSwipeForUndo,
  setActiveIndex,
  setEndReached,
  signedSwipeProgress,
  swipeDirectionSignal,
  swipeProgress,
}: UseSwipeDeckDismissRuntimeArgs<T>): UseSwipeDeckDismissRuntimeResult {
  const pendingCommitResetRef = useRef(false);

  const commitSwipe = useCallback(
    (direction: SwipeDirection, source: SwipeEventSource) => {
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
      emitDeckEvent('swipe', { item, index: commit.swipedIndex, direction, source });
      emitDeckEvent('indexChange', { index: commit.nextIndex });
      activeIndexRef.current = commit.nextIndex;
      pendingCommitResetRef.current = true;
      setActiveIndex(commit.nextIndex);

      if (commit.shouldEmitEndReached) {
        endReachedRef.current = true;
        setEndReached(true);
        emitDeckEvent('endReached', true);
      }
    },
    [
      activeIndexRef,
      dataRef,
      endReachedRef,
      emitDeckEvent,
      recordSwipeForUndo,
      setActiveIndex,
      setEndReached,
    ],
  );

  const commitSwipeIfCurrent = useCallback(
    (generation: number, direction: SwipeDirection, source: SwipeEventSource) => {
      if (generation !== attachmentGenerationRef.current) {
        return;
      }

      commitSwipe(direction, source);
    },
    [attachmentGenerationRef, commitSwipe],
  );

  const resetInteractionAfterDismiss = useCallback(() => {
    cancelActiveInteractionAnimations();
    activeTranslateX.set(0);
    activeTranslateY.set(0);
    resetSwipeDeckInteractionSignals({
      dismissDirection,
      signedSwipeProgress,
      swipeDirectionSignal,
      swipeProgress,
    });
    isDragging.set(false);
    interactionPhase.set('idle');
    gestureStartYRatio.set(0.5);
    dragItemIndex.set(-1);
  }, [
    activeTranslateX,
    activeTranslateY,
    cancelActiveInteractionAnimations,
    dismissDirection,
    dragItemIndex,
    gestureStartYRatio,
    isDragging,
    interactionPhase,
    signedSwipeProgress,
    swipeDirectionSignal,
    swipeProgress,
  ]);

  const completeSwipeDismiss = useCallback(
    (
      finished: boolean | undefined,
      currentAttachmentGeneration: number,
      direction: SwipeDirection,
      source: SwipeEventSource,
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
      scheduleOnRN(commitSwipeIfCurrent, currentAttachmentGeneration, direction, source);
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
      const currentAttachmentGeneration = attachmentGenerationRef.current;

      if (!isSwipeDirectionAllowed(direction, allowedDirectionPolicyRef.current)) {
        return false;
      }

      if (!runtime) {
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

      const actionRuntime = resolveSwipeDeckProgrammaticActionMotion({
        actionMotion: motionOverride,
        defaultActionMotion: actionMotionRef.current,
        layout: currentLayout,
        runtime,
      });

      if (!actionRuntime) {
        return false;
      }

      isAnimating.set(true);
      isDragging.set(true);
      interactionPhase.set('dismissing');
      dismissDirection.set(direction);
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

        completeSwipeDismiss(finished, currentAttachmentGeneration, direction, 'programmatic');
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
      allowedDirectionPolicyRef,
      applyImmediateRuntimeState,
      attachmentGeneration,
      attachmentGenerationRef,
      completeSwipeDismiss,
      dataRef,
      disabledRef,
      dismissRuntimeRef,
      dismissDirection,
      dragItemIndex,
      gestureStartYRatio,
      isAnimating,
      isDragging,
      interactionPhase,
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
