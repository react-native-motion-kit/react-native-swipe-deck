# @react-native-motion-kit/swipe-deck

[한국어](README.ko.md)

High-performance Tinder-style swipe deck and swipe cards for React Native, powered by Reanimated and Gesture Handler.

## Highlights

- **Small render window**: mounts only the active card and a bounded forward stack.
- **Item-keyed rendering**: promoted cards keep their React Native view identity.
- **Typed compound API**: create one typed deck family with `createSwipeDeck<T>()`.
- **Motion presets**: tune Tinder-style drag, rotation, dismiss, and next-card motion.
- **Reanimated-first**: gesture and animation state stays on shared values/worklets.

## Installation

```sh
npm install @react-native-motion-kit/swipe-deck react-native-gesture-handler react-native-reanimated react-native-worklets
```

Then follow the Reanimated/Worklets setup for your React Native or Expo version.
Make sure `react-native-worklets/plugin` is the last Babel plugin.

## Quick start

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

## Core concepts

### Bounded forward window

The deck never renders the whole data set.

By default, it mounts up to **3 item-keyed cards** from the active index forward:

1. current card
2. next card
3. next buffered card

This keeps the active/incoming stack continuous without backfilling dismissed previous cards.

`visibleCardCount` is a maximum budget:

- values below `3` normalize to `3` when enough data exists;
- the mounted count never exceeds the remaining data from the active index;
- even values are kept as-is and are not rounded up.

### Stable item keys

`getKey` is required because card identity is part of the rendering contract.

A key must be:

- stable for the same logical item across swipes;
- unique across different items.

That lets promoted cards keep their React Native view identity instead of reusing another item's native text subtree.

### Typed compound API

The primary API is compound/slot based:

- `Root` owns data, gesture state, and deck-level options.
- `Card` defines how each item is rendered.
- `createSwipeDeck<T>()` creates a typed component family.

```tsx
const ProfileDeck = createSwipeDeck<Profile>();

<ProfileDeck.Root data={profiles} getKey={(item) => item.id}>
  <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
</ProfileDeck.Root>;
```

This keeps `Root`, `Card`, and future slots on the same item type without repeating generics in JSX.

## Motion

### What follows swipe progress?

Buffered next cards animate with swipe progress:

- scale moves toward `1`;
- opacity moves toward `1`;
- `translateY` moves toward `0`.

When a swipe commits:

- the dismissed card exits offscreen;
- the promoted next card keeps its item identity;
- a new future item enters the bounded window.

Tune this with motion presets such as `SwipeDeckMotion.tinder(...)`.

### Motion precedence

Motion values are resolved in this order:

1. factory motion defaults from `createSwipeDeck({ motion })`;
2. `Root motion`, which partially overrides only the fields it specifies;
3. direct root props such as `swipeThreshold` and `velocityThreshold`.

### Motion preset stability

Prefer keeping motion presets stable with a module-scope constant or `useMemo`.

Stable preset references avoid unnecessary gesture/worklet setup when you pass Reanimated easing functions or spring config objects.

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

### Rotation origin

`rotation.origin` controls the rotation anchor, not swipe recognition or dismiss speed.

| origin          | Feel                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `center`        | Rotates around the card center.                                                                                          |
| `bottom-center` | Rotates around the bottom-center edge, so the lower part feels almost anchored and the top travels through a larger arc. |

Because the same `maxDegrees` feels stronger with `bottom-center`, the Tinder preset uses a smaller default rotation angle for that origin unless you provide `maxDegrees` explicitly.

### Dismiss target

`dismiss.offscreenMultiplier` controls the successful swipe release target.

- Successful swipes always dismiss offscreen.
- The default `1.5` sends the card to `deckWidth * 1.5`.
- Values below `1` are normalized to `1`.
- If `duration` is omitted, velocity-derived timing is computed from the remaining distance to this target.

Most apps can skip this option and tune only:

- `threshold`
- `velocityThreshold`
- `duration`, `minDuration`, `maxDuration`
- Reanimated `easing`

`dismiss.easing` accepts the same easing value as Reanimated `withTiming`.
The default is `Easing.out(Easing.cubic)`.

## Visible card budget

```tsx
<SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={3}>
  {/* default/minimum budget */}
</SwipeDeck.Root>

<SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={9}>
  {/* deeper stacked UI */}
</SwipeDeck.Root>
```

| Input                                           | Mounted cards                               |
| ----------------------------------------------- | ------------------------------------------- |
| `visibleCardCount={2}`                          | Up to `3` cards when enough data exists.    |
| `visibleCardCount={20}` with 10 remaining items | At most those 10 remaining items.           |
| even values                                     | Kept as the maximum budget; not rounded up. |

## API direction

The MVP keeps the public API focused on `Root` and `Card`, but the longer-term direction is to expand into a registry/controller model for external control.

Future API directions may include:

- public `Provider` or registry boundary;
- controller hooks for imperative actions;
- `id`-based deck registration;
- trigger components for external swipe controls;
- more explicit prerender/window controls.

Those pieces are intentionally not part of the first shipped surface yet. The current API keeps the core deck small while leaving room for registry-first external control later.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
