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

Create one typed deck family for your item type when you want `Root`, `Card`, external actions, state, and interaction hooks to share the same factory instance.

```tsx
import { createSwipeDeck, SwipeDeckMotion } from '@react-native-motion-kit/swipe-deck';

const ProfileDeck = createSwipeDeck<Profile>({
  motion: SwipeDeckMotion.tinder({
    drag: {
      mode: 'horizontal',
      liftYFactor: 0.15,
    },
    rotation: {
      mode: 'grab-position',
    },
    dismiss: {
      threshold: ({ width }) => width * 0.3,
      velocityThreshold: 800,
      minDuration: 300,
      maxDuration: 520,
    },
  }),
});

function ProfileDeckScreen() {
  return (
    <ProfileDeck.Root
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
      <ProfileDeck.Card>
        {({ item, role, isActive }) => <ProfileCard profile={item} role={role} active={isActive} />}
      </ProfileDeck.Card>
    </ProfileDeck.Root>
  );
}
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

function ProfileDeckScreen() {
  return (
    <ProfileDeck.Root data={profiles} getKey={(item) => item.id}>
      <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
    </ProfileDeck.Root>
  );
}
```

This keeps `Root`, `Card`, and future slots on the same item type without repeating generics in JSX.

Use this factory pattern when the deck needs a named instance that can be shared by hooks and external UI.

### Deck hooks

Deck-wide values are exposed through factory-scoped hooks instead of card render props.

```tsx
// profile-deck.ts
export const ProfileDeck = createSwipeDeck<Profile>();
```

```tsx
function ProfileDeckScreen() {
  const state = ProfileDeck.useDeckState();
  const actions = ProfileDeck.useDeckActions();
  const interaction = ProfileDeck.useDeckInteraction();

  return (
    <ProfileDeck.Root data={profiles} getKey={(item) => item.id}>
      <ProfileDeck.Card>
        {({ item }) => (
          <ProfileCard
            profile={item}
            current={state.activeIndex + 1}
            total={state.count}
            onLike={actions.swipeRight}
            swipeProgress={interaction.signedProgress}
          />
        )}
      </ProfileDeck.Card>
    </ProfileDeck.Root>
  );
}
```

- `useDeckState(id?)` returns React-rendered deck state such as `activeIndex`, `count`,
  `isCompleted`, and `canSwipe`. Derive the active item from your own `data[activeIndex]`
  when needed so deck state stays primitive and stable.
- `useDeckActions(id?)` returns stable actions such as `swipeLeft()` and `swipeRight()`.
  Actions return `true` when accepted and `false` when the deck is unattached, disabled,
  animating, unmeasured, or completed.
- `useDeckInteraction(id?)` returns Reanimated shared values for progress-driven UI. Gesture
  progress stays on the UI thread and does not rerender React every frame.

Use an `id` only when you render multiple roots from the same factory:

```tsx
function MultiDeckScreen() {
  const nearbyState = ProfileDeck.useDeckState('nearby');

  return (
    <>
      <ProfileDeck.Root id="recommended" data={recommended} getKey={(item) => item.id}>
        <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
      </ProfileDeck.Root>

      <ProfileDeck.Root id="nearby" data={nearby} getKey={(item) => item.id}>
        <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
      </ProfileDeck.Root>

      <Text>{nearbyState.activeIndex + 1}</Text>
    </>
  );
}
```

`id` is a factory-scoped deck namespace, not an item key. Two different factories can both
use the default id safely, but two mounted roots from the same factory and same id are invalid.
Keep ids stable and low-cardinality, such as screen-level names (`"nearby"` or `"recommended"`).
The registry keeps one store per id for the lifetime of the factory so hooks, actions, and
interaction shared values stay stable. Do not derive ids from item ids, timestamps, values that
change per render, or one-off route values.

If you prefer shorter names, destructure from the same factory instance and export aliases:

```ts
const ProfileDeck = createSwipeDeck<Profile>();

export const {
  Root: ProfileDeckRoot,
  Card: ProfileDeckCard,
  useDeckState: useProfileDeckState,
  useDeckActions: useProfileDeckActions,
  useDeckInteraction: useProfileDeckInteraction,
} = ProfileDeck;
```

Create the factory once per deck family and export it from a shared module. Hooks, actions, and interactions only connect to Roots created by that same factory instance. Calling `createSwipeDeck<Profile>()` again creates a separate registry namespace even if the item type and id are the same, so hooks from one factory cannot control Roots from another.

### Simple inline usage

If you only need card rendering and callbacks, you can use the static API without creating a factory instance.
This is useful for small inline decks, but it does not expose `useDeckState`, `useDeckActions`, or `useDeckInteraction`.
Because static `Root` and `Card` do not share a factory type, pass the item type to `Card` when you want typed render props.

```tsx
import { SwipeDeck } from '@react-native-motion-kit/swipe-deck';

function InlineDeck() {
  return (
    <SwipeDeck.Root data={profiles} getKey={(item) => item.id}>
      <SwipeDeck.Card<Profile>>{({ item }) => <ProfileCard profile={item} />}</SwipeDeck.Card>
    </SwipeDeck.Root>
  );
}
```

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

### Drag mode

`drag.mode` controls how the active card uses finger translation while dragging.

