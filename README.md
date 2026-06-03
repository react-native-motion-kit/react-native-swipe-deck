# @react-native-motion-kit/swipe-deck

High-performance Tinder-style swipe deck and swipe cards for React Native, powered by Reanimated and Gesture Handler.

## Installation

```sh
npm install @react-native-motion-kit/swipe-deck react-native-gesture-handler react-native-reanimated react-native-worklets
```

Follow the Reanimated/Worklets setup for your React Native or Expo version, including adding `react-native-worklets/plugin` as the last Babel plugin.

## Usage

```tsx
import { createSwipeDeck } from '@react-native-motion-kit/swipe-deck';

const SwipeDeck = createSwipeDeck<Profile>();

<SwipeDeck.Root
  data={profiles}
  getKey={(item) => item.id}
  visibleCardCount={3}
  animationConfig={{
    nextScale: 0.95,
    nextOpacity: 0.92,
    nextTranslateY: 12,
    swipeProgressDistance: ({ width }) => width * 0.5,
  }}
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

Buffered next cards follow swipe progress by default, scaling toward `1`, fading toward `1`, and translating toward `0` as the active card is dragged. When a swipe commits, the promoted next card keeps its item identity and a new future next item enters the bounded window instead of rendering the dismissed card as a previous card. Tune that behavior with `animationConfig`.

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
