import type { ReactElement, ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import React, { isValidElement, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { SwipeRenderItem } from './rendering';
import type {
  SwipeDeckCardProps,
  SwipeDeckLayout,
  SwipeDeckProps,
  SwipeDirection,
  SwipeRenderInfo,
} from './types';
import type { SwipeWindowDescriptor } from './windowing';

import { resolveSwipeDirection } from './directions';
import { getSwipeRenderItems } from './rendering';
import { getSwipeCommit, shouldResetEndReached } from './state';
import { SwipeDeckCard } from './SwipeDeckCard';
import { clampActiveIndex } from './windowing';

type SwipeDeckComponent = (<T>(props: SwipeDeckProps<T>) => ReactElement) & {
  Card: typeof SwipeDeckCard;
};

type SwipeDeckHandle = {
  swipe: (direction: SwipeDirection) => void;
  swipeLeft: () => void;
  swipeRight: () => void;
  reset: (index?: number) => void;
};

type RenderedCardProps<T> = {
  renderItem: SwipeRenderItem<T>;
  cardSlot: ReactElement<SwipeDeckCardProps<T>>;
  disabled: boolean;
  layout: SwipeDeckLayout;
  swipeThreshold: SwipeDeckProps<T>['swipeThreshold'];
  velocityThreshold: SwipeDeckProps<T>['velocityThreshold'];
  onAcceptedSwipe: (direction: SwipeDirection) => void;
};

const OFFSCREEN_MULTIPLIER = 1.5;

function findCardSlot<T>(children: ReactNode): ReactElement<SwipeDeckCardProps<T>> | null {
  const childArray = React.Children.toArray(children);

  for (const child of childArray) {
    if (isValidElement(child) && child.type === SwipeDeckCard) {
      return child as ReactElement<SwipeDeckCardProps<T>>;
    }
  }

  return null;
}

function getCardKey<T>(
  item: T,
  index: number,
  role: SwipeWindowDescriptor['role'],
  getKey?: SwipeDeckProps<T>['getKey'],
): string {
  const itemKey = getKey?.(item, index) ?? String(index);

  return `${role}-${itemKey}`;
}

function getPassiveStyle(role: SwipeWindowDescriptor['role']) {
  const roleStyles = {
    previous: styles.previousCard,
    current: styles.currentCard,
    next: styles.nextCard,
  } satisfies Record<SwipeWindowDescriptor['role'], object>;

  return roleStyles[role];
}

function RenderedCard<T>({
  renderItem,
  cardSlot,
  disabled,
  layout,
  swipeThreshold,
  velocityThreshold,
  onAcceptedSwipe,
}: RenderedCardProps<T>) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const { descriptor, item } = renderItem;
  const isCurrent = descriptor.role === 'current';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${translateX.value / 18}deg` },
    ],
  }));

  const resolvedSwipeThreshold =
    typeof swipeThreshold === 'function' ? swipeThreshold(layout) : swipeThreshold;

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isCurrent && !disabled)
        .onUpdate((event) => {
          translateX.value = event.translationX;
          translateY.value = event.translationY;
        })
        .onEnd((event) => {
          const direction = resolveSwipeDirection({
            translationX: event.translationX,
            velocityX: event.velocityX,
            disabled: disabled || !isCurrent,
            layout,
            swipeThreshold: resolvedSwipeThreshold,
            velocityThreshold,
          });

          if (!direction) {
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
            return;
          }

          const offscreenX =
            direction === 'right'
              ? Math.max(layout.width, 1) * OFFSCREEN_MULTIPLIER
              : -Math.max(layout.width, 1) * OFFSCREEN_MULTIPLIER;

          translateX.value = withTiming(offscreenX, undefined, (finished) => {
            if (finished) {
              runOnJS(onAcceptedSwipe)(direction);
            }
          });
        }),
    [
      disabled,
      isCurrent,
      layout,
      onAcceptedSwipe,
      resolvedSwipeThreshold,
      translateX,
      translateY,
      velocityThreshold,
    ],
  );

  const renderInfo: SwipeRenderInfo<T> = {
    item,
    index: descriptor.index,
    role: descriptor.role,
    isActive: descriptor.isActive,
  };

  const content = cardSlot.props.children(renderInfo);
  const cardStyle = cardSlot.props.style;

  const card = (
    <Animated.View
      pointerEvents={isCurrent ? 'auto' : 'none'}
      style={[
        styles.card,
        getPassiveStyle(descriptor.role),
        cardStyle,
        isCurrent ? animatedStyle : null,
      ]}
      testID={`swipe-deck-card-${descriptor.role}`}
    >
      {content}
    </Animated.View>
  );

  if (!isCurrent) {
    return card;
  }

  return <GestureDetector gesture={pan}>{card}</GestureDetector>;
}

function SwipeDeckRoot<T>({
  data,
  getKey,
  initialIndex = 0,
  disabled = false,
  swipeThreshold,
  velocityThreshold,
  containerStyle,
  children,
  onSwipe,
  onIndexChange,
  onEndReached,
}: SwipeDeckProps<T>): ReactElement {
  const [layout, setLayout] = useState<SwipeDeckLayout>({ width: 0, height: 0 });
  const [activeIndex, setActiveIndex] = useState(() => clampActiveIndex(data.length, initialIndex));
  const [endReached, setEndReached] = useState(false);
  const cardSlot = findCardSlot<T>(children);
  const renderItems = getSwipeRenderItems(data, activeIndex);

  useEffect(() => {
    setActiveIndex((currentIndex) => clampActiveIndex(data.length, currentIndex));
  }, [data.length]);

  useEffect(() => {
    if (shouldResetEndReached(activeIndex, data.length)) {
      setEndReached(false);
    }
  }, [activeIndex, data.length]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  const commitSwipe = useCallback(
    (direction: SwipeDirection) => {
      const commit = getSwipeCommit(data.length, activeIndex, endReached);

      if (!commit) {
        return;
      }

      const item = data[commit.swipedIndex] as T;

      onSwipe?.({ item, index: commit.swipedIndex, direction });
      onIndexChange?.(commit.nextIndex);
      setActiveIndex(commit.nextIndex);

      if (commit.shouldEmitEndReached) {
        setEndReached(true);
        onEndReached?.();
      }
    },
    [activeIndex, data, endReached, onEndReached, onIndexChange, onSwipe],
  );

  const privateHandle = useMemo<SwipeDeckHandle>(
    () => ({
      swipe: commitSwipe,
      swipeLeft: () => {
        commitSwipe('left');
      },
      swipeRight: () => {
        commitSwipe('right');
      },
      reset: (index = 0) => {
        setActiveIndex(clampActiveIndex(data.length, index));
        setEndReached(false);
      },
    }),
    [commitSwipe, data.length],
  );

  if (!cardSlot) {
    return <View onLayout={handleLayout} style={[styles.container, containerStyle]} />;
  }

  return (
    <View onLayout={handleLayout} style={[styles.container, containerStyle]}>
      {renderItems.map((renderItem) => {
        return (
          <RenderedCard
            key={getCardKey(renderItem.item, renderItem.index, renderItem.role, getKey)}
            renderItem={renderItem}
            cardSlot={cardSlot}
            disabled={disabled}
            layout={layout}
            swipeThreshold={swipeThreshold}
            velocityThreshold={velocityThreshold}
            onAcceptedSwipe={privateHandle.swipe}
          />
        );
      })}
    </View>
  );
}

export const SwipeDeck = Object.assign(SwipeDeckRoot, {
  Card: SwipeDeckCard,
}) as SwipeDeckComponent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  currentCard: {
    zIndex: 3,
  },
  nextCard: {
    zIndex: 2,
    transform: [{ scale: 0.96 }, { translateY: 12 }],
  },
  previousCard: {
    zIndex: 1,
    transform: [{ scale: 0.92 }, { translateY: 20 }],
  },
});
