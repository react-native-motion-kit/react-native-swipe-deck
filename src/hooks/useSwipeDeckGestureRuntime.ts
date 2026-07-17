import type { SharedValue, WithSpringConfig } from 'react-native-reanimated';

import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { SwipeDeckDirectionPolicy } from '../core/directions';
import type { SwipeDeckRenderedCardMotionConfig } from '../core/renderedCardMotionTypes';
import type {
  SwipeDeckInteractionPhase,
  SwipeDeckLayout,
  SwipeDeckMotionEasing,
  SwipeDirection,
  SwipeEventSource,
} from '../types';

import { resolveSwipeDirection } from '../core/directions';
import { resolveSwipeProgressIntent, resolveSwipeDirectionSignal } from '../core/swipeDeckRuntime';
import {
  resolveSwipeDeckDismissDestination,
  resolveSwipeDeckDismissAxisDuration,
  resolveSwipeDeckGestureStartYRatio,
} from '../motion/animation';

type CompleteSwipeDismiss = (
  finished: boolean | undefined,
  currentAttachmentGeneration: number,
  direction: SwipeDirection,
  source: SwipeEventSource,
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
  allowedDirectionPolicy: SharedValue<SwipeDeckDirectionPolicy>;
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
  dismissDirection: SharedValue<SwipeDirection | null>;
  dragItemIndex: SharedValue<number>;
  gestureStartYRatio: SharedValue<number>;
  hasActiveCard: boolean;
  intentDirection: SharedValue<SwipeDirection | null>;
  isAnimating: SharedValue<boolean>;
  isDragging: SharedValue<boolean>;
  interactionPhase: SharedValue<SwipeDeckInteractionPhase>;
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
  allowedDirectionPolicy,
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
  dismissDirection,
  dragItemIndex,
  gestureStartYRatio,
  hasActiveCard,
  intentDirection,
  isAnimating,
  isDragging,
  interactionPhase,
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
          interactionPhase.set('dragging');
          dismissDirection.set(null);
          intentDirection.set(null);
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
          const progressIntent = resolveSwipeProgressIntent({
            translationX: event.translationX,
            translationY: event.translationY,
            distance: swipeProgressDistance,
            directionPolicy: allowedDirectionPolicy.get(),
            dragMode: cardMotionConfig.drag.mode,
          });

          swipeProgress.set(progressIntent.progress);
          signedSwipeProgress.set(progressIntent.signedProgress);
          swipeDirectionSignal.set(progressIntent.direction);
          intentDirection.set(progressIntent.intentDirection);
        })
        .onEnd((event) => {
          hasHandledGestureEnd.set(true);

          if (shouldIgnoreGesture.get() || isAnimating.get()) {
            return;
          }

          const direction = resolveSwipeDirection({
            translationX: event.translationX,
            translationY: event.translationY,
            velocityX: event.velocityX,
            velocityY: event.velocityY,
            directionPolicy: allowedDirectionPolicy.get(),
            disabled: disabled || !hasActiveCard,
            dragMode: cardMotionConfig.drag.mode,
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
                  interactionPhase.set('idle');
                  dismissDirection.set(null);
                  intentDirection.set(null);
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
          interactionPhase.set('dismissing');
          dismissDirection.set(direction);
          intentDirection.set(direction);
          const currentAttachmentGeneration = attachmentGeneration.get();

          scheduleOnRN(applyScheduledRuntimeState, runtimeEventId.get(), true, true);
          const destination = resolveSwipeDeckDismissDestination({
            offscreenMultiplier: dismissOffscreenMultiplier,
            layout,
            rotationMaxDegrees: cardMotionConfig.rotation.maxDegrees,
            rotationMode: cardMotionConfig.rotation.mode,
            rotationOrigin: cardMotionConfig.rotation.origin,
            rotationDirection: cardMotionConfig.rotation.direction,
            gestureStartYRatio: gestureStartYRatio.get(),
            swipeDirection: direction,
            translationX: event.translationX,
            translationY: event.translationY,
          });
          const resolvedDismissDuration = resolveSwipeDeckDismissAxisDuration({
            translation: destination.axis === 'x' ? event.translationX : event.translationY,
            velocity: destination.axis === 'x' ? event.velocityX : event.velocityY,
            destination: destination.axis === 'x' ? destination.translateX : destination.translateY,
            duration: dismissDuration,
            minDuration: dismissMinDuration,
            maxDuration: dismissMaxDuration,
          });
          const dismissTimingConfig = {
            duration: resolvedDismissDuration,
            easing: dismissEasing,
          };

          const progressDirection = resolveSwipeDirectionSignal(direction);

          swipeDirectionSignal.set(progressDirection);
          signedSwipeProgress.set(withTiming(progressDirection, dismissTimingConfig));
          swipeProgress.set(withTiming(1, dismissTimingConfig));
          activeTranslateY.set(
            withTiming(destination.translateY, dismissTimingConfig, (finished) => {
              'worklet';

              if (destination.axis === 'y') {
                completeSwipeDismiss(finished, currentAttachmentGeneration, direction, 'gesture');
              }
            }),
          );
          activeTranslateX.set(
            withTiming(destination.translateX, dismissTimingConfig, (finished) => {
              'worklet';

              if (destination.axis === 'x') {
                completeSwipeDismiss(finished, currentAttachmentGeneration, direction, 'gesture');
              }
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
          intentDirection.set(null);
          isDragging.set(false);
          interactionPhase.set('idle');
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
      allowedDirectionPolicy,
      applyScheduledRuntimeState,
      attachmentGeneration,
      cancelSpringConfig,
      cardMotionConfig.drag.mode,
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
      dismissDirection,
      dragItemIndex,
      gestureStartYRatio,
      hasActiveCard,
      hasHandledGestureEnd,
      intentDirection,
      isAnimating,
      isDragging,
      interactionPhase,
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
