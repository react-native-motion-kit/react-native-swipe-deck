import type { ReactElement, ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import React, { isValidElement, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { SwipeDeckCardProps, SwipeDeckLayout, SwipeDeckProps, SwipeDirection } from './types';
import type { SwipeWindowDescriptor } from './windowing';

import { getSwipeRenderItems } from './rendering';
import { getSwipeCommit, shouldResetEndReached } from './state';
import { SwipeDeckCard } from './SwipeDeckCard';
import { SwipeDeckRenderedCard } from './SwipeDeckRenderedCard';
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
          <SwipeDeckRenderedCard
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
});
