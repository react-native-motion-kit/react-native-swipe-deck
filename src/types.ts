import type { ReactElement, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type SwipeDirection = 'left' | 'right';

export type SwipeRole = 'current' | 'next';

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
  /**
   * Ordered items rendered by the deck.
   *
   * Only the bounded forward window is mounted; the full array is never rendered at once.
   */
  data: readonly T[];
  /**
   * Returns a stable unique key for an item.
   *
   * The same logical item must return the same key across swipes, and different items should not
   * share a key. The deck uses this key as each mounted card's React identity so promoted next
   * cards keep their React Native view identity and do not reuse another item's native text
   * subtree.
   */
  getKey: (item: T, index: number) => string;
  /** Initial active item index. */
  initialIndex?: number;
  disabled?: boolean;
  swipeThreshold?: number | ((layout: SwipeDeckLayout) => number);
  velocityThreshold?: number;
  animationConfig?: SwipeDeckAnimationConfig;
  /**
   * Maximum number of cards kept mounted from the active card forward.
   *
   * Keep this as small as your UI allows. The default/minimum budget is `3`, which covers the
   * active card plus two forward buffered cards for smooth next-card promotion without rendering
   * the full data set. Increase it only when your design visibly exposes a deeper stack or
   * intentionally needs more cards pre-mounted.
   *
   * Values below `3` are normalized to `3` when enough forward data is available. The actual
   * mounted count never exceeds the remaining item count from the active index.
   *
   * @default 3
   */
  visibleCardCount?: number;
  containerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  onSwipe?: (event: SwipeEvent<T>) => void;
  onIndexChange?: (index: number) => void;
  onEndReached?: () => void;
};

export type SwipeDeckCardProps<T> = {
  /** Style applied to the absolute card container. */
  style?: StyleProp<ViewStyle>;
  /** Renders a card for one item in the bounded window. */
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
