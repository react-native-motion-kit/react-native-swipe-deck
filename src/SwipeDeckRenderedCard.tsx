import type { ReactElement } from 'react';

import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
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

type SwipeDeckRenderedCardProps<T> = {
  renderItem: SwipeRenderItem<T>;
  cardSlot: ReactElement<SwipeDeckCardProps<T>>;
  disabled: boolean;
  layout: SwipeDeckLayout;
  swipeThreshold: SwipeDeckProps<T>['swipeThreshold'];
  velocityThreshold: SwipeDeckProps<T>['velocityThreshold'];
  onAcceptedSwipe: (direction: SwipeDirection) => void;
};

const OFFSCREEN_MULTIPLIER = 1.5;

function getPassiveStyle(role: SwipeWindowDescriptor['role']) {
  const roleStyles = {
    previous: styles.previousCard,
    current: styles.currentCard,
    next: styles.nextCard,
  } satisfies Record<SwipeWindowDescriptor['role'], object>;

  return roleStyles[role];
}

export function SwipeDeckRenderedCard<T>({
  renderItem,
  cardSlot,
  disabled,
  layout,
  swipeThreshold,
  velocityThreshold,
  onAcceptedSwipe,
}: SwipeDeckRenderedCardProps<T>) {
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

const styles = StyleSheet.create({
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
