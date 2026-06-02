import type { ReactElement, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type SwipeDirection = 'left' | 'right';

export type SwipeRole = 'previous' | 'current' | 'next';

export type SwipeDeckLayout = {
  width: number;
  height: number;
};

export type SwipeRenderInfo<T> = {
  item: T;
  index: number;
  offset: number;
  role: SwipeRole;
  isActive: boolean;
};

export type SwipeEvent<T> = {
  item: T;
  index: number;
  direction: SwipeDirection;
};

export type SwipeDeckAnimationConfig = {
  /**
   * Scale applied to the next buffered card when the active card is at rest.
   * The next card animates from this value to `1` as swipe progress increases.
   */
  nextScale?: number;
  /**
   * Opacity applied to the next buffered card when the active card is at rest.
   * The next card animates from this value to `1` as swipe progress increases.
   */
  nextOpacity?: number;
  /**
   * Vertical offset applied to the next buffered card when the active card is at rest.
   * The next card animates from this value to `0` as swipe progress increases.
   */
  nextTranslateY?: number;
  /** Scale applied to the previous buffered card. */
  previousScale?: number;
  /** Opacity applied to the previous buffered card. */
  previousOpacity?: number;
  /** Vertical offset applied to the previous buffered card. */
  previousTranslateY?: number;
  /**
   * Horizontal drag distance that maps to full visual progress.
   * Defaults to `max(layout.width * 0.35, 120)`.
   */
  swipeProgressDistance?: number | ((layout: SwipeDeckLayout) => number);
};

export type ResolvedSwipeDeckAnimationConfig = Required<
  Omit<SwipeDeckAnimationConfig, 'swipeProgressDistance'>
> & {
  swipeProgressDistance: number;
};

export type SwipeDeckProps<T> = {
  data: readonly T[];
  getKey?: (item: T, index: number) => string;
  initialIndex?: number;
  disabled?: boolean;
  swipeThreshold?: number | ((layout: SwipeDeckLayout) => number);
  velocityThreshold?: number;
  animationConfig?: SwipeDeckAnimationConfig;
  /**
   * Maximum number of cards kept mounted around the active card.
   * Values below 5 are normalized to 5 when enough data is available.
   *
   * @default 5
   */
  visibleCardCount?: number;
  containerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  onSwipe?: (event: SwipeEvent<T>) => void;
  onIndexChange?: (index: number) => void;
  onEndReached?: () => void;
};

export type SwipeDeckCardProps<T> = {
  style?: StyleProp<ViewStyle>;
  children: (info: SwipeRenderInfo<T>) => ReactElement | null;
};

export type SwipeDeckInstance<T> = {
  Root: (props: SwipeDeckProps<T>) => ReactElement;
  Card: (props: SwipeDeckCardProps<T>) => ReactElement | null;
};

export type SwipeDeckStatic = {
  Root: <T>(props: SwipeDeckProps<T>) => ReactElement;
  Card: <T>(props: SwipeDeckCardProps<T>) => ReactElement | null;
};
