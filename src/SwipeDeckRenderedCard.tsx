import type { ReactElement } from 'react';

import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { SwipeRenderItem } from './rendering';
import type {
  SwipeDeckCardProps,
  SwipeDeckLayout,
  SwipeDeckProps,
  ResolvedSwipeDeckAnimationConfig,
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
  swipeProgress: SharedValue<number>;
  animationConfig: ResolvedSwipeDeckAnimationConfig;
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
  swipeProgress,
  animationConfig,
  onAcceptedSwipe,
}: SwipeDeckRenderedCardProps<T>) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const { descriptor, item } = renderItem;
  const isCurrent = descriptor.role === 'current';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { rotate: `${translateX.get() / 18}deg` },
    ],
  }));

  const resolvedSwipeThreshold =
    typeof swipeThreshold === 'function' ? swipeThreshold(layout) : swipeThreshold;
  const {
    nextScale,
    nextOpacity,
    nextTranslateY,
    previousScale,
    previousOpacity,
    previousTranslateY,
    swipeProgressDistance,
  } = animationConfig;

  const passiveAnimatedStyle = useAnimatedStyle(() => {
    if (descriptor.role === 'next') {
      return {
        opacity: interpolate(swipeProgress.get(), [0, 1], [nextOpacity, 1], Extrapolation.CLAMP),
        transform: [
          {
            scale: interpolate(swipeProgress.get(), [0, 1], [nextScale, 1], Extrapolation.CLAMP),
          },
          {
            translateY: interpolate(
              swipeProgress.get(),
              [0, 1],
              [nextTranslateY, 0],
              Extrapolation.CLAMP,
            ),
          },
        ],
      };
    }

    if (descriptor.role === 'previous') {
      return {
        opacity: previousOpacity,
        transform: [{ scale: previousScale }, { translateY: previousTranslateY }],
      };
    }

    return {};
  });

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isCurrent && !disabled)
        .onUpdate((event) => {
          translateX.set(event.translationX);
          translateY.set(event.translationY);
          swipeProgress.set(
            Math.min(Math.abs(event.translationX) / Math.max(swipeProgressDistance, 1), 1),
          );
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
            translateX.set(withSpring(0));
            translateY.set(withSpring(0));
            swipeProgress.set(withSpring(0));
            return;
          }

          const offscreenX =
            direction === 'right'
              ? Math.max(layout.width, 1) * OFFSCREEN_MULTIPLIER
              : -Math.max(layout.width, 1) * OFFSCREEN_MULTIPLIER;

          swipeProgress.set(withTiming(1));
          translateX.set(
            withTiming(offscreenX, undefined, (finished) => {
              if (finished) {
                scheduleOnRN(onAcceptedSwipe, direction);
              }
            }),
          );
        }),
    [
      disabled,
      isCurrent,
      layout,
      onAcceptedSwipe,
      resolvedSwipeThreshold,
      swipeProgress,
      swipeProgressDistance,
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
        isCurrent ? null : passiveAnimatedStyle,
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
  },
  previousCard: {
    zIndex: 1,
  },
});