| mode         | Active card movement                                                         |
| ------------ | ---------------------------------------------------------------------------- |
| `free`       | Follows both horizontal and vertical finger movement.                        |
| `horizontal` | Ignores vertical finger movement and moves from horizontal translation only. |

`drag.liftYFactor` lifts the active card upward by `abs(translationX) * liftYFactor`.

```tsx
SwipeDeckMotion.tinder({
  drag: {
    mode: 'horizontal',
    liftYFactor: 0,
  },
  rotation: {
    mode: 'fixed',
    origin: 'bottom-center',
  },
});
```

Use `drag.mode: 'horizontal'` with `rotation: { mode: 'fixed', origin: 'bottom-center' }` for a lower-anchor, left/right-only feel.

### Motion precedence

Motion values are resolved in this order:

1. factory motion defaults from `createSwipeDeck({ motion })`;
2. `Root motion`, which partially overrides only the fields it specifies;
3. direct root props such as `swipeThreshold` and `velocityThreshold`.

Factory and Root motion are deep-merged. Numeric rotation tuning such as `maxDegrees` and `inputRange` is preserved unless the Root motion explicitly overrides it; changing `rotation.mode` does not reset those values to mode defaults.

### Motion preset stability

Prefer keeping motion presets stable with a module-scope constant or `useMemo`.

Stable preset references avoid unnecessary gesture/worklet setup when you pass Reanimated easing functions or spring config objects.

For app-wide or deck-family defaults, define motion outside render and pass it to the factory:

```tsx
const profileDeckMotion = SwipeDeckMotion.tinder({
  rotation: {
    mode: 'fixed',
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

### Rotation

`rotation.mode` controls whether the rotation anchor is fixed or resolved from the gesture start position. The default is Tinder-like `mode: 'grab-position'`. Rotation settings do not change swipe recognition. When `dismiss.duration` is omitted, however, velocity-derived dismiss timing can change because the release target is computed from the rotated card geometry.

#### Fixed rotation

Use fixed rotation when every gesture should use the same anchor instead of the default grab-position behavior.

| origin          | Feel                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `center`        | Rotates around the card center.                                                                                          |
| `top-center`    | Rotates around the top-center edge, so the upper part feels anchored and the bottom travels through a larger arc.        |
| `bottom-center` | Rotates around the bottom-center edge, so the lower part feels almost anchored and the top travels through a larger arc. |

```tsx
SwipeDeckMotion.tinder({
  rotation: {
    mode: 'fixed',
    origin: 'bottom-center',
    direction: 'default',
  },
});
```

Use `direction: 'reverse'` when you want the same fixed anchor but the opposite rotation sign.

#### Grab-position rotation

Grab-position rotation is the default Tinder-like behavior. Use it explicitly when you want to override only shared rotation values such as `maxDegrees` or `inputRange`.

```tsx
SwipeDeckMotion.tinder({
  rotation: {
    mode: 'grab-position',
    direction: 'default',
    maxDegrees: 25,
  },
});
```

Upper-half grabs use a top-center anchor with the default rotation sign. Lower-half grabs use a bottom-center anchor with the reverse rotation sign. `direction: 'reverse'` flips that mapping. `maxDegrees` and `inputRange` are still configurable, but fixed `origin` is intentionally omitted in this mode.

Because the same `maxDegrees` feels stronger with edge-based rotation, the Tinder preset uses a smaller default rotation angle for `top-center`, `bottom-center`, and `grab-position` unless you provide `maxDegrees` explicitly.

### Dismiss target

`dismiss.offscreenMultiplier` controls the successful swipe release target.

- Successful swipes always dismiss offscreen.
- The default `1.5` sends the card to `clearDistance * 1.5`.
- `clearDistance` is resolved at release from the actual swipe direction, rotation mode, rotation direction, and gesture start position.
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
function CompactDeck() {
  return (
    <SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={3}>
      {/* default/minimum budget */}
    </SwipeDeck.Root>
  );
}

function DeepStackDeck() {
  return (
    <SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={9}>
      {/* deeper stacked UI */}
    </SwipeDeck.Root>
  );
}
```

| Input                                           | Mounted cards                               |
| ----------------------------------------------- | ------------------------------------------- |
| `visibleCardCount={2}`                          | Up to `3` cards when enough data exists.    |
| `visibleCardCount={20}` with 10 remaining items | At most those 10 remaining items.           |
| even values                                     | Kept as the maximum budget; not rounded up. |

## API direction

The current public API already includes factory-scoped deck hooks and `id`-based deck registration:

- `createSwipeDeck<T>()` creates a typed factory namespace.
- `Root` and `Card` render the deck.
- `useDeckState(id?)`, `useDeckActions(id?)`, and `useDeckInteraction(id?)` expose deck-wide state, actions, and Reanimated interaction values from that factory namespace.
- `id` selects a deck inside the same factory when multiple roots are mounted.

Future API directions may include:

- public `Provider` or custom registry boundary;
- trigger components for external swipe controls;
- undo/back-swipe APIs;
- more explicit prerender/window controls;
- lower-level controller/event APIs when they improve DX without hurting performance.

The current shipped surface intentionally avoids a public Provider or trigger component for now. Factory-scoped hooks cover the main external UI use cases while keeping the core deck small.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
