import type { ReactElement } from 'react';

import { Fragment } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import type {
  SwipeDeckCardProps,
  SwipeDeckTinderFixedRotationOrigin,
  SwipeDeckTinderRotationDirection,
  SwipeDeckTinderRotationMode,
  SwipeDeckTinderDragMode,
  SwipeRenderInfo,
} from './types';
import type { SwipeWindowDescriptor } from './windowing';

import {
  resolveSwipeDeckDragTranslateY,
  resolveSwipeDeckTinderRotationSign,
  resolveSwipeDeckTinderTransformOrigin,
} from './animation';

export type SwipeDeckRenderedCardMotionConfig = {
  nextScale: number;
  nextOpacity: number;
  nextTranslateY: number;
  drag: {
    mode: SwipeDeckTinderDragMode;
    liftYFactor: number;
  };
  rotation: {
    mode: SwipeDeckTinderRotationMode;
    origin?: SwipeDeckTinderFixedRotationOrigin;
    direction?: SwipeDeckTinderRotationDirection;
    maxDegrees: number;
    inputRange: number;
  };
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
  gestureStartYRatio: SharedValue<number>;
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
  gestureStartYRatio,
  motionConfig,
}: SwipeDeckRenderedCardProps<T>) {
  const { nextScale, nextOpacity, nextTranslateY, drag, rotation } = motionConfig;

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const relativeOffset = itemIndex - activeItemIndex.get();
    const isDraggingItem = dragItemIndex.get() === itemIndex;

    if (isDraggingItem) {
      const translateX = activeTranslateX.get();
      const translateY = resolveSwipeDeckDragTranslateY({
        mode: drag.mode,
        liftYFactor: drag.liftYFactor,
        translationX: translateX,
        translationY: activeTranslateY.get(),
      });
      const rotationProgress = Math.min(
        Math.max(translateX / Math.max(rotation.inputRange, 1), -1),
        1,
      );
      const rotationSign = resolveSwipeDeckTinderRotationSign({
        mode: rotation.mode,
        direction: rotation.direction,
        gestureStartYRatio: gestureStartYRatio.get(),
      });
      const rotate = `${rotationProgress * rotation.maxDegrees * rotationSign}deg`;
      const transformOrigin = resolveSwipeDeckTinderTransformOrigin({
        mode: rotation.mode,
        origin: rotation.origin,
        gestureStartYRatio: gestureStartYRatio.get(),
      });

      if (transformOrigin) {
        return {
          opacity: 1,
          transformOrigin,
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
