# @react-native-motion-kit/swipe-deck

High-performance Tinder-style swipe deck and swipe cards for React Native, powered by Reanimated and Gesture Handler.

## Installation

```sh
npm install @react-native-motion-kit/swipe-deck react-native-gesture-handler react-native-reanimated react-native-worklets
```

Follow the Reanimated/Worklets setup for your React Native or Expo version, including adding `react-native-worklets/plugin` as the last Babel plugin.

## Usage

```tsx
import { createSwipeDeck, SwipeDeckMotion } from '@react-native-motion-kit/swipe-deck';

const profileDeckMotion = SwipeDeckMotion.tinder({
  rotation: {
    origin: 'bottom-center',
  },
  liftYFactor: 0.15,
  dismiss: {
    threshold: ({ width }) => width * 0.3,
    velocityThreshold: 800,
    minDuration: 300,
    maxDuration: 520,
  },
});

const SwipeDeck = createSwipeDeck<Profile>({
  motion: profileDeckMotion,
});

<SwipeDeck.Root
  data={profiles}
  getKey={(item) => item.id}
  visibleCardCount={3}
  onSwipe={({ item, direction }) => {
    console.log(item, direction);
  }}
  onEndReached={() => {
    console.log('No more cards');
  }}
>
  <SwipeDeck.Card>
    {({ item, role, isActive }) => <ProfileCard profile={item} role={role} active={isActive} />}
  </SwipeDeck.Card>
</SwipeDeck.Root>;
```

The deck renders a bounded forward render window only. By default it keeps up to three item-keyed cards mounted from the active card forward, which gives the active and incoming stack enough continuity without rendering the whole data set or backfilling dismissed previous cards. `visibleCardCount` is a maximum budget: values below `3` normalize to `3`, and the actual mounted count never exceeds the remaining data from the active index.

`getKey` is required because card identity is part of the rendering contract. The key must be stable for the same item across swipes so promoted cards keep their React Native view identity instead of reusing a different item's text subtree.

Buffered next cards follow swipe progress by default, scaling toward `1`, fading toward `1`, and translating toward `0` as the active card is dragged. When a swipe commits, the promoted next card keeps its item identity and a new future next item enters the bounded window instead of rendering the dismissed card as a previous card. Tune that behavior with `motion` presets such as `SwipeDeckMotion.tinder()`; factory defaults apply to every root and `Root motion` overrides them per instance. Pass motion as a preset returned from `SwipeDeckMotion.tinder(...)`. Keep motion presets stable with a module-scope constant or `useMemo` so gesture/worklet setup is not recreated by unrelated renders.

`rotation.origin` controls the rotation anchor, not the swipe decision or dismiss speed. `center` rotates around the card center. `bottom-center` rotates around the card's bottom-center edge, so the lower part feels almost anchored while the top travels through a larger arc. That makes the same `maxDegrees` feel stronger than `center`, so `SwipeDeckMotion.tinder({ rotation: { origin: 'bottom-center' } })` uses a smaller default rotation angle unless you provide `maxDegrees` explicitly.

`dismiss.offscreenMultiplier` controls the successful swipe release target. Successful swipes always dismiss offscreen; the default `1.5` sends the card to `deckWidth * 1.5`, which keeps a full-width card from stopping at the deck edge. When `duration` is omitted, velocity-derived timing is computed from the remaining distance to this target, so larger multipliers can also increase the computed duration within `minDuration` and `maxDuration`. Most apps can omit it and tune only threshold, velocity, duration, and Reanimated easing; set `offscreenMultiplier: 1.8` only when a design needs a longer throw. `dismiss.easing` accepts the same easing value as Reanimated `withTiming`; the default is `Easing.out(Easing.cubic)`.

### Motion preset stability

Prefer keeping motion presets stable with a module-scope constant or `useMemo`. The deck resolves layout-based values such as `threshold`, the offscreen release distance, and `rotation.inputRange` internally, but stable preset references still avoid unnecessary gesture/worklet setup when you pass Reanimated easing functions or spring config objects. Factory motion provides defaults, `Root motion` partially overrides only the fields it specifies, and direct root props such as `swipeThreshold` and `velocityThreshold` take final precedence.

For app-wide or deck-family defaults, define motion outside render and pass it to the factory:

```tsx
const profileDeckMotion = SwipeDeckMotion.tinder({
  rotation: {
    origin: 'bottom-center',
  },
  dismiss: {
    threshold: ({ width }) => width * 0.3,
  },
});

const ProfileDeck = createSwipeDeck<Profile>({
  motion: profileDeckMotion,
});
```

When motion depends on props or state, memoize the config at the call site:

```tsx
function ProfileScreen({ slowMotion }: { slowMotion: boolean }) {
  const motion = useMemo(
    () =>
      SwipeDeckMotion.tinder({
        dismiss: {
          minDuration: slowMotion ? 420 : 220,
          maxDuration: slowMotion ? 700 : 420,
        },
      }),
    [slowMotion],
  );

  return (
    <ProfileDeck.Root data={profiles} getKey={(item) => item.id} motion={motion}>
      <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
    </ProfileDeck.Root>
  );
}
```

### Visible card budget

```tsx
<SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={3}>
  {/* default/minimum budget */}
</SwipeDeck.Root>

<SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={9}>
  {/* deeper stacked UI */}
</SwipeDeck.Root>
```

- `visibleCardCount={2}` mounts up to `3` cards when data permits.
- `visibleCardCount={20}` with 10 data items mounts at most the remaining cards from the active index.
- Even values are kept as the maximum budget; they are not rounded up.

## API direction

The primary API is compound/slot based: `Root` owns the data and `Card` defines card rendering. Use `createSwipeDeck<T>()` to create a typed component family so `Root`, `Card`, and future slots share the same item type without repeating generics in JSX.

The MVP intentionally does not expose public `Provider`, `controller` props, `id` registry, triggers, or arbitrary prerender controls. Registry-first external control is tracked as a future design direction in the repo planning docs, not as shipped API.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
