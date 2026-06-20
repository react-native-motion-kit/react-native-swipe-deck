import type { ReactElement, ReactNode } from 'react';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';
import type { SharedValue, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

export type SwipeDirection = 'left' | 'right';

export type SwipeEventSource = 'gesture' | 'programmatic';

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
  /**
   * How the swipe was committed.
   *
   * `gesture` means the user pan gesture released past the configured threshold/velocity policy.
   * `programmatic` means the swipe was committed through `actions.swipeLeft()` or
   * `actions.swipeRight()`. Programmatic does not imply a button; callers may map it to their own UI
   * trigger when appropriate.
   */
  source: SwipeEventSource;
};

export type UndoEvent<T> = {
  item: T;
  index: number;
  /** Direction the item originally swiped out before it was restored. */
  direction: SwipeDirection;
};

export type IndexChangeEvent = {
  index: number;
};

export type SwipeDeckEventMap<T> = {
  swipe: SwipeEvent<T>;
  undo: UndoEvent<T>;
  indexChange: IndexChangeEvent;
  endReached: true;
};

export type SwipeDeckEventName = keyof SwipeDeckEventMap<unknown>;

export type SwipeDeckEventListener<T, K extends keyof SwipeDeckEventMap<T>> = (
  event: SwipeDeckEventMap<T>[K],
) => void;

export type SwipeDeckEventInitialValue<T, K extends keyof SwipeDeckEventMap<T>> =
  | SwipeDeckEventMap<T>[K]
  | null
  | undefined
  | (K extends 'endReached' ? false : never);

/**
 * Returns the latest committed model event for React-rendered UI.
 *
 * This is a latest-value snapshot, not an event history. It returns `undefined` or
 * `initialValue` before the first event for that name and after the deck attaches/detaches and
 * clears event snapshots.
 *
 * The initial value is intentionally restricted to the event payload shape, `null`, `undefined`,
 * or `false` for `endReached`. This keeps calls such as `useDeckEvent('swipe', {})` from widening
 * the return type and hiding the actual event payload.
 *
 * Event snapshots are published from the commit path. A listener/snapshot can observe the event
 * before the next `useDeckState()` render has settled, so prefer the event payload itself when you
 * need the committed item/index for that event.
 */
export type SwipeDeckEventHook<T> = {
  <K extends keyof SwipeDeckEventMap<T>>(eventName: K): SwipeDeckEventMap<T>[K] | undefined;
  <K extends keyof SwipeDeckEventMap<T>, const TInitial extends SwipeDeckEventInitialValue<T, K>>(
    eventName: K,
    initialValue: TInitial,
    id?: string,
  ): SwipeDeckEventMap<T>[K] | TInitial;
  <K extends keyof SwipeDeckEventMap<T>>(
    eventName: K,
    id: string,
  ): SwipeDeckEventMap<T>[K] | undefined;
};

/**
 * Subscribes to committed model events without creating app-owned state.
 *
 * Listener subscriptions clean up on unmount. Event snapshots are cleared on attach/detach, but
 * mounted listeners remain subscribed to the factory/id store and only run when the Root emits a
 * new event.
 */
export type SwipeDeckEventListenerHook<T> = <K extends keyof SwipeDeckEventMap<T>>(
  eventName: K,
  listener: SwipeDeckEventListener<T, K>,
  id?: string,
) => void;

export type SwipeDeckMotionEasing = NonNullable<WithTimingConfig['easing']>;

export type SwipeDeckTinderRotationMode = 'fixed' | 'grab-position';

export type SwipeDeckTinderFixedRotationOrigin = 'center' | 'top-center' | 'bottom-center';

export type SwipeDeckTinderRotationDirection = 'default' | 'reverse';

export type SwipeDeckTinderDragMode = 'free' | 'horizontal';

export type SwipeDeckTinderRotationBaseConfig = {
  /**
   * Maximum absolute rotation in degrees.
   *
   * Defaults to `20` for `center` and `18` for edge-based rotation in
   * `SwipeDeckMotion.tinder()`.
   */
  maxDegrees?: number;
  /** Horizontal drag distance that maps to `maxDegrees`. */
  inputRange?: number | ((layout: SwipeDeckLayout) => number);
};

