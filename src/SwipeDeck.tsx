import type { ReactElement, ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import React, { isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type {
  SwipeDeckCardProps,
  SwipeDeckInstance,
  SwipeDeckLayout,
  SwipeDeckProps,
  SwipeDeckStatic,
  SwipeDirection,
} from './types';
import type { SwipeWindowDescriptor } from './windowing';

import { resolveSwipeDeckAnimationConfig } from './animation';
import { getSwipeRenderItems } from './rendering';
import { getSwipeCommit, shouldResetEndReached } from './state';
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

function getCardKey<T>(
  item: T,
  index: number,
  role: SwipeWindowDescriptor['role'],
  getKey?: SwipeDeckProps<T>['getKey'],
): string {
  const itemKey = getKey?.(item, index) ?? String(index);

  return `${role}-${itemKey}`;
}

function Root<T>({
  data,
  getKey,
  initialIndex = 0,
  disabled = false,
  swipeThreshold,
  velocityThreshold,
  animationConfig: animationConfigProp,
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
  const dataRef = useRef(data);
  const onSwipeRef = useRef(onSwipe);
  const onIndexChangeRef = useRef(onIndexChange);
  const onEndReachedRef = useRef(onEndReached);
  const cardSlot = findCardSlot<T>(children);
  const renderItems = getSwipeRenderItems(data, activeIndex);
  const animationConfig = resolveSwipeDeckAnimationConfig(animationConfigProp, layout);

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
    setActiveIndex((currentIndex) => clampActiveIndex(data.length, currentIndex));
  }, [data.length]);

  useEffect(() => {
    if (shouldResetEndReached(activeIndex, data.length)) {
      setEndReached(false);
    }
  }, [activeIndex, data.length]);

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

      swipeProgress.set(0);
      onSwipeRef.current?.({ item, index: commit.swipedIndex, direction });
      onIndexChangeRef.current?.(commit.nextIndex);
      setActiveIndex(commit.nextIndex);

      if (commit.shouldEmitEndReached) {
        setEndReached(true);
        onEndReachedRef.current?.();
      }
    },
    [activeIndex, endReached, swipeProgress],
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
            swipeProgress={swipeProgress}
            animationConfig={animationConfig}
            onAcceptedSwipe={commitSwipe}
          />
        );
      })}
    </View>
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
