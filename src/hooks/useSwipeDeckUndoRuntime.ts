import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { cancelAnimation, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { SwipeDeckRenderedCardMotionConfig } from '../components/SwipeDeckRenderedCard';
import type {
  SwipeDeckLayout,
  SwipeDeckMotionEasing,
  SwipeDeckUndoMotionRecipe,
  SwipeDirection,
  UndoEvent,
} from '../types';

import {
  getActiveRenderItemId,
  resolveSwipeDeckProgrammaticUndoMotion,
} from '../core/swipeDeckRuntime';
import { type ResolvedSwipeDeckUndoMotion } from '../motion/undoMotion';
import {
  appendSwipeDeckUndoHistoryEntry,
  createSwipeDeckUndoHistoryEntry,
  createSwipeDeckUndoKeyIndex,
  hasValidSwipeDeckUndoHistoryEntry,
  pruneSwipeDeckUndoHistory,
  removeSwipeDeckUndoHistoryEntryByToken,
  resolveLatestSwipeDeckUndoHistoryEntry,
  resolveSwipeDeckUndoRestoreTarget,
  type SwipeDeckUndoHistoryEntry,
  type SwipeDeckUndoKeyIndex,
} from '../registry/undoHistory';

type SwipeDeckUndoDismissRuntime = {
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

type RecordSwipeForUndoArgs<T> = {
  direction: SwipeDirection;
  index: number;
  item: T;
};

type UseSwipeDeckUndoRuntimeArgs<T> = {
  activeIndexRef: RefObject<number>;
  activeItemIndex: SharedValue<number>;
  activeTranslateX: SharedValue<number>;
  activeTranslateY: SharedValue<number>;
  applyImmediateRuntimeState: (isAnimating: boolean, isDragging: boolean) => void;
  attachmentGeneration: SharedValue<number>;
  attachmentGenerationRef: RefObject<number>;
  cancelActiveInteractionAnimations: () => void;
  data: readonly T[];
  disabledRef: RefObject<boolean>;
  dismissRuntimeRef: RefObject<SwipeDeckUndoDismissRuntime | null>;
  dragItemIndex: SharedValue<number>;
  endReachedRef: RefObject<boolean>;
  gestureStartYRatio: SharedValue<number>;
  getKey: (item: T, index: number) => string;
  hasUndoHistoryRef: { current: () => boolean };
  isAnimating: SharedValue<boolean>;
  isDragging: SharedValue<boolean>;
  layoutRef: RefObject<SwipeDeckLayout>;
  onIndexChangeRef: RefObject<((index: number) => void) | undefined>;
  onUndoRef: RefObject<((event: UndoEvent<T>) => void) | undefined>;
  publishDeckStateSnapshot: () => void;
  setActiveIndex: Dispatch<SetStateAction<number>>;
  setEndReached: Dispatch<SetStateAction<boolean>>;
  signedSwipeProgress: SharedValue<number>;
  swipeDirectionSignal: SharedValue<-1 | 0 | 1>;
  swipeProgress: SharedValue<number>;
  undoEnabled: boolean;
  undoFromTranslateX: SharedValue<number>;
  undoMotionRef: RefObject<SwipeDeckUndoMotionRecipe | undefined>;
  undoProgress: SharedValue<number>;
};

type UseSwipeDeckUndoRuntimeResult<T> = {
  recordSwipeForUndo: (event: RecordSwipeForUndoArgs<T>) => boolean;
  undoProgrammatically: (motionOverride?: SwipeDeckUndoMotionRecipe) => boolean;
  undoTransition: UndoTransition | null;
};

/**
 * Owns undo history, pending restore, programmatic undo, and restore animation lifecycle.
 *
 * Shared interaction values stay parent-owned because gesture, action, render stack, and registry
 * state still synchronize through the same values.
 */
export function useSwipeDeckUndoRuntime<T>({
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
}: UseSwipeDeckUndoRuntimeArgs<T>): UseSwipeDeckUndoRuntimeResult<T> {
  const [undoTransition, setUndoTransition] = useState<UndoTransition | null>(null);
  const dataRef = useRef(data);
  const getKeyRef = useRef(getKey);
  const undoHistoryRef = useRef<SwipeDeckUndoHistoryEntry[]>([]);
  const undoKeyIndexRef = useRef<SwipeDeckUndoKeyIndex>(
    undoEnabled ? createSwipeDeckUndoKeyIndex(data, getKey) : new Map(),
  );
  const undoEnabledRef = useRef(undoEnabled);
  const undoHistoryTokenRef = useRef(0);
  const pendingUndoRestoreRef = useRef<PendingUndoRestore | null>(null);
  const restoreRunIdRef = useRef(0);

  const hasUndoHistory = useCallback(() => {
    return (
      undoEnabledRef.current &&
      hasValidSwipeDeckUndoHistoryEntry(undoHistoryRef.current, undoKeyIndexRef.current)
    );
  }, []);

  useLayoutEffect(() => {
    hasUndoHistoryRef.current = hasUndoHistory;
  }, [hasUndoHistory, hasUndoHistoryRef]);

  const pruneUndoHistoryForCurrentData = useCallback(() => {
    const previousHistoryLength = undoHistoryRef.current.length;

    undoHistoryRef.current = undoEnabledRef.current
      ? pruneSwipeDeckUndoHistory(undoHistoryRef.current, undoKeyIndexRef.current)
      : [];

    return previousHistoryLength !== undoHistoryRef.current.length;
  }, []);

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
    activeIndexRef,
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

  const recordSwipeForUndo = useCallback(
    ({ item, index, direction }: RecordSwipeForUndoArgs<T>) => {
      if (!undoEnabledRef.current) {
        return false;
      }

      undoHistoryRef.current = appendSwipeDeckUndoHistoryEntry(
        undoHistoryRef.current,
        createSwipeDeckUndoHistoryEntry({
          token: undoHistoryTokenRef.current + 1,
          item,
          index,
          direction,
          getKey: getKeyRef.current,
        }),
      );
      undoHistoryTokenRef.current += 1;
      return true;
    },
    [],
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
      const restoreTarget = resolveSwipeDeckUndoRestoreTarget({
        data: currentData,
        getKey: getKeyRef.current,
        key: pendingRestore.key,
        keyIndex: undoKeyIndexRef.current,
      });

      if (!restoreTarget) {
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

      const { index: restoredIndex, item: restoredItem } = restoreTarget;
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
      activeIndexRef,
      activeItemIndex,
      activeTranslateX,
      activeTranslateY,
      applyImmediateRuntimeState,
      attachmentGenerationRef,
      cancelPendingUndoRestore,
      dragItemIndex,
      endReachedRef,
      gestureStartYRatio,
      isAnimating,
      isDragging,
      onIndexChangeRef,
      onUndoRef,
      setActiveIndex,
      setEndReached,
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
      disabledRef,
      dismissRuntimeRef,
      dragItemIndex,
      gestureStartYRatio,
      isAnimating,
      isDragging,
      layoutRef,
      pruneUndoHistoryForCurrentData,
      publishDeckStateSnapshot,
      signedSwipeProgress,
      swipeDirectionSignal,
      swipeProgress,
      undoFromTranslateX,
      undoMotionRef,
      undoProgress,
    ],
  );

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
    activeTranslateX,
    activeTranslateY,
    attachmentGeneration,
    attachmentGenerationRef,
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

  return {
    recordSwipeForUndo,
    undoProgrammatically,
    undoTransition,
  };
}
