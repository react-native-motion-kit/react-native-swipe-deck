import type { ReactElement, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

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

export type SwipeDeckMotionEasing = NonNullable<WithTimingConfig['easing']>;

export type SwipeDeckRotationOrigin = 'center' | 'bottom-center';

export type SwipeDeckTinderDragMode = 'free' | 'horizontal';

export type SwipeDeckTinderMotionConfig = {
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
  /** Active card translation behavior while dragging. */
  drag?: {
    /**
     * Drag translation mode.
     *
     * `free` follows both horizontal and vertical finger movement. `horizontal` ignores vertical
     * finger movement so the active card moves from horizontal translation only.
     *
     * @default 'free'
     */
    mode?: SwipeDeckTinderDragMode;
    /**
     * Lifts the active card upward by `abs(translationX) * liftYFactor` while dragging.
     *
     * With `mode: 'free'`, this lift is subtracted from the finger's vertical movement. With
     * `mode: 'horizontal'`, vertical finger movement is ignored and only this lift contributes to
     * the active card's Y translation.
     *
     * @default 0
     */
    liftYFactor?: number;
  };
  /** Active card rotation while dragging. */
  rotation?: {
    /**
     * Rotation anchor.
     *
     * `center` rotates around the card center. `bottom-center` rotates around the bottom-center
     * edge, so the lower part feels anchored while the top travels through a larger arc. Because
     * the same degree value feels stronger with `bottom-center`, the Tinder preset uses a smaller
     * default `maxDegrees` for that origin unless you provide `maxDegrees` explicitly.
     */
    origin?: SwipeDeckRotationOrigin;
    /**
     * Maximum absolute rotation in degrees.
     *
     * Defaults to `20` for `center` and `18` for `bottom-center` in `SwipeDeckMotion.tinder()`.
     */
    maxDegrees?: number;
    /** Horizontal drag distance that maps to `maxDegrees`. */
    inputRange?: number | ((layout: SwipeDeckLayout) => number);
  };
  /** Dismiss motion and swipe recognition defaults. */
  dismiss?: {
    /** Horizontal drag distance required to commit a swipe. Root `swipeThreshold` overrides this. */
    threshold?: number | ((layout: SwipeDeckLayout) => number);
    /** Horizontal velocity required to commit a flick swipe. Root `velocityThreshold` overrides this. */
    velocityThreshold?: number;
    /**
     * Multiplier applied to deck width for the successful swipe release target.
     *
     * Successful swipes always dismiss offscreen. The default `1.5` sends the card far enough that
     * a full-width card clears the deck instead of stopping at the edge. When `duration` is
     * omitted, velocity-derived timing is computed from the remaining distance to this target, so
     * larger multipliers can also increase the computed duration within `minDuration` and
     * `maxDuration`. Adjust only when a design needs a shorter or longer throw; values below `1`
     * are normalized to `1`.
     *
     * @default 1.5
     */
    offscreenMultiplier?: number;
    /** Fixed dismiss duration to reach the resolved offscreen target. When omitted, duration is derived from release velocity. */
    duration?: number;
    /** Minimum velocity-derived dismiss duration. */
    minDuration?: number;
    /** Maximum velocity-derived dismiss duration. */
    maxDuration?: number;
    /** Reanimated `withTiming` easing. Defaults to `Easing.out(Easing.cubic)`. */
    easing?: SwipeDeckMotionEasing;
  };
  /** Spring config used when a non-committed card returns to rest. */
  cancelSpringConfig?: WithSpringConfig;
};

export type SwipeDeckTinderMotionPreset = {
  type: 'tinder';
  config?: SwipeDeckTinderMotionConfig;
};

export type SwipeDeckMotionPreset = SwipeDeckTinderMotionPreset;

export type ResolvedSwipeDeckMotionConfig = {
  nextScale: number;
  nextOpacity: number;
  nextTranslateY: number;
  swipeProgressDistance: number;
  drag: {
    mode: SwipeDeckTinderDragMode;
    liftYFactor: number;
  };
  rotation: {
    origin: SwipeDeckRotationOrigin;
    maxDegrees: number;
    inputRange: number;
  };
  dismiss: {
    threshold?: number;
    destinationDistance: number;
    velocityThreshold?: number;
    duration?: number;
    minDuration: number;
    maxDuration: number;
    easing: SwipeDeckMotionEasing;
  };
  cancelSpringConfig?: WithSpringConfig;
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
  /** Motion preset for this deck instance. Overrides factory motion defaults. */
  motion?: SwipeDeckMotionPreset;
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

export type SwipeDeckFactoryConfig = {
  /**
   * Default motion used by all roots created from this factory.
   *
   * Prefer this for app-wide deck feel so consumers do not have to repeat motion props on every
   * `Root`. A `Root motion` prop still wins for one-off overrides.
   */
  motion?: SwipeDeckMotionPreset;
};

export type SwipeDeckInstance<T> = {
  Root: (props: SwipeDeckProps<T>) => ReactElement;
  Card: (props: SwipeDeckCardProps<T>) => ReactElement | null;
};

export type SwipeDeckStatic = {
  Root: <T>(props: SwipeDeckProps<T>) => ReactElement;
  Card: <T>(props: SwipeDeckCardProps<T>) => ReactElement | null;
};