export type SwipeDeckTinderFixedRotationConfig = SwipeDeckTinderRotationBaseConfig & {
  /**
   * Fixed rotation mode.
   *
   * Use this when you want to opt out of the default grab-position rotation with a stable
   * anchor and optional direction override for every gesture.
   */
  mode: 'fixed';
  /**
   * Fixed rotation anchor.
   *
   * `center` rotates around the card center. `top-center` rotates around the top-center edge.
   * `bottom-center` rotates around the bottom-center edge.
   *
   * @default 'center' when `mode` is `fixed`
   */
  origin?: SwipeDeckTinderFixedRotationOrigin;
  /**
   * Fixed rotation sign.
   *
   * `default` keeps the normal swipe rotation. `reverse` flips only the rotation sign while
   * keeping the same anchor, threshold, dismiss target, and duration calculations.
   *
   * @default 'default' when `mode` is `fixed`
   */
  direction?: SwipeDeckTinderRotationDirection;
};

export type SwipeDeckTinderGrabPositionRotationConfig = SwipeDeckTinderRotationBaseConfig & {
  /**
   * Gesture-start-position based rotation mode.
   *
   * Upper-half grabs use a top-center anchor with the default rotation sign. Lower-half grabs use a
   * bottom-center anchor with the reverse rotation sign. Set `direction: 'reverse'` to invert that
   * mapping. `origin` is omitted because the deck resolves it from the gesture start position.
   */
  mode: 'grab-position';
  /**
   * Grab-position rotation sign mapping.
   *
   * `default` matches Tinder-like behavior: upper-half grabs use the default sign and lower-half
   * grabs use the reverse sign. `reverse` flips that mapping.
   *
   * @default 'default'
   */
  direction?: SwipeDeckTinderRotationDirection;
};

export type SwipeDeckTinderRotationConfig =
  | SwipeDeckTinderFixedRotationConfig
  | SwipeDeckTinderGrabPositionRotationConfig;

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
  /**
   * Active card rotation while dragging.
   *
   * Defaults to Tinder-like `mode: 'grab-position'`. Use `mode: 'fixed'` when every gesture
   * should use the same anchor and rotation direction.
   */
  rotation?: SwipeDeckTinderRotationConfig;
  /** Dismiss motion and swipe recognition defaults. */
  dismiss?: {
    /** Horizontal drag distance required to commit a swipe. Root `swipeThreshold` overrides this. */
    threshold?: number | ((layout: SwipeDeckLayout) => number);
    /** Horizontal velocity required to commit a flick swipe. Root `velocityThreshold` overrides this. */
    velocityThreshold?: number;
    /**
     * Multiplier applied to the release-time distance needed to clear the rotated card bounds.
     *
     * Successful swipes always dismiss offscreen. The deck resolves the minimum clear distance from
     * the actual swipe direction, rotation mode, rotation direction, and gesture start position,
     * then multiplies it by this value. When `duration` is omitted, velocity-derived timing is
     * computed from the remaining distance to this target, so larger multipliers can also increase
     * the computed duration within `minDuration` and `maxDuration`. Values below `1` are normalized
     * to `1`.
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

type SwipeDeckActionMotionKind = 'swipe-deck-action-motion';

export type SwipeDeckActionDirectMotionOptions = {
  /** Fixed programmatic dismiss duration. Omit to reuse the resolved deck dismiss duration rules. */
  duration?: number;
  /** Reanimated `withTiming` easing for the programmatic dismiss phase. */
  easing?: SwipeDeckMotionEasing;
  /** Programmatic offscreen target multiplier. Omit to reuse the resolved deck dismiss multiplier. */
  offscreenMultiplier?: number;
};

export type SwipeDeckActionSpringboardMotionOptions = {
  /**
   * Opposite-direction anticipation distance before dismissing.
   *
   * Defaults to `layout.width * 0.04`.
   */
  anticipationDistance?: number | ((layout: SwipeDeckLayout) => number);
  /** Anticipation phase duration in milliseconds. Defaults to `80`. */
  anticipationDuration?: number;
  /** Anticipation phase easing. Omit to reuse the resolved action dismiss easing. */
  anticipationEasing?: SwipeDeckMotionEasing;
  /** Fixed dismiss duration after anticipation. Omit to reuse the resolved deck dismiss duration rules. */
  dismissDuration?: number;
  /** Dismiss phase easing. Omit to reuse the resolved deck dismiss easing. */
  dismissEasing?: SwipeDeckMotionEasing;
  /** Programmatic offscreen target multiplier. Omit to reuse the resolved deck dismiss multiplier. */
  offscreenMultiplier?: number;
};

export type SwipeDeckActionDirectMotionRecipe = SwipeDeckActionDirectMotionOptions & {
  readonly kind: SwipeDeckActionMotionKind;
  readonly type: 'direct';
};

export type SwipeDeckActionSpringboardMotionRecipe = SwipeDeckActionSpringboardMotionOptions & {
  readonly kind: SwipeDeckActionMotionKind;
  readonly type: 'springboard';
};

