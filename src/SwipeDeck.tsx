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

import type {
  SwipeDeckCardProps,
  SwipeDeckInstance,
  SwipeDeckLayout,
  SwipeDeckProps,
  SwipeDeckStatic,
  SwipeDirection,
} from './types';

import { resolveSwipeDeckAnimationConfig } from './animation';
import { resolveSwipeDirection } from './directions';
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

const OFFSCREEN_MULTIPLIER = 1.5;

function Root<T>({
  data,
  getKey,
  initialIndex = 0,
  disabled = false,
  swipeThreshold,
  velocityThreshold,
  animationConfig: animationConfigProp,
  visibleCardCount,
  containerStyle,
  children,
  onSwipe,
  onIndexChange,
  onEndReached,
}: SwipeDeckProps<T>): ReactElement {
  const [layout, setLayout] = useState<SwipeDeckLayout>({ width: 0, height: 0 });
  const [activeIndex, setActiveIndex] = useState(() => clampActiveIndex(data.length, initialIndex));
  const [endReached, setEndReached] = useState(false);
  const swipeProgress = useSharedValue(0);
  const activeTranslateX = useSharedValue(0);
  const activeTranslateY = useSharedValue(0);
  const dragItemIndex = useSharedValue(-1);
  const activeItemIndex = useSharedValue(-1);
  const isAnimating = useSharedValue(false);
  const dataRef = useRef(data);
  const onSwipeRef = useRef(onSwipe);
  const onIndexChangeRef = useRef(onIndexChange);
  const onEndReachedRef = useRef(onEndReached);
  const pendingCommitResetRef = useRef(false);
  const cardSlot = findCardSlot<T>(children);
  const hasActiveCard = activeIndex >= 0 && activeIndex < data.length;
  const activeRenderItemId = hasActiveCard ? activeIndex : -1;
  const renderItems = getSwipeRenderItems(data, activeIndex, getKey, visibleCardCount);
  const stackRenderItems = getSwipeStackRenderItems(renderItems);
  const animationConfig = resolveSwipeDeckAnimationConfig(animationConfigProp, layout);
  const resolvedSwipeThreshold =
    typeof swipeThreshold === 'function' ? swipeThreshold(layout) : swipeThreshold;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  }, []);

  const commitSwipe = useCallback(
    (direction: SwipeDirection) => {
      const currentData = dataRef.current;
      const commit = getSwipeCommit(currentData.length, activeIndex, endReached);

      if (!commit) {
        return;
      }

      const item = currentData[commit.swipedIndex] as T;

      onSwipeRef.current?.({ item, index: commit.swipedIndex, direction });
      onIndexChangeRef.current?.(commit.nextIndex);
      pendingCommitResetRef.current = true;
      setActiveIndex(commit.nextIndex);

      if (commit.shouldEmitEndReached) {
        setEndReached(true);
        onEndReachedRef.current?.();
      }
    },
    [activeIndex, endReached],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(hasActiveCard && !disabled)
        .onBegin(() => {
          if (isAnimating.get()) {
            return;
          }

          dragItemIndex.set(activeItemIndex.get());
        })
        .onUpdate((event) => {
          if (isAnimating.get()) {
            return;
          }

          if (dragItemIndex.get() < 0) {
            dragItemIndex.set(activeItemIndex.get());
          }

          activeTranslateX.set(event.translationX);
          activeTranslateY.set(event.translationY);
          swipeProgress.set(
            Math.min(
              Math.abs(event.translationX) / Math.max(animationConfig.swipeProgressDistance, 1),
              1,
            ),
          );
        })
        .onEnd((event) => {
          if (isAnimating.get()) {
            return;
          }

          const direction = resolveSwipeDirection({
            translationX: event.translationX,
            velocityX: event.velocityX,
            disabled: disabled || !hasActiveCard,
            layout,
            swipeThreshold: resolvedSwipeThreshold,
            velocityThreshold,
          });

          if (dragItemIndex.get() < 0) {
            dragItemIndex.set(activeItemIndex.get());
          }

          if (!direction) {
            activeTranslateX.set(
              withSpring(0, undefined, (finished) => {
                if (finished) {
                  dragItemIndex.set(-1);
                  isAnimating.set(false);
                }
              }),
            );
            activeTranslateY.set(withSpring(0));
            swipeProgress.set(withSpring(0));
            return;
          }

          isAnimating.set(true);
          const offscreenX =
            direction === 'right'
              ? Math.max(layout.width, 1) * OFFSCREEN_MULTIPLIER
              : -Math.max(layout.width, 1) * OFFSCREEN_MULTIPLIER;

          swipeProgress.set(withTiming(1));
          activeTranslateX.set(
            withTiming(offscreenX, undefined, (finished) => {
              if (finished) {
                const nextActiveItemIndex = activeItemIndex.get() + 1;
                activeItemIndex.set(nextActiveItemIndex);
                activeTranslateX.set(0);
                activeTranslateY.set(0);
                swipeProgress.set(0);
                dragItemIndex.set(-1);
                scheduleOnRN(commitSwipe, direction);
              }
            }),
          );
        }),
    [
      activeTranslateX,
      activeTranslateY,
      animationConfig.swipeProgressDistance,
      commitSwipe,
      activeItemIndex,
      disabled,
      dragItemIndex,
      hasActiveCard,
      isAnimating,
      layout,
      resolvedSwipeThreshold,
      swipeProgress,
      velocityThreshold,
    ],
  );

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

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
    const hasPendingCommitReset = pendingCommitResetRef.current;

    if (shouldDeferActiveItemSync(isAnimating.get(), hasPendingCommitReset)) {
      return;
    }

    activeItemIndex.set(activeRenderItemId);

    if (!hasPendingCommitReset) {
      return;
    }

    pendingCommitResetRef.current = false;
    activeTranslateX.set(0);
    activeTranslateY.set(0);
    swipeProgress.set(0);
    dragItemIndex.set(-1);
    isAnimating.set(false);
  }, [
    activeRenderItemId,
    activeTranslateX,
    activeTranslateY,
    activeItemIndex,
    dragItemIndex,
    isAnimating,
    swipeProgress,
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
              animationConfig={animationConfig}
            />
          );
        })}
      </View>
    </GestureDetector>
  );
}

export function createSwipeDeck<T = never>(): SwipeDeckInstance<T> {
  return {
    Root,
    Card: SwipeDeckCard,
  };
}

export const SwipeDeck = {
  Root,
  Card: SwipeDeckCard,
} satisfies SwipeDeckStatic;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
