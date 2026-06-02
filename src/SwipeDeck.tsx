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
import { getSwipeSlotRenderItems } from './rendering';
import { createSwipeSlots, reconcileSwipeSlots } from './slots';
import { getSwipeCommit, shouldResetEndReached } from './state';
import { SwipeDeckCard } from './SwipeDeckCard';
import { SwipeDeckRenderedCard } from './SwipeDeckRenderedCard';
import { clampActiveIndex, getSwipeWindow } from './windowing';

function findCardSlot<T>(children: ReactNode): ReactElement<SwipeDeckCardProps<T>> | null {
  const childArray = React.Children.toArray(children);

  for (const child of childArray) {
    if (isValidElement(child) && child.type === SwipeDeckCard) {
      return child as ReactElement<SwipeDeckCardProps<T>>;
    }
  }

  return null;
}

function getInitialSlots(dataLength: number, activeIndex: number, visibleCardCount?: number) {
  return createSwipeSlots(getSwipeWindow(dataLength, activeIndex, visibleCardCount));
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
  const dragSlotId = useSharedValue(-1);
  const currentSlotId = useSharedValue(-1);
  const dataRef = useRef(data);
  const onSwipeRef = useRef(onSwipe);
  const onIndexChangeRef = useRef(onIndexChange);
  const onEndReachedRef = useRef(onEndReached);
  const slotResetConfigRef = useRef({ dataLength: data.length, visibleCardCount });
  const cardSlot = findCardSlot<T>(children);
  const [slots, setSlots] = useState(() =>
    getInitialSlots(data.length, activeIndex, visibleCardCount),
  );
  const slotRenderItems = getSwipeSlotRenderItems(data, slots, getKey);
  const activeSlotId = slotRenderItems.find((renderItem) => renderItem.isActive)?.slotId ?? -1;
  const animationConfig = resolveSwipeDeckAnimationConfig(animationConfigProp, layout);
  const resolvedSwipeThreshold =
    typeof swipeThreshold === 'function' ? swipeThreshold(layout) : swipeThreshold;
  const hasActiveCard = activeIndex >= 0 && activeIndex < data.length;

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
      setSlots((currentSlots) =>
        reconcileSwipeSlots(
          currentSlots,
          getSwipeWindow(currentData.length, commit.nextIndex, visibleCardCount),
        ),
      );
      setActiveIndex(commit.nextIndex);
      requestAnimationFrame(() => {
        activeTranslateX.set(0);
        activeTranslateY.set(0);
        swipeProgress.set(0);
        dragSlotId.set(-1);
      });

      if (commit.shouldEmitEndReached) {
        setEndReached(true);
        onEndReachedRef.current?.();
      }
    },
    [
      activeIndex,
      activeTranslateX,
      activeTranslateY,
      dragSlotId,
      endReached,
      swipeProgress,
      visibleCardCount,
    ],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(hasActiveCard && !disabled)
        .onBegin(() => {
          dragSlotId.set(currentSlotId.get());
        })
        .onUpdate((event) => {
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
          const direction = resolveSwipeDirection({
            translationX: event.translationX,
            velocityX: event.velocityX,
            disabled: disabled || !hasActiveCard,
            layout,
            swipeThreshold: resolvedSwipeThreshold,
            velocityThreshold,
          });

          if (!direction) {
            activeTranslateX.set(
              withSpring(0, undefined, (finished) => {
                if (finished) {
                  dragSlotId.set(-1);
                }
              }),
            );
            activeTranslateY.set(withSpring(0));
            swipeProgress.set(withSpring(0));
            return;
          }

          const offscreenX =
            direction === 'right'
              ? Math.max(layout.width, 1) * OFFSCREEN_MULTIPLIER
              : -Math.max(layout.width, 1) * OFFSCREEN_MULTIPLIER;

          swipeProgress.set(withTiming(1));
          activeTranslateX.set(
            withTiming(offscreenX, undefined, (finished) => {
              if (finished) {
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
      currentSlotId,
      disabled,
      dragSlotId,
      hasActiveCard,
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
    const previousConfig = slotResetConfigRef.current;
    const isSameConfig =
      previousConfig.dataLength === data.length &&
      previousConfig.visibleCardCount === visibleCardCount;

    if (isSameConfig) {
      return;
    }

    slotResetConfigRef.current = { dataLength: data.length, visibleCardCount };
    const nextIndex = clampActiveIndex(data.length, activeIndex);

    setSlots(getInitialSlots(data.length, nextIndex, visibleCardCount));

    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  }, [activeIndex, data.length, visibleCardCount]);

  useEffect(() => {
    if (shouldResetEndReached(activeIndex, data.length)) {
      setEndReached(false);
    }
  }, [activeIndex, data.length]);

  useLayoutEffect(() => {
    currentSlotId.set(activeSlotId);
  }, [activeSlotId, currentSlotId]);

  if (!cardSlot) {
    return <View onLayout={handleLayout} style={[styles.container, containerStyle]} />;
  }

  return (
    <GestureDetector gesture={pan}>
      <View onLayout={handleLayout} style={[styles.container, containerStyle]}>
        {slotRenderItems.map((renderItem) => {
          return (
            <SwipeDeckRenderedCard
              key={renderItem.slotId}
              slotId={renderItem.slotId}
              itemKey={renderItem.itemKey}
              item={renderItem.item}
              descriptor={renderItem.descriptor}
              cardSlot={cardSlot}
              swipeProgress={swipeProgress}
              activeTranslateX={activeTranslateX}
              activeTranslateY={activeTranslateY}
              dragSlotId={dragSlotId}
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