export type SwipeDeckActionMotionRecipe =
  | SwipeDeckActionDirectMotionRecipe
  | SwipeDeckActionSpringboardMotionRecipe;

type SwipeDeckUndoMotionKind = 'swipe-deck-undo-motion';

export type SwipeDeckUndoMotionFrom = 'auto' | SwipeDirection;

export type SwipeDeckUndoSpringMotionOptions = {
  /**
   * Side the restored card should enter from.
   *
   * `auto` uses the original swipe direction so a right-swiped card returns from the right.
   *
   * @default 'auto'
   */
  from?: SwipeDeckUndoMotionFrom;
  /**
   * Offscreen entry distance before restoring to center.
   *
   * Defaults to the same rotated-card clear distance used by programmatic dismiss.
   */
  entryDistance?: number | ((layout: SwipeDeckLayout) => number);
  /** Reanimated `withSpring` config used for the restore phase. */
  springConfig?: WithSpringConfig;
};

export type SwipeDeckUndoTimingMotionOptions = {
  /**
   * Side the restored card should enter from.
   *
   * `auto` uses the original swipe direction so a right-swiped card returns from the right.
   *
   * @default 'auto'
   */
  from?: SwipeDeckUndoMotionFrom;
  /**
   * Offscreen entry distance before restoring to center.
   *
   * Defaults to the same rotated-card clear distance used by programmatic dismiss.
   */
  entryDistance?: number | ((layout: SwipeDeckLayout) => number);
  /** Fixed restore duration. */
  duration?: number;
  /** Reanimated `withTiming` easing. */
  easing?: SwipeDeckMotionEasing;
};

export type SwipeDeckUndoSpringMotionRecipe = SwipeDeckUndoSpringMotionOptions & {
  readonly kind: SwipeDeckUndoMotionKind;
  readonly type: 'spring';
};

export type SwipeDeckUndoTimingMotionRecipe = SwipeDeckUndoTimingMotionOptions & {
  readonly kind: SwipeDeckUndoMotionKind;
  readonly type: 'timing';
};

export type SwipeDeckUndoMotionRecipe =
  | SwipeDeckUndoSpringMotionRecipe
  | SwipeDeckUndoTimingMotionRecipe;

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
    mode: SwipeDeckTinderRotationMode;
    origin?: SwipeDeckTinderFixedRotationOrigin;
    direction?: SwipeDeckTinderRotationDirection;
    maxDegrees: number;
    inputRange: number;
  };
  dismiss: {
    threshold?: number;
    offscreenMultiplier: number;
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
   * Deck instance id inside this factory namespace.
   *
   * This is not an item key. Use it only for a small, stable set of deck instances rendered
   * from the same `createSwipeDeck<T>()` factory, such as `"nearby"` or `"recommended"`.
   * Do not derive it from item ids, timestamps, or rapidly changing route/render values.
   *
   * Omit this for the common single-deck case.
   */
  id?: string;
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
  /**
   * Dismiss directions accepted by this Root.
   *
   * Omit to allow both directions. Pass `['left']` or `['right']` to allow only one direction.
   * Pass an empty array to allow dragging but reject every dismiss release and programmatic swipe
   * action. Rejected gesture releases use the same snap-back path as threshold misses.
   */
  allowedDirections?: readonly SwipeDirection[];
  swipeThreshold?: number | ((layout: SwipeDeckLayout) => number);
  velocityThreshold?: number;
  /** Motion preset for this deck instance. Overrides factory motion defaults. */
  motion?: SwipeDeckMotionPreset;
  /** Programmatic swipe motion recipe for actions such as `swipeLeft()` and `swipeRight()`. */
  actionMotion?: SwipeDeckActionMotionRecipe;
  /** Programmatic undo restore motion recipe for `actions.undo()`. */
  undoMotion?: SwipeDeckUndoMotionRecipe;
  /**
   * Enables undo stack tracking for `actions.undo()`.
   *
   * When omitted, successful swipes do not store undo metadata, `canUndo` remains `false`, and
   * `actions.undo()` returns `false`. Enable this only for decks that expose undo/back-swipe UX.
   *
   * @default false
   */
  undoEnabled?: boolean;
  /**
   * Maximum number of cards kept mounted from the active card forward.
   *
   * Keep this as small as your UI allows. The default budget is `3`, which covers the active card
   * plus two forward buffered cards for smooth next-card promotion without rendering the full data
   * set. The minimum budget is `1`, which renders only the active card. Use `2` when your design
   * needs the immediate next card pre-mounted for stack/promotion visuals, and increase it only when
   * your design visibly exposes a deeper stack or intentionally needs more cards pre-mounted.
   *
   * Values below `1` are normalized to `1` when enough forward data is available. The actual
   * mounted count never exceeds the remaining item count from the active index.
   *
   * @default 3
   */
  visibleCardCount?: number;
  containerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
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
  /**
   * Default programmatic swipe motion used by all roots created from this factory.
   *
   * A `Root actionMotion` prop replaces this default for that root. Per-call action recipes replace
   * both factory and root defaults for that invocation only.
   */
  actionMotion?: SwipeDeckActionMotionRecipe;
  /**
   * Default programmatic undo restore motion used by all roots created from this factory.
   *
   * A `Root undoMotion` prop replaces this default for that root. Per-call undo recipes replace
   * both factory and root defaults for that invocation only.
   */
  undoMotion?: SwipeDeckUndoMotionRecipe;
};

