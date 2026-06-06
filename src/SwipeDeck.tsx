import type { ReactElement, ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import React, {
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { SwipeDeckRenderedCardMotionConfig } from './SwipeDeckRenderedCard';
import type {
  SwipeDeckCardProps,
  SwipeDeckFactoryConfig,
  SwipeDeckInstance,
  SwipeDeckLayout,
  SwipeDeckProps,
  SwipeDeckStatic,
  SwipeDeckStaticRootProps,
  SwipeDirection,
  SwipeDeckMotionPreset,
  SwipeDeckMotionEasing,
} from './types';

import {
  mergeSwipeDeckMotionPreset,
  resolveSwipeDeckDismissDestinationDistance,
  resolveSwipeDeckDismissDuration,
  resolveSwipeDeckGestureStartYRatio,
  resolveSwipeDeckMotionConfig,
} from './animation';
import { getSwipeDeckState } from './deckState';
import { resolveSwipeDirection } from './directions';
import { createSwipeDeckRegistry, type SwipeDeckRegistry } from './registry';
import { getSwipeRenderItems, getSwipeStackRenderItems } from './rendering';
import { getSwipeCommit, shouldDeferActiveItemSync, shouldResetEndReached } from './state';
import { SwipeDeckCard } from './SwipeDeckCard';
import { SwipeDeckRenderedCard } from './SwipeDeckRenderedCard';
import { clampActiveIndex } from './windowing';

function findCardSlot<T>(children: ReactNode): ReactElement<SwipeDeckCardProps<T>> | null {
  const childArray = React.Children.toArray(children);

  for (const child of childArray) {
    if (isValidElement(child) && child.type === SwipeDeckCard) {
      return child as ReactElement<SwipeDeckCardProps<T>>;
    }
  }

  return null;
}

function resolveProgressDirection(translationX: number): -1 | 0 | 1 {
  'worklet';

  if (translationX < 0) {
    return -1;
  }

  if (translationX > 0) {
    return 1;
  }

  return 0;
}

function resolveSignedSwipeProgress(translationX: number, distance: number): number {
  'worklet';

  const direction = resolveProgressDirection(translationX);

  return direction * Math.min(Math.abs(translationX) / Math.max(distance, 1), 1);
}

type SwipeDeckRootProps<T> = SwipeDeckProps<T> & {
  factoryMotion?: SwipeDeckMotionPreset;
  registry: SwipeDeckRegistry;
};

function Root<T>({
  id,
  data,
  getKey,
  initialIndex = 0,
  disabled = false,
  swipeThreshold,
  velocityThreshold,
  motion,
  factoryMotion,
  visibleCardCount,
  containerStyle,
  children,
  onSwipe,
  onIndexChange,
  onEndReached,
  registry,
}: SwipeDeckRootProps<T>): ReactElement {
  const deckStore = useMemo(() => registry.getStore(id), [id, registry]);
  const interaction = deckStore.interaction;
  const [layout, setLayout] = useState<SwipeDeckLayout>({ width: 0, height: 0 });
  const [activeIndex, setActiveIndex] = useState(() => clampActiveIndex(data.length, initialIndex));
  const [endReached, setEndReached] = useState(false);
  const swipeProgress = interaction.progress;
  const signedSwipeProgress = interaction.signedProgress;
  const swipeDirectionSignal = interaction.direction;
  const activeTranslateX = interaction.translationX;
  const activeTranslateY = interaction.translationY;
  const isDragging = interaction.isDragging;
  const dragItemIndex = useSharedValue(-1);
  const activeItemIndex = useSharedValue(-1);
  const gestureStartYRatio = useSharedValue(0.5);
  const hasHandledGestureEnd = useSharedValue(false);
  const shouldIgnoreGesture = useSharedValue(false);
  const attachmentGeneration = useSharedValue(0);
  const runtimeEventId = useSharedValue(0);
  const isAnimating = useSharedValue(false);
  const dataRef = useRef(data);
  const activeIndexRef = useRef(activeIndex);
  const endReachedRef = useRef(endReached);
  const disabledRef = useRef(disabled);
  const layoutRef = useRef(layout);
  const attachmentGenerationRef = useRef(0);
  const runtimeStateRef = useRef({ isAnimating: false, isDragging: false });
  const runtimeEventIdRef = useRef(0);
  const onSwipeRef = useRef(onSwipe);
  const onIndexChangeRef = useRef(onIndexChange);
  const onEndReachedRef = useRef(onEndReached);
  const pendingCommitResetRef = useRef(false);
  const dismissRuntimeRef = useRef<{
    duration?: number;
    easing: SwipeDeckMotionEasing;
    maxDuration: number;
    minDuration: number;
    offscreenMultiplier: number;
    rotationDirection: SwipeDeckRenderedCardMotionConfig['rotation']['direction'];
    rotationMaxDegrees: number;
    rotationMode: SwipeDeckRenderedCardMotionConfig['rotation']['mode'];
    rotationOrigin: SwipeDeckRenderedCardMotionConfig['rotation']['origin'];
  } | null>(null);
  const cardSlot = findCardSlot<T>(children);
  const hasActiveCard = activeIndex >= 0 && activeIndex < data.length;
  const activeRenderItemId = hasActiveCard ? activeIndex : -1;
  const renderItems = getSwipeRenderItems(data, activeIndex, getKey, visibleCardCount);
  const stackRenderItems = getSwipeStackRenderItems(renderItems);
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
    [
      motionConfig.drag.liftYFactor,
      motionConfig.drag.mode,
      motionConfig.nextOpacity,
      motionConfig.nextScale,
      motionConfig.nextTranslateY,
      motionConfig.rotation.direction,
      motionConfig.rotation.inputRange,
      motionConfig.rotation.maxDegrees,
      motionConfig.rotation.mode,
      motionConfig.rotation.origin,
    ],
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

  const getDeckState = useCallback(() => {
    return getSwipeDeckState({
      dataLength: dataRef.current.length,
      activeIndex: activeIndexRef.current,
      disabled: disabledRef.current,
      layout: layoutRef.current,
      isAnimating: runtimeStateRef.current.isAnimating,
      isDragging: runtimeStateRef.current.isDragging,
    });
  }, []);

  const publishDeckStateSnapshot = useCallback(() => {
    deckStore.setSnapshot(getDeckState());
  }, [deckStore, getDeckState]);

  const applyScheduledRuntimeState = useCallback(
    (eventId: number, isAnimatingValue: boolean, isDraggingValue: boolean) => {
      if (eventId < runtimeEventIdRef.current) {
        return;
      }

      runtimeEventIdRef.current = eventId;
      runtimeStateRef.current = {
        isAnimating: isAnimatingValue,
        isDragging: isDraggingValue,
      };
      publishDeckStateSnapshot();
    },
    [publishDeckStateSnapshot],
  );

  const applyImmediateRuntimeState = useCallback(
    (isAnimatingValue: boolean, isDraggingValue: boolean) => {
      const nextEventId = runtimeEventIdRef.current + 1;

      runtimeEventIdRef.current = nextEventId;
      runtimeEventId.set(nextEventId);
      runtimeStateRef.current = {
        isAnimating: isAnimatingValue,
        isDragging: isDraggingValue,
      };
      publishDeckStateSnapshot();
    },
    [publishDeckStateSnapshot, runtimeEventId],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      const nextLayout = { width, height };

      layoutRef.current = nextLayout;
      setLayout(nextLayout);
      publishDeckStateSnapshot();
    },
    [publishDeckStateSnapshot],
  );

  const commitSwipe = useCallback((direction: SwipeDirection) => {
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
  }, []);

  const commitSwipeIfCurrent = useCallback(
    (generation: number, direction: SwipeDirection) => {
      if (generation !== attachmentGenerationRef.current) {
        return;
      }

      commitSwipe(direction);
    },
    [commitSwipe],
  );

  const resetInteractionAfterDismiss = useCallback(() => {
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
    dragItemIndex,
    gestureStartYRatio,
    isDragging,
    signedSwipeProgress,
    swipeDirectionSignal,
    swipeProgress,
  ]);

  const swipeProgrammatically = useCallback(
    (direction: SwipeDirection) => {
      const currentData = dataRef.current;
      const currentIndex = activeIndexRef.current;
      const currentLayout = layoutRef.current;
      const runtime = dismissRuntimeRef.current;
      const currentAttachmentGeneration = attachmentGenerationRef.current;

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

      isAnimating.set(true);
      isDragging.set(true);
      applyImmediateRuntimeState(true, true);
      gestureStartYRatio.set(0.5);
      dragItemIndex.set(activeItemIndex.get());

      const destinationDistance = resolveSwipeDeckDismissDestinationDistance({
        offscreenMultiplier: runtime.offscreenMultiplier,
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
        duration: runtime.duration,
        minDuration: runtime.minDuration,
        maxDuration: runtime.maxDuration,
      });
      const dismissTimingConfig = {
        duration: resolvedDismissDuration,
        easing: runtime.easing,
      };

      swipeDirectionSignal.set(progressDirection);
      signedSwipeProgress.set(withTiming(progressDirection, dismissTimingConfig));
      swipeProgress.set(withTiming(1, dismissTimingConfig));
      activeTranslateY.set(withTiming(0, dismissTimingConfig));
      activeTranslateX.set(
        withTiming(exitX, dismissTimingConfig, (finished) => {
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
        }),
      );

      return true;
    },
    [
      activeItemIndex,
      activeTranslateX,
      activeTranslateY,
      attachmentGeneration,
      commitSwipeIfCurrent,
      dragItemIndex,
      gestureStartYRatio,
      isAnimating,
      isDragging,
      applyImmediateRuntimeState,
      signedSwipeProgress,
      swipeDirectionSignal,
      swipeProgress,
    ],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
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
      activeTranslateX,
      activeTranslateY,
      attachmentGeneration,
      cancelSpringConfig,
      commitSwipeIfCurrent,
      dismissDuration,
      dismissEasing,
      dismissMaxDuration,
      dismissMinDuration,
      activeItemIndex,
      disabled,
      dragItemIndex,
      gestureStartYRatio,
      hasHandledGestureEnd,
      shouldIgnoreGesture,
      runtimeEventId,
      hasActiveCard,
      isAnimating,
      isDragging,
      layout,
      dismissOffscreenMultiplier,
      cardMotionConfig.rotation.direction,
      cardMotionConfig.rotation.maxDegrees,
      cardMotionConfig.rotation.mode,
      cardMotionConfig.rotation.origin,
      resolvedSwipeThreshold,
      applyScheduledRuntimeState,
      signedSwipeProgress,
      swipeDirectionSignal,
      swipeProgress,
      swipeProgressDistance,
      resolvedVelocityThreshold,
    ],
  );

  useLayoutEffect(() => {
    const currentAttachmentGeneration = attachmentGenerationRef.current + 1;

    attachmentGenerationRef.current = currentAttachmentGeneration;
    attachmentGeneration.set(currentAttachmentGeneration);

    const detach = deckStore.attach({
      getState: getDeckState,
      swipe: swipeProgrammatically,
    });

    return () => {
      const nextAttachmentGeneration = attachmentGenerationRef.current + 1;

      attachmentGenerationRef.current = nextAttachmentGeneration;
      attachmentGeneration.set(nextAttachmentGeneration);
      detach();
    };
  }, [attachmentGeneration, deckStore, getDeckState, swipeProgrammatically]);

  useLayoutEffect(() => {
    dataRef.current = data;
  }, [data]);

  useLayoutEffect(() => {
    publishDeckStateSnapshot();
  }, [data.length, publishDeckStateSnapshot]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    publishDeckStateSnapshot();
  }, [activeIndex, publishDeckStateSnapshot]);

  useEffect(() => {
    endReachedRef.current = endReached;
  }, [endReached]);

  useLayoutEffect(() => {
    disabledRef.current = disabled;
    publishDeckStateSnapshot();
  }, [disabled, publishDeckStateSnapshot]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    onSwipeRef.current = onSwipe;
  }, [onSwipe]);

  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  }, [onIndexChange]);

  useEffect(() => {
    onEndReachedRef.current = onEndReached;
  }, [onEndReached]);

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

  useEffect(() => {
    const nextIndex = clampActiveIndex(data.length, activeIndex);

    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  }, [activeIndex, data.length]);

  useEffect(() => {
    if (shouldResetEndReached(activeIndex, data.length)) {
      setEndReached(false);
    }
  }, [activeIndex, data.length]);

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
    activeRenderItemId,
    activeItemIndex,
    isAnimating,
    resetInteractionAfterDismiss,
    applyImmediateRuntimeState,
  ]);

  if (!cardSlot) {
    return <View onLayout={handleLayout} style={[styles.container, containerStyle]} />;
  }

  return (
    <GestureDetector gesture={pan}>
      <View onLayout={handleLayout} style={[styles.container, containerStyle]}>
        {stackRenderItems.map((renderItem) => {
          return (
            <SwipeDeckRenderedCard
              key={renderItem.itemKey}
              itemIndex={renderItem.index}
              itemKey={renderItem.itemKey}
              item={renderItem.item}
              descriptor={renderItem.descriptor}
              cardSlot={cardSlot}
              swipeProgress={swipeProgress}
              activeTranslateX={activeTranslateX}
              activeTranslateY={activeTranslateY}
              dragItemIndex={dragItemIndex}
              activeItemIndex={activeItemIndex}
              gestureStartYRatio={gestureStartYRatio}
              motionConfig={cardMotionConfig}
            />
          );
        })}
      </View>
    </GestureDetector>
  );
}

function createRoot<T>(
  factoryConfig: SwipeDeckFactoryConfig | undefined,
  registry: SwipeDeckRegistry,
) {
  return function SwipeDeckRoot(props: SwipeDeckProps<T>): ReactElement {
    return <Root {...props} factoryMotion={factoryConfig?.motion} registry={registry} />;
  };
}

export function createSwipeDeck<T = never>(
  factoryConfig?: SwipeDeckFactoryConfig,
): SwipeDeckInstance<T> {
  const registry = createSwipeDeckRegistry();

  return {
    Root: createRoot<T>(factoryConfig, registry),
    Card: SwipeDeckCard,
    useDeckState: registry.useDeckState,
    useDeckActions: registry.useDeckActions,
    useDeckInteraction: registry.useDeckInteraction,
  };
}

const StaticRoot: SwipeDeckStatic['Root'] = function SwipeDeckRoot<T>(
  props: SwipeDeckStaticRootProps<T>,
): ReactElement {
  const registry = useMemo(() => createSwipeDeckRegistry(), []);

  return <Root {...props} registry={registry} />;
};

export const SwipeDeck = {
  Root: StaticRoot,
  Card: SwipeDeckCard,
} satisfies SwipeDeckStatic;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
