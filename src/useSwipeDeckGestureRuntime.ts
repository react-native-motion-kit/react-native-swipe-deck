import type { SharedValue, WithSpringConfig } from 'react-native-reanimated';

import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { SwipeDeckRenderedCardMotionConfig } from './SwipeDeckRenderedCard';
import type { SwipeDeckLayout, SwipeDeckMotionEasing, SwipeDirection } from './types';

import {
  resolveSwipeDeckDismissDestinationDistance,
  resolveSwipeDeckDismissDuration,
  resolveSwipeDeckGestureStartYRatio,
} from './animation';
import { resolveSwipeDirection } from './directions';
import { resolveProgressDirection, resolveSignedSwipeProgress } from './swipeDeckRuntime';

type CompleteSwipeDismiss = (
  finished: boolean | undefined,
  currentAttachmentGeneration: number,
  direction: SwipeDirection,
) => void;

type ApplyScheduledRuntimeState = (
  eventId: number,
  isAnimating: boolean,
  isDragging: boolean,
) => void;

type UseSwipeDeckGestureRuntimeArgs = {
  activeItemIndex: SharedValue<number>;
  activeTranslateX: SharedValue<number>;
  activeTranslateY: SharedValue<number>;
  applyScheduledRuntimeState: ApplyScheduledRuntimeState;
  attachmentGeneration: SharedValue<number>;
  cancelSpringConfig?: WithSpringConfig;
  cardMotionConfig: SwipeDeckRenderedCardMotionConfig;
  completeSwipeDismiss: CompleteSwipeDismiss;
  disabled: boolean;
  dismissDuration?: number;
  dismissEasing: SwipeDeckMotionEasing;
  dismissMaxDuration: number;
  dismissMinDuration: number;
  dismissOffscreenMultiplier: number;
  dragItemIndex: SharedValue<number>;
  gestureStartYRatio: SharedValue<number>;
  hasActiveCard: boolean;
  isAnimating: SharedValue<boolean>;
  isDragging: SharedValue<boolean>;
  layout: SwipeDeckLayout;
  resolvedSwipeThreshold?: number;
  resolvedVelocityThreshold?: number;
  runtimeEventId: SharedValue<number>;
  signedSwipeProgress: SharedValue<number>;
  swipeDirectionSignal: SharedValue<-1 | 0 | 1>;
  swipeProgress: SharedValue<number>;
  swipeProgressDistance: number;
};

/**
 * Owns only the pan gesture lifecycle and pan-local guards.
 *
 * Shared interaction values are passed in because SwipeDeck still owns programmatic swipe, undo,
 * render-window, and registry state transitions that must stay synchronized with the same values.
 */
