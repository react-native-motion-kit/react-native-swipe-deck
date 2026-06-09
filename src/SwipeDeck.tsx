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
import {
  cancelAnimation,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { SwipeDeckRenderedCardMotionConfig } from './SwipeDeckRenderedCard';
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
  SwipeDeckMotionEasing,
  SwipeDeckUndoMotionRecipe,
} from './types';

import { resolveSwipeDeckActionMotionRecipe } from './actionMotion';
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
import { getSwipeDeckStackRenderItems } from './rendering';
import { getSwipeCommit, shouldDeferActiveItemSync, shouldResetEndReached } from './state';
import { SwipeDeckCard } from './SwipeDeckCard';
import { SwipeDeckRenderedCard } from './SwipeDeckRenderedCard';
import {
  getActiveRenderItemId,
  resolveProgressDirection,
  resolveSignedSwipeProgress,
  resolveSwipeDeckProgrammaticActionMotion,
  resolveSwipeDeckProgrammaticUndoMotion,
} from './swipeDeckRuntime';
import {
  appendSwipeDeckUndoHistoryEntry,
  createSwipeDeckUndoHistoryEntry,
  createSwipeDeckUndoKeyIndex,
  hasValidSwipeDeckUndoHistoryEntry,
  pruneSwipeDeckUndoHistory,
  removeSwipeDeckUndoHistoryEntryByToken,
  resolveLatestSwipeDeckUndoHistoryEntry,
  type SwipeDeckUndoHistoryEntry,
  type SwipeDeckUndoKeyIndex,
} from './undoHistory';
import { resolveSwipeDeckUndoMotionRecipe, type ResolvedSwipeDeckUndoMotion } from './undoMotion';
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

type UndoTransition = {
  index: number;
  key: string;
  motion: ResolvedSwipeDeckUndoMotion;
  runId: number;
};

