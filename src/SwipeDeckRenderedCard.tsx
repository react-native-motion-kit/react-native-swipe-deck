import type { ReactElement } from 'react';

import { Fragment } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import type { SwipeDeckCardProps, SwipeDeckRotationOrigin, SwipeRenderInfo } from './types';
import type { SwipeWindowDescriptor } from './windowing';

export type SwipeDeckRenderedCardMotionConfig = {
  nextScale: number;
  nextOpacity: number;
  nextTranslateY: number;
  rotation: {
    origin: SwipeDeckRotationOrigin;
    maxDegrees: number;
    inputRange: number;
  };
  liftYFactor: number;
};

type SwipeDeckRenderedCardProps<T> = {
  itemIndex: number;
  itemKey: string;
  item: T;
  descriptor: SwipeWindowDescriptor;
  cardSlot: ReactElement<SwipeDeckCardProps<T>>;
  swipeProgress: SharedValue<number>;
  activeTranslateX: SharedValue<number>;
  activeTranslateY: SharedValue<number>;
  dragItemIndex: SharedValue<number>;
  activeItemIndex: SharedValue<number>;
  motionConfig: SwipeDeckRenderedCardMotionConfig;
};

export function SwipeDeckRenderedCard<T>({
  itemIndex,
  itemKey,
  item,
  descriptor,
  cardSlot,
  swipeProgress,
  activeTranslateX,
  activeTranslateY,
  dragItemIndex,
  activeItemIndex,
  motionConfig,
}: SwipeDeckRenderedCardProps<T>) {
  const { nextScale, nextOpacity, nextTranslateY, rotation, liftYFactor } = motionConfig;

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const relativeOffset = itemIndex - activeItemIndex.get();
    const isDraggingItem = dragItemIndex.get() === itemIndex;

    if (isDraggingItem) {
      const translateX = activeTranslateX.get();
      const translateY = activeTranslateY.get() - Math.abs(translateX) * liftYFactor;
      const rotationProgress = Math.min(
        Math.max(translateX / Math.max(rotation.inputRange, 1), -1),
        1,
      );
      const rotate = `${rotationProgress * rotation.maxDegrees}deg`;

      if (rotation.origin === 'bottom-center') {
        return {
          opacity: 1,
          transformOrigin: ['50%', '100%', 0],
          transform: [{ translateX }, { translateY }, { rotate }],
        };
      }

      return {
        opacity: 1,
        transform: [{ translateX }, { translateY }, { rotate }],
      };
    }

    if (relativeOffset < 0) {
      return {
        opacity: 0,
        transform: [{ scale: 1 }, { translateY: 0 }],
      };
    }

    if (relativeOffset > 0) {
      const nextDepth = Math.max(relativeOffset - swipeProgress.get(), 0);

      return {
        opacity: nextOpacity ** nextDepth,
        transform: [{ scale: nextScale ** nextDepth }, { translateY: nextTranslateY * nextDepth }],
      };
    }

    return {
      opacity: 1,
      transform: [{ scale: 1 }, { translateY: 0 }],
    };
  });

  const renderInfo: SwipeRenderInfo<T> = {
    item,
    index: descriptor.index,
    offset: descriptor.offset,
    role: descriptor.role,
    isActive: descriptor.isActive,
  };

  const content = cardSlot.props.children(renderInfo);
  const cardStyle = cardSlot.props.style;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.card, cardStyle, cardAnimatedStyle]}
      testID={`swipe-deck-card-${descriptor.role}`}
    >
      <Fragment key={itemKey}>{content}</Fragment>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