export function useSwipeDeckGestureRuntime({
  activeItemIndex,
  activeTranslateX,
  activeTranslateY,
  applyScheduledRuntimeState,
  attachmentGeneration,
  cancelSpringConfig,
  cardMotionConfig,
  completeSwipeDismiss,
  disabled,
  dismissDuration,
  dismissEasing,
  dismissMaxDuration,
  dismissMinDuration,
  dismissOffscreenMultiplier,
  dragItemIndex,
  gestureStartYRatio,
  hasActiveCard,
  isAnimating,
  isDragging,
  layout,
  resolvedSwipeThreshold,
  resolvedVelocityThreshold,
  runtimeEventId,
  signedSwipeProgress,
  swipeDirectionSignal,
  swipeProgress,
  swipeProgressDistance,
}: UseSwipeDeckGestureRuntimeArgs): ReturnType<typeof Gesture.Pan> {
  const hasHandledGestureEnd = useSharedValue(false);
  const shouldIgnoreGesture = useSharedValue(false);

  return useMemo(
    () =>
      Gesture.Pan()
        .withTestId('swipe-deck-pan')
        .enabled(hasActiveCard && !disabled)
        .onBegin((event) => {
          hasHandledGestureEnd.set(false);

          if (isAnimating.get()) {
            shouldIgnoreGesture.set(true);
            return;
          }

          shouldIgnoreGesture.set(false);
          const nextRuntimeEventId = runtimeEventId.get() + 1;

          runtimeEventId.set(nextRuntimeEventId);
          isDragging.set(true);
          swipeDirectionSignal.set(0);
          signedSwipeProgress.set(0);
          scheduleOnRN(applyScheduledRuntimeState, nextRuntimeEventId, false, true);
          gestureStartYRatio.set(
            resolveSwipeDeckGestureStartYRatio({
              y: event.y,
              height: layout.height,
            }),
          );
          dragItemIndex.set(activeItemIndex.get());
        })
        .onStart(() => {
          if (shouldIgnoreGesture.get() || isAnimating.get()) {
            return;
          }

          dragItemIndex.set(activeItemIndex.get());
        })
        .onUpdate((event) => {
          if (shouldIgnoreGesture.get() || isAnimating.get()) {
            return;
          }

          if (dragItemIndex.get() < 0) {
            dragItemIndex.set(activeItemIndex.get());
          }

          activeTranslateX.set(event.translationX);
          activeTranslateY.set(event.translationY);
          swipeProgress.set(
            Math.min(Math.abs(event.translationX) / Math.max(swipeProgressDistance, 1), 1),
          );
          signedSwipeProgress.set(
            resolveSignedSwipeProgress(event.translationX, swipeProgressDistance),
          );
          swipeDirectionSignal.set(resolveProgressDirection(event.translationX));
        })
        .onEnd((event) => {
          hasHandledGestureEnd.set(true);

          if (shouldIgnoreGesture.get() || isAnimating.get()) {
            return;
          }

          const direction = resolveSwipeDirection({
            translationX: event.translationX,
            velocityX: event.velocityX,
            disabled: disabled || !hasActiveCard,
            layout,
            swipeThreshold: resolvedSwipeThreshold,
            velocityThreshold: resolvedVelocityThreshold,
          });

          if (dragItemIndex.get() < 0) {
            dragItemIndex.set(activeItemIndex.get());
          }

          if (!direction) {
            activeTranslateX.set(
              withSpring(0, cancelSpringConfig, (finished) => {
                if (finished) {
                  dragItemIndex.set(-1);
                  isAnimating.set(false);
                  isDragging.set(false);
                  swipeDirectionSignal.set(0);
                  const nextRuntimeEventId = runtimeEventId.get() + 1;

                  runtimeEventId.set(nextRuntimeEventId);
                  gestureStartYRatio.set(0.5);
                  scheduleOnRN(applyScheduledRuntimeState, nextRuntimeEventId, false, false);
                }
              }),
            );
            activeTranslateY.set(withSpring(0, cancelSpringConfig));
            swipeProgress.set(withSpring(0, cancelSpringConfig));
            signedSwipeProgress.set(withSpring(0, cancelSpringConfig));
            return;
          }

          isAnimating.set(true);
          isDragging.set(true);
          const currentAttachmentGeneration = attachmentGeneration.get();

          scheduleOnRN(applyScheduledRuntimeState, runtimeEventId.get(), true, true);
          const destinationDistance = resolveSwipeDeckDismissDestinationDistance({
            offscreenMultiplier: dismissOffscreenMultiplier,
            layout,
            rotationMaxDegrees: cardMotionConfig.rotation.maxDegrees,
            rotationMode: cardMotionConfig.rotation.mode,
            rotationOrigin: cardMotionConfig.rotation.origin,
            rotationDirection: cardMotionConfig.rotation.direction,
            gestureStartYRatio: gestureStartYRatio.get(),
            swipeDirection: direction,
          });
          const exitX = direction === 'right' ? destinationDistance : -destinationDistance;
          const resolvedDismissDuration = resolveSwipeDeckDismissDuration({
            translationX: event.translationX,
            velocityX: event.velocityX,
            destinationX: exitX,
            duration: dismissDuration,
            minDuration: dismissMinDuration,
            maxDuration: dismissMaxDuration,
          });
          const dismissTimingConfig = {
            duration: resolvedDismissDuration,
            easing: dismissEasing,
          };

          swipeDirectionSignal.set(direction === 'right' ? 1 : -1);
          signedSwipeProgress.set(withTiming(direction === 'right' ? 1 : -1, dismissTimingConfig));
          swipeProgress.set(withTiming(1, dismissTimingConfig));
          activeTranslateX.set(
            withTiming(exitX, dismissTimingConfig, (finished) => {
              'worklet';

              completeSwipeDismiss(finished, currentAttachmentGeneration, direction);
            }),
          );
        })
        .onFinalize(() => {
          if (shouldIgnoreGesture.get()) {
            shouldIgnoreGesture.set(false);
            return;
          }

          if (hasHandledGestureEnd.get() || isAnimating.get()) {
            return;
          }

          activeTranslateX.set(0);
          activeTranslateY.set(0);
          swipeProgress.set(0);
          signedSwipeProgress.set(0);
          swipeDirectionSignal.set(0);
          isDragging.set(false);
          dragItemIndex.set(-1);
          const nextRuntimeEventId = runtimeEventId.get() + 1;

          runtimeEventId.set(nextRuntimeEventId);
          gestureStartYRatio.set(0.5);
          scheduleOnRN(applyScheduledRuntimeState, nextRuntimeEventId, false, false);
        }),
    [
      activeItemIndex,
      activeTranslateX,
      activeTranslateY,
      applyScheduledRuntimeState,
      attachmentGeneration,
      cancelSpringConfig,
      cardMotionConfig.rotation.direction,
      cardMotionConfig.rotation.maxDegrees,
      cardMotionConfig.rotation.mode,
      cardMotionConfig.rotation.origin,
      completeSwipeDismiss,
      disabled,
      dismissDuration,
      dismissEasing,
      dismissMaxDuration,
      dismissMinDuration,
      dismissOffscreenMultiplier,
      dragItemIndex,
      gestureStartYRatio,
      hasActiveCard,
      hasHandledGestureEnd,
      isAnimating,
      isDragging,
      layout,
      resolvedSwipeThreshold,
      resolvedVelocityThreshold,
      runtimeEventId,
      shouldIgnoreGesture,
      signedSwipeProgress,
      swipeDirectionSignal,
      swipeProgress,
      swipeProgressDistance,
    ],
  );
}