type PendingUndoRestore = {
  direction: SwipeDirection;
  key: string;
  runId: number;
  token: number;
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
  const [undoTransition, setUndoTransition] = useState<UndoTransition | null>(null);
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
  const hasHandledGestureEnd = useSharedValue(false);
  const shouldIgnoreGesture = useSharedValue(false);
  const attachmentGeneration = useSharedValue(0);
  const runtimeEventId = useSharedValue(0);
  const isAnimating = useSharedValue(false);
  const dataRef = useRef(data);
  const getKeyRef = useRef(getKey);
  const activeIndexRef = useRef(activeIndex);
  const endReachedRef = useRef(endReached);
  const disabledRef = useRef(disabled);
  const layoutRef = useRef(layout);
  const undoHistoryRef = useRef<SwipeDeckUndoHistoryEntry[]>([]);
  const undoKeyIndexRef = useRef<SwipeDeckUndoKeyIndex>(
    undoEnabled ? createSwipeDeckUndoKeyIndex(data, getKey) : new Map(),
  );
  const undoEnabledRef = useRef(undoEnabled);
  const undoHistoryTokenRef = useRef(0);
  const pendingUndoRestoreRef = useRef<PendingUndoRestore | null>(null);
  const attachmentGenerationRef = useRef(0);
  const runtimeStateRef = useRef({ isAnimating: false, isDragging: false });
  const runtimeEventIdRef = useRef(0);
  const restoreRunIdRef = useRef(0);
  const onSwipeRef = useRef(onSwipe);
  const onUndoRef = useRef(onUndo);
  const onIndexChangeRef = useRef(onIndexChange);
  const onEndReachedRef = useRef(onEndReached);
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
  const hasActiveCard = getActiveRenderItemId(data.length, activeIndex) >= 0;
  const activeRenderItemId = getActiveRenderItemId(data.length, activeIndex);
  const stackRenderItems = getSwipeDeckStackRenderItems({
    data,
    activeIndex,
    getKey,
    undoIndex: undoTransition?.index,
    undoKey: undoTransition?.key,
    visibleCardCount,
  });
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
      hasUndoHistory:
        undoEnabledRef.current &&
        hasValidSwipeDeckUndoHistoryEntry(undoHistoryRef.current, undoKeyIndexRef.current),
    });
  }, []);

  const pruneUndoHistoryForCurrentData = useCallback(() => {
    const previousHistoryLength = undoHistoryRef.current.length;

    undoHistoryRef.current = undoEnabledRef.current
      ? pruneSwipeDeckUndoHistory(undoHistoryRef.current, undoKeyIndexRef.current)
      : [];

    return previousHistoryLength !== undoHistoryRef.current.length;
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

  const cancelPendingUndoRestore = useCallback(() => {
    pendingUndoRestoreRef.current = null;
    setUndoTransition(null);
    cancelActiveInteractionAnimations();
    cancelAnimation(undoProgress);
    swipeProgress.set(0);
    signedSwipeProgress.set(0);
    swipeDirectionSignal.set(0);
    activeTranslateX.set(0);
    activeTranslateY.set(0);
    activeItemIndex.set(getActiveRenderItemId(dataRef.current.length, activeIndexRef.current));
    dragItemIndex.set(-1);
    undoProgress.set(0);
    undoFromTranslateX.set(0);
    isDragging.set(false);
    gestureStartYRatio.set(0.5);
    isAnimating.set(false);
    applyImmediateRuntimeState(false, false);
  }, [
    activeItemIndex,
    activeTranslateX,
    activeTranslateY,
    applyImmediateRuntimeState,
    cancelActiveInteractionAnimations,
    dragItemIndex,
    gestureStartYRatio,
    isAnimating,
    isDragging,
    signedSwipeProgress,
    swipeDirectionSignal,
    swipeProgress,
    undoFromTranslateX,
    undoProgress,
  ]);

  const cancelPendingUndoRestoreIfInvalid = useCallback(() => {
    const pendingRestore = pendingUndoRestoreRef.current;

    if (!pendingRestore) {
      return false;
    }

    const isPendingHistoryValid = undoHistoryRef.current.some(
      (entry) => entry.token === pendingRestore.token,
    );

    if (isPendingHistoryValid) {
      return false;
    }

    cancelPendingUndoRestore();
    return true;
  }, [cancelPendingUndoRestore]);

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

    if (undoEnabledRef.current) {
      undoHistoryRef.current = appendSwipeDeckUndoHistoryEntry(
        undoHistoryRef.current,
        createSwipeDeckUndoHistoryEntry({
          token: undoHistoryTokenRef.current + 1,
          item,
          index: commit.swipedIndex,
          direction,
          getKey: getKeyRef.current,
        }),
      );
      undoHistoryTokenRef.current += 1;
    }
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

  const completeUndoRestoreIfCurrent = useCallback(
    (currentAttachmentGeneration: number, runId: number) => {
      const pendingRestore = pendingUndoRestoreRef.current;

      if (currentAttachmentGeneration !== attachmentGenerationRef.current) {
        return;
      }

      if (!pendingRestore || pendingRestore.runId !== runId) {
        return;
      }

      const currentData = dataRef.current;
      const restoredIndex = undoKeyIndexRef.current.get(pendingRestore.key) ?? -1;
      const restoredItem = restoredIndex >= 0 ? currentData[restoredIndex] : undefined;
      const isRestoredItemValid =
        restoredItem !== undefined &&
        getKeyRef.current(restoredItem, restoredIndex) === pendingRestore.key;

      if (!isRestoredItemValid) {
        undoHistoryRef.current = removeSwipeDeckUndoHistoryEntryByToken(
          undoHistoryRef.current,
          pendingRestore.token,
        );
        pendingUndoRestoreRef.current = null;
        setUndoTransition(null);
        activeItemIndex.set(getActiveRenderItemId(currentData.length, activeIndexRef.current));
        activeTranslateX.set(0);
        activeTranslateY.set(0);
        swipeProgress.set(0);
        signedSwipeProgress.set(0);
        swipeDirectionSignal.set(0);
        dragItemIndex.set(-1);
        undoProgress.set(0);
        undoFromTranslateX.set(0);
        isDragging.set(false);
        gestureStartYRatio.set(0.5);
        isAnimating.set(false);
        applyImmediateRuntimeState(false, false);
        return;
      }

      const isPendingHistoryValid = undoHistoryRef.current.some(
        (entry) => entry.token === pendingRestore.token,
      );

      if (!isPendingHistoryValid) {
        cancelPendingUndoRestore();
        return;
      }

      undoHistoryRef.current = removeSwipeDeckUndoHistoryEntryByToken(
        undoHistoryRef.current,
        pendingRestore.token,
      );
      pendingUndoRestoreRef.current = null;
      endReachedRef.current = false;
      setEndReached(false);
      activeIndexRef.current = restoredIndex;
      activeItemIndex.set(restoredIndex);
      swipeProgress.set(0);
      signedSwipeProgress.set(0);
      swipeDirectionSignal.set(0);
      activeTranslateX.set(0);
      activeTranslateY.set(0);
      dragItemIndex.set(-1);
      undoProgress.set(0);
      undoFromTranslateX.set(0);
      isDragging.set(false);
      gestureStartYRatio.set(0.5);
      setActiveIndex(restoredIndex);
      setUndoTransition(null);
      isAnimating.set(false);
      applyImmediateRuntimeState(false, false);
      onUndoRef.current?.({
        item: restoredItem,
        index: restoredIndex,
        direction: pendingRestore.direction,
      });
      onIndexChangeRef.current?.(restoredIndex);
    },
    [
      activeItemIndex,
      activeTranslateX,
      activeTranslateY,
      applyImmediateRuntimeState,
      cancelPendingUndoRestore,
      dragItemIndex,
      gestureStartYRatio,
      isAnimating,
      isDragging,
      signedSwipeProgress,
      swipeDirectionSignal,
      swipeProgress,
      undoFromTranslateX,
      undoProgress,
    ],
  );

  const undoProgrammatically = useCallback(
    (motionOverride?: SwipeDeckUndoMotionRecipe) => {
      const currentData = dataRef.current;
      const currentLayout = layoutRef.current;
      const runtime = dismissRuntimeRef.current;

      if (!undoEnabledRef.current) {
        return false;
      }

      const didPruneHistory = pruneUndoHistoryForCurrentData();
      const resolvedHistory = resolveLatestSwipeDeckUndoHistoryEntry(
        undoHistoryRef.current,
        currentData,
        undoKeyIndexRef.current,
      );

      if (!runtime || !resolvedHistory) {
        if (didPruneHistory) {
          publishDeckStateSnapshot();
        }

        return false;
      }

      if (disabledRef.current || isAnimating.get() || isDragging.get()) {
        return false;
      }

      if (currentLayout.width <= 0 || currentLayout.height <= 0) {
        return false;
      }

      const undoRuntime = resolveSwipeDeckProgrammaticUndoMotion({
        defaultUndoMotion: undoMotionRef.current,
        direction: resolvedHistory.entry.direction,
        layout: currentLayout,
        runtime,
        undoMotion: motionOverride,
      });
      const nextRunId = restoreRunIdRef.current + 1;

      restoreRunIdRef.current = nextRunId;
      pendingUndoRestoreRef.current = {
        direction: resolvedHistory.entry.direction,
        key: resolvedHistory.entry.key,
        runId: nextRunId,
        token: resolvedHistory.entry.token,
      };
      cancelActiveInteractionAnimations();
      isAnimating.set(true);
      applyImmediateRuntimeState(true, false);
      swipeProgress.set(0);
      signedSwipeProgress.set(0);
      swipeDirectionSignal.set(0);
      activeTranslateX.set(0);
      activeTranslateY.set(0);
      isDragging.set(false);
      dragItemIndex.set(-1);
      gestureStartYRatio.set(0.5);
      cancelAnimation(undoProgress);
      undoProgress.set(1);
      undoFromTranslateX.set(undoRuntime.from.translateX);
      setUndoTransition({
        index: resolvedHistory.index,
        key: resolvedHistory.entry.key,
        motion: undoRuntime,
        runId: nextRunId,
      });
      return true;
    },
    [
      activeTranslateX,
      activeTranslateY,
      applyImmediateRuntimeState,
      cancelActiveInteractionAnimations,
      dragItemIndex,
      gestureStartYRatio,
      isAnimating,
      isDragging,
      pruneUndoHistoryForCurrentData,
      publishDeckStateSnapshot,
      signedSwipeProgress,
      swipeDirectionSignal,
      swipeProgress,
      undoFromTranslateX,
      undoProgress,
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
      activeItemIndex,
      activeTranslateX,
      activeTranslateY,
      attachmentGeneration,
      completeSwipeDismiss,
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
      activeTranslateX,
      activeTranslateY,
      attachmentGeneration,
      cancelSpringConfig,
      completeSwipeDismiss,
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
      undo: undoProgrammatically,
    });

    return () => {
      const nextAttachmentGeneration = attachmentGenerationRef.current + 1;

      attachmentGenerationRef.current = nextAttachmentGeneration;
      attachmentGeneration.set(nextAttachmentGeneration);
      detach();
    };
  }, [attachmentGeneration, deckStore, getDeckState, swipeProgrammatically, undoProgrammatically]);

  useLayoutEffect(() => {
    if (!undoTransition) {
      return;
    }

    const pendingRestore = pendingUndoRestoreRef.current;

    if (!pendingRestore || pendingRestore.runId !== undoTransition.runId) {
      return;
    }

    const currentAttachmentGeneration = attachmentGenerationRef.current;
    const undoMotionRuntime = undoTransition.motion;

    cancelActiveInteractionAnimations();
    cancelAnimation(undoProgress);
    dragItemIndex.set(-1);
    gestureStartYRatio.set(0.5);
    swipeProgress.set(0);
    signedSwipeProgress.set(0);
    swipeDirectionSignal.set(0);
    activeTranslateX.set(0);
    activeTranslateY.set(0);
    undoProgress.set(1);
    undoFromTranslateX.set(undoMotionRuntime.from.translateX);

    const handleRestoreCompletion = (finished: boolean | undefined) => {
      'worklet';

      if (!finished || currentAttachmentGeneration !== attachmentGeneration.get()) {
        return;
      }

      scheduleOnRN(completeUndoRestoreIfCurrent, currentAttachmentGeneration, undoTransition.runId);
    };

    if (undoMotionRuntime.type === 'timing') {
      const timingConfig = {
        duration: undoMotionRuntime.duration,
        easing: undoMotionRuntime.easing,
      };

      undoProgress.set(withTiming(0, timingConfig, handleRestoreCompletion));
      return;
    }

    undoProgress.set(withSpring(0, undoMotionRuntime.springConfig, handleRestoreCompletion));
  }, [
    activeItemIndex,
    activeTranslateX,
    activeTranslateY,
    attachmentGeneration,
    cancelActiveInteractionAnimations,
    completeUndoRestoreIfCurrent,
    dragItemIndex,
    gestureStartYRatio,
    signedSwipeProgress,
    swipeDirectionSignal,
    swipeProgress,
    undoTransition,
    undoFromTranslateX,
    undoProgress,
  ]);

  useLayoutEffect(() => {
    undoEnabledRef.current = undoEnabled;
    undoKeyIndexRef.current = undoEnabled
      ? createSwipeDeckUndoKeyIndex(dataRef.current, getKeyRef.current)
      : new Map();
    pruneUndoHistoryForCurrentData();
    cancelPendingUndoRestoreIfInvalid();
    publishDeckStateSnapshot();
  }, [
    cancelPendingUndoRestoreIfInvalid,
    pruneUndoHistoryForCurrentData,
    publishDeckStateSnapshot,
    undoEnabled,
  ]);

  useLayoutEffect(() => {
    dataRef.current = data;
    getKeyRef.current = getKey;
    undoKeyIndexRef.current = undoEnabledRef.current
      ? createSwipeDeckUndoKeyIndex(data, getKey)
      : new Map();
    pruneUndoHistoryForCurrentData();
    cancelPendingUndoRestoreIfInvalid();
    publishDeckStateSnapshot();
  }, [
    cancelPendingUndoRestoreIfInvalid,
    data,
    getKey,
    pruneUndoHistoryForCurrentData,
    publishDeckStateSnapshot,
  ]);

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
