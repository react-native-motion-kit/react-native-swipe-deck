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
  role: SwipeRole;
  isActive: boolean;
};

export type SwipeEvent<T> = {
  item: T;
  index: number;
  direction: SwipeDirection;
};

export type SwipeDeckProps<T> = {
  data: readonly T[];
  getKey?: (item: T, index: number) => string;
  initialIndex?: number;
  disabled?: boolean;
  swipeThreshold?: number | ((layout: SwipeDeckLayout) => number);
  velocityThreshold?: number;
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
