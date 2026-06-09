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
import { GestureDetector } from 'react-native-gesture-handler';
import { cancelAnimation, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type {
  SwipeDeckActionMotionRecipe,
  SwipeDeckCardProps,
  SwipeDeckFactoryConfig,
  SwipeDeckInstance,
  SwipeDeckLayout,
  SwipeDeckProps,
  SwipeDeckStatic,
  SwipeDeckStaticRootProps,
  SwipeDirection,
  SwipeDeckMotionPreset,
  SwipeDeckUndoMotionRecipe,
} from './types';

import {
  resolveSwipeDeckDismissDestinationDistance,
  resolveSwipeDeckDismissDuration,
} from './animation';
import { getSwipeDeckState } from './deckState';
import { createSwipeDeckRegistry, type SwipeDeckRegistry } from './registry';
import { getSwipeDeckStackRenderItems } from './rendering';
import { getSwipeCommit, shouldDeferActiveItemSync, shouldResetEndReached } from './state';
import { SwipeDeckCard } from './SwipeDeckCard';
import { SwipeDeckRenderedCard } from './SwipeDeckRenderedCard';
import {
  getActiveRenderItemId,
  resolveSwipeDeckProgrammaticActionMotion,
} from './swipeDeckRuntime';
import { useSwipeDeckGestureRuntime } from './useSwipeDeckGestureRuntime';
import { useSwipeDeckMotionRuntime } from './useSwipeDeckMotionRuntime';
import { useSwipeDeckUndoRuntime } from './useSwipeDeckUndoRuntime';
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

type SwipeDeckRootProps<T> = SwipeDeckProps<T> & {
  factoryActionMotion?: SwipeDeckActionMotionRecipe;
  factoryMotion?: SwipeDeckMotionPreset;
  factoryUndoMotion?: SwipeDeckUndoMotionRecipe;
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
  actionMotion,
  undoMotion,
  undoEnabled = false,
  factoryActionMotion,
  factoryMotion,
  factoryUndoMotion,
  visibleCardCount,
  containerStyle,
  children,
  onSwipe,
  onUndo,
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
  const undoProgress = useSharedValue(0);
  const undoFromTranslateX = useSharedValue(0);
  const activeItemIndex = useSharedValue(-1);
  const gestureStartYRatio = useSharedValue(0.5);
  const attachmentGeneration = useSharedValue(0);
  const runtimeEventId = useSharedValue(0);
  const isAnimating = useSharedValue(false);
  const dataRef = useRef(data);
  const getKeyRef = useRef(getKey);
  const activeIndexRef = useRef(activeIndex);
  const endReachedRef = useRef(endReached);
  const disabledRef = useRef(disabled);
  const layoutRef = useRef(layout);
  const hasUndoHistoryRef = useRef<() => boolean>(() => false);
  const attachmentGenerationRef = useRef(0);
  const runtimeStateRef = useRef({ isAnimating: false, isDragging: false });
  const runtimeEventIdRef = useRef(0);
  const onSwipeRef = useRef(onSwipe);
  const onUndoRef = useRef(onUndo);
  const onIndexChangeRef = useRef(onIndexChange);
  const onEndReachedRef = useRef(onEndReached);
  const pendingCommitResetRef = useRef(false);
  const cardSlot = findCardSlot<T>(children);
  const hasActiveCard = getActiveRenderItemId(data.length, activeIndex) >= 0;
  const activeRenderItemId = getActiveRenderItemId(data.length, activeIndex);
  const {
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
  } = useSwipeDeckMotionRuntime({
    actionMotion,
    factoryActionMotion,
    factoryMotion,
    factoryUndoMotion,
    layout,
    motion,
    swipeThreshold,
    undoMotion,
    velocityThreshold,
  });

  const getDeckState = useCallback(() => {
    return getSwipeDeckState({
      dataLength: dataRef.current.length,
      activeIndex: activeIndexRef.current,
      disabled: disabledRef.current,
      layout: layoutRef.current,
      isAnimating: runtimeStateRef.current.isAnimating,
      isDragging: runtimeStateRef.current.isDragging,
      hasUndoHistory: hasUndoHistoryRef.current(),
    });
  }, []);

  const publishDeckStateSnapshot = useCallback(() => {
    deckStore.setSnapshot(getDeckState());
  }, [deckStore, getDeckState]);

  const cancelActiveInteractionAnimations = useCallback(() => {
    cancelAnimation(activeTranslateX);
    cancelAnimation(activeTranslateY);
    cancelAnimation(swipeProgress);
    cancelAnimation(signedSwipeProgress);
    cancelAnimation(swipeDirectionSignal);
  }, [
    activeTranslateX,
    activeTranslateY,
    signedSwipeProgress,
    swipeDirectionSignal,
    swipeProgress,
  ]);

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

  useLayoutEffect(() => {
    dataRef.current = data;
    getKeyRef.current = getKey;
    publishDeckStateSnapshot();
  }, [data, getKey, publishDeckStateSnapshot]);

  // Undo owns history and restore animation lifecycle; Root keeps shared render, registry,
  // and deck-state snapshot plumbing so swipe/action/undo continue to publish one store.
  const { recordSwipeForUndo, undoProgrammatically, undoTransition } = useSwipeDeckUndoRuntime({
    activeIndexRef,
    activeItemIndex,
    activeTranslateX,
    activeTranslateY,
    applyImmediateRuntimeState,
    attachmentGeneration,
    attachmentGenerationRef,
    cancelActiveInteractionAnimations,
    data,
    disabledRef,
    dismissRuntimeRef,
    dragItemIndex,
    endReachedRef,
    gestureStartYRatio,
    getKey,
    hasUndoHistoryRef,
    isAnimating,
    isDragging,
    layoutRef,
    onIndexChangeRef,
    onUndoRef,
    publishDeckStateSnapshot,
    setActiveIndex,
    setEndReached,
    signedSwipeProgress,
    swipeDirectionSignal,
    swipeProgress,
    undoEnabled,
    undoFromTranslateX,
    undoMotionRef,
    undoProgress,
  });

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
    [recordSwipeForUndo],
  );

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
      activeItemIndex,
      activeTranslateX,
      activeTranslateY,
      attachmentGeneration,
      completeSwipeDismiss,
      dismissRuntimeRef,
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

  const pan = useSwipeDeckGestureRuntime({
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
  });

  const stackRenderItems = getSwipeDeckStackRenderItems({
    data,
    activeIndex,
    getKey,
    undoIndex: undoTransition?.index,
    undoKey: undoTransition?.key,
    visibleCardCount,
  });

  useLayoutEffect(() => {
    const currentAttachmentGeneration = attachmentGenerationRef.current + 1;

    attachmentGenerationRef.current = currentAttachmentGeneration;
    attachmentGeneration.set(currentAttachmentGeneration);

    const detach = deckStore.attach({
      getState: getDeckState,
      swipe: swipeProgrammatically,
      undo: undoProgrammatically,
    });

    return () => {
      const nextAttachmentGeneration = attachmentGenerationRef.current + 1;

      attachmentGenerationRef.current = nextAttachmentGeneration;
      attachmentGeneration.set(nextAttachmentGeneration);
      detach();
    };
  }, [attachmentGeneration, deckStore, getDeckState, swipeProgrammatically, undoProgrammatically]);

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
    onUndoRef.current = onUndo;
  }, [onUndo]);

  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  }, [onIndexChange]);

  useEffect(() => {
    onEndReachedRef.current = onEndReached;
  }, [onEndReached]);

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
              transition={renderItem.transition}
              cardSlot={cardSlot}
              swipeProgress={swipeProgress}
              activeTranslateX={activeTranslateX}
              activeTranslateY={activeTranslateY}
              dragItemIndex={dragItemIndex}
              undoItemKey={undoTransition?.key}
              undoProgress={undoProgress}
              undoFromTranslateX={undoFromTranslateX}
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
    return (
      <Root
        {...props}
        factoryActionMotion={factoryConfig?.actionMotion}
        factoryMotion={factoryConfig?.motion}
        factoryUndoMotion={factoryConfig?.undoMotion}
        registry={registry}
      />
    );
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