export type SwipeDeckState = {
  /** Current active item index, or `-1` before the deck is attached. */
  activeIndex: number;
  /** Total number of items in the attached deck. */
  count: number;
  /** Whether an attached deck has consumed all items. Unattached decks are not completed. */
  isCompleted: boolean;
  /** Whether a deck action can currently be accepted from React. */
  canSwipe: boolean;
  /** Whether the latest valid swipe history entry can currently be restored. */
  canUndo: boolean;
};

export type SwipeDeckAction = {
  /** Programmatically dismiss the active card. Returns whether the action was accepted. */
  (): boolean;
  /** Programmatically dismiss the active card with a one-call action motion override. */
  (motion: SwipeDeckActionMotionRecipe): boolean;
  /** Callback-safe overload: event-like arguments are ignored at runtime. */
  (event: GestureResponderEvent): boolean;
};

export type SwipeDeckUndoAction = {
  /** Programmatically restore the latest swiped card. Returns whether the action was accepted. */
  (): boolean;
  /** Programmatically restore with a one-call undo motion override. */
  (motion: SwipeDeckUndoMotionRecipe): boolean;
  /** Callback-safe overload: event-like arguments are ignored at runtime. */
  (event: GestureResponderEvent): boolean;
};

export type SwipeDeckActions = {
  /** Programmatically dismiss the active card to the left. Returns whether the action was accepted. */
  swipeLeft: SwipeDeckAction;
  /** Programmatically dismiss the active card to the right. Returns whether the action was accepted. */
  swipeRight: SwipeDeckAction;
  /** Programmatically restore the latest swiped card. Returns whether the action was accepted. */
  undo: SwipeDeckUndoAction;
};

export type SwipeDeckInteractionPhase = 'idle' | 'dragging' | 'dismissing' | 'undoing';

export type SwipeDeckInteraction = {
  /** Absolute swipe progress from `0` to `1`. */
  progress: SharedValue<number>;
  /** Signed swipe progress from `-1` to `1`; left is negative and right is positive. */
  signedProgress: SharedValue<number>;
  /** Current swipe direction signal; left is `-1`, idle is `0`, right is `1`. */
  direction: SharedValue<-1 | 0 | 1>;
  /**
   * Accepted dismiss direction for lifecycle-driven visual feedback.
   *
   * This is not the committed swipe event payload. It becomes non-null only after a dismiss is
   * accepted and resets after the deck commits and clears interaction values.
   */
  dismissDirection: SharedValue<SwipeDirection | null>;
  /** Active card horizontal translation. */
  translationX: SharedValue<number>;
  /** Active card vertical translation. */
  translationY: SharedValue<number>;
  /** Whether the deck is currently being dragged or dismissed. */
  isDragging: SharedValue<boolean>;
  /**
   * UI-thread lifecycle phase for external visual feedback.
   *
   * Use model events for committed state changes; this value is for frame-synchronous UI.
   */
  phase: SharedValue<SwipeDeckInteractionPhase>;
};

export type SwipeDeckInstance<T> = {
  Root: (props: SwipeDeckProps<T>) => ReactElement;
  Card: (props: SwipeDeckCardProps<T>) => ReactElement | null;
  useDeckState: (id?: string) => SwipeDeckState;
  useDeckActions: (id?: string) => SwipeDeckActions;
  useDeckInteraction: (id?: string) => SwipeDeckInteraction;
  useDeckEvent: SwipeDeckEventHook<T>;
  useDeckEventListener: SwipeDeckEventListenerHook<T>;
};

export type SwipeDeckStaticRootProps<T> = Omit<SwipeDeckProps<T>, 'id'>;

export type SwipeDeckStatic = {
  Root: <T>(props: SwipeDeckStaticRootProps<T>) => ReactElement;
  Card: <T>(props: SwipeDeckCardProps<T>) => ReactElement | null;
};
