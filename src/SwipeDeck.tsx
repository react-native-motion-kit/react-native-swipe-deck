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
import { cancelAnimation, useSharedValue } from 'react-native-reanimated';

import type {
  SwipeDeckActionMotionRecipe,
  SwipeDeckCardProps,
  SwipeDeckFactoryConfig,
  SwipeDeckInstance,
  SwipeDeckLayout,
  SwipeDeckProps,
  SwipeDeckStatic,
  SwipeDeckStaticRootProps,
  SwipeDeckMotionPreset,
  SwipeDeckUndoMotionRecipe,
} from './types';

import { getSwipeDeckState } from './deckState';
import { createSwipeDeckRegistry, type SwipeDeckRegistry } from './registry';
import { getSwipeDeckStackRenderItems } from './rendering';
import { shouldResetEndReached } from './state';
import { SwipeDeckCard } from './SwipeDeckCard';
import { SwipeDeckRenderedCard } from './SwipeDeckRenderedCard';
import { getActiveRenderItemId } from './swipeDeckRuntime';
import { useSwipeDeckDismissRuntime } from './useSwipeDeckDismissRuntime';
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

  const { completeSwipeDismiss, swipeProgrammatically } = useSwipeDeckDismissRuntime({
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
  });

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

  // Root owns public deck-state publication for any active-index change.
  // Dismiss runtime separately owns active render-item sync and post-dismiss reset ordering.
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
