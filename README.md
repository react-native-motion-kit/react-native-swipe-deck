# @react-native-motion-kit/swipe-deck

[한국어](README.ko.md)

<div align="center">
  <img src="./assets/logo.png" width="300px" alt="React Native Motion Kit logo" />
</div>

High-performance Tinder-style swipe deck and swipe cards for React Native, powered by Reanimated and Gesture Handler.

## Highlights

- **Small render window**: mounts only the active card and a bounded forward stack.
- **Item-keyed rendering**: promoted cards keep their React Native view identity.
- **Typed compound API**: create one typed deck family with `createSwipeDeck<T>()`.
- **Motion presets**: tune Tinder-style drag, rotation, dismiss, next-card, and action motion.
- **Reanimated-first**: gesture and animation state stays on shared values/worklets.

## Installation

```sh
npm install @react-native-motion-kit/swipe-deck react-native-gesture-handler react-native-reanimated react-native-worklets
```

Then follow the Reanimated/Worklets setup for your React Native or Expo version.
Make sure `react-native-worklets/plugin` is the last Babel plugin.

### Minimum versions

| Package                        | Minimum  |
| ------------------------------ | -------- |
| `react`                        | `18.0.0` |
| `react-native`                 | `0.75.0` |
| `react-native-gesture-handler` | `2.24.0` |
| `react-native-reanimated`      | `4.0.0`  |
| `react-native-worklets`        | `0.5.0`  |

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

function ProfileDeckEvents() {
  ProfileDeck.useDeckEventListener('swipe', ({ item, direction }) => {
    console.log(item, direction);
  });
  ProfileDeck.useDeckEventListener('endReached', () => {
    console.log('No more cards');
  });

  return null;
}

function ProfileDeckScreen() {
  return (
    <>
      <ProfileDeckEvents />
      <ProfileDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={3}>
        <ProfileDeck.Card>
          {({ item, role, isActive }) => (
            <ProfileCard profile={item} role={role} active={isActive} />
          )}
        </ProfileDeck.Card>
      </ProfileDeck.Root>
    </>
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

- the default is `3` for smoother next-card promotion;
- values below `2` normalize to `2` when enough data exists;
- `visibleCardCount={2}` renders only the current card and the immediate next card;
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

`allowedDirections` limits which directions can be accepted as a dismiss for one Root:

```tsx
<ProfileDeck.Root data={profiles} getKey={(item) => item.id} allowedDirections={['right']}>
  <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
</ProfileDeck.Root>
```

- Omit `allowedDirections` to allow both directions.
- `['right']` or `['left']` allows only that dismiss direction.
- `[]` still lets the card drag, but every release snaps back and `swipeLeft()` / `swipeRight()` return `false`.
- `canSwipe` means “a dismiss action can currently be accepted”; it becomes `false` when no direction is allowed.

Use this factory pattern when the deck needs a named instance that can be shared by hooks and external UI.

### Deck hooks

Factory hooks expose deck-wide state, actions, and Reanimated interaction values without adding a
Provider or passing a controller prop through your tree. They are scoped to the factory instance
created by `createSwipeDeck<T>()`.

```tsx
// profile-deck.ts
export const ProfileDeck = createSwipeDeck<Profile>();
```

Use state/actions for React-rendered UI such as counters and buttons:

```tsx
function ProfileDeckControls() {
  const { activeIndex, count, canSwipe, canUndo, isCompleted } = ProfileDeck.useDeckState();
  const { swipeLeft, swipeRight, undo } = ProfileDeck.useDeckActions();
  const current = activeIndex >= 0 ? activeIndex + 1 : 0;

  return (
    <View>
      <Text>{isCompleted ? 'Done' : `${current} / ${count}`}</Text>
      <Pressable disabled={!canSwipe} onPress={swipeLeft}>
        <Text>Nope</Text>
      </Pressable>
      <Pressable disabled={!canUndo} onPress={undo}>
        <Text>Undo</Text>
      </Pressable>
      <Pressable disabled={!canSwipe} onPress={swipeRight}>
        <Text>Like</Text>
      </Pressable>
    </View>
  );
}
```

Use interaction shared values for progress-driven animated UI. These values update on the UI thread
and do not rerender React every gesture frame:

```tsx
function SwipeReactionOverlay() {
  const { signedProgress } = ProfileDeck.useDeckInteraction();

  const likeStyle = useAnimatedStyle(() => {
    const progress = Math.max(signedProgress.get(), 0);

    return {
      opacity: progress,
      transform: [{ scale: 0.9 + progress * 0.18 }],
    };
  });

  return <Animated.View pointerEvents="none" style={likeStyle} />;
}
```

Use event hooks for committed model events such as swipe, undo, index changes, and end reached:

```tsx
function ProfileDeckEvents() {
  const lastSwipe = ProfileDeck.useDeckEvent('swipe', null);
  const endReached = ProfileDeck.useDeckEvent('endReached', false);

  ProfileDeck.useDeckEventListener('undo', ({ item }) => {
    console.log('Restored', item);
  });

  return (
    <Text>
      {endReached ? 'Done' : lastSwipe ? `Last swipe: ${lastSwipe.direction}` : 'No swipe yet'}
    </Text>
  );
}
```

Event hooks are commit-level, latest-value APIs:

- `useDeckEvent()` stores only the latest event for each event name. It is not an event history.
- `initialValue` is restricted to the event payload shape, `null`, `undefined`, or `false` for
  `endReached`. Use `null` for object events such as `swipe`; `{}` is intentionally rejected so
  the event payload type is not widened away.
- If you do pass an object initial value, the object is contextually typed from `eventName`, so
  `useDeckEvent('swipe', { ... })` autocompletes `item`, `index`, and `direction`.
- For a named deck without an initial value, pass the id as the second argument:
  `useDeckEvent('swipe', 'nearby')`. If you also pass an initial value, the id remains the third
  argument.
- Event snapshots are cleared when a Root attaches and when it detaches, so the hook returns
  `initialValue` for a fresh or detached deck.
- `useDeckEventListener()` is imperative. Mounted listeners stay subscribed to the factory/id
  store across attach/detach, but they only run when the active Root emits a new event.
- Events are emitted from the commit path. During the same tick, the event payload is the source of
  truth for that event; a following `useDeckState()` render can settle just after the event.

Then render those controls around the same factory Root:

```tsx
function ProfileDeckScreen() {
  return (
    <View>
      <ProfileDeck.Root data={profiles} getKey={(item) => item.id} undoEnabled>
        <ProfileDeck.Card>
          {({ item, isActive }) => (
            <View>
              <ProfileCard profile={item} />
              {isActive ? <SwipeReactionOverlay /> : null}
            </View>
          )}
        </ProfileDeck.Card>
      </ProfileDeck.Root>
      <ProfileDeckControls />
    </View>
  );
}
```

- `useDeckState(id?)` returns React-rendered deck state such as `activeIndex`, `count`,
  `isCompleted`, `canSwipe`, and `canUndo`. Derive the active item from your own
  `data[activeIndex]` when needed so deck state stays primitive and stable.
- `useDeckActions(id?)` returns stable actions such as `swipeLeft()`, `swipeRight()`,
  and `undo()`.
  Swipe actions return `true` when accepted and `false` when the deck is unattached, disabled,
  animating, unmeasured, or completed. `undo()` returns `true` when `canUndo` is true, including
  after the deck is completed.
- `useDeckInteraction(id?)` returns Reanimated shared values for progress-driven UI. Gesture
  progress stays on the UI thread and does not rerender React every frame.
  - `interaction.phase` is a UI-thread lifecycle signal:
    `idle | dragging | dismissing | undoing`.
  - Use `phase` for visual feedback that needs to know whether the deck is actively dragging,
    dismissing, or restoring. Use `useDeckEvent` / `useDeckEventListener` for committed model
    events such as swipe, undo, and index changes.
  - `dismissing` covers the accepted dismiss lifecycle until the deck has committed the next item
    and reset interaction values. It is intentionally broader than only the offscreen animation
    frames.
  - `interaction.direction` is the raw live drag/dismiss signal (`-1 | 0 | 1`). Use
    `interaction.dismissDirection` when external UI needs the accepted dismiss side
    (`left | right | null`) on the UI thread. `dismissDirection` is lifecycle state, not the
    committed `swipe` event payload.
  - Programmatic springboard actions enter `dismissing` as soon as the action is accepted. During
    anticipation, `interaction.direction` can still be neutral until the real dismiss phase starts,
    while `interaction.dismissDirection` already contains the accepted action direction.
- `useDeckEvent(eventName, initialValue?, id?)` returns the latest committed deck event for
  React-rendered UI. It returns `undefined` or `initialValue` before the first event and after the
  deck detaches.
- `useDeckEventListener(eventName, listener, id?)` subscribes to committed model events without
  forcing React state into your app code. Listener hooks clean up automatically on unmount.
  Successful swipe events emit in `swipe -> indexChange -> endReached` order. Undo emits
  `undo -> indexChange`.

### Programmatic action motion

`motion` controls gesture-driven deck feel. `actionMotion` controls only programmatic actions
from `useDeckActions()`, such as a like/pass button. This keeps button-triggered motion tunable
without changing manual drag, threshold, or flick behavior.

```tsx
import {
  createSwipeDeck,
  SwipeDeckActionMotion,
  SwipeDeckMotion,
} from '@react-native-motion-kit/swipe-deck';

const ProfileDeck = createSwipeDeck<Profile>({
  motion: SwipeDeckMotion.tinder(),
  actionMotion: SwipeDeckActionMotion.springboard({
    anticipationDistance: ({ width }) => width * 0.04,
    anticipationDuration: 80,
    dismissDuration: 320,
  }),
});

function LikeButton() {
  const actions = ProfileDeck.useDeckActions();

  return <Pressable onPress={actions.swipeRight}>Like</Pressable>;
}
```

Available recipes:

- `SwipeDeckActionMotion.direct(options?)`: dismisses immediately toward the action direction.
  Omitted values reuse the deck's resolved dismiss duration, easing, and offscreen multiplier.
- `SwipeDeckActionMotion.springboard(options?)`: moves a little in the opposite direction first,
  then dismisses offscreen. During the anticipation phase, swipe progress stays neutral so
  opposite-side overlays do not flash; `interaction.direction` also stays neutral until the
  dismiss phase starts. Omitted dismiss values reuse the deck's resolved dismiss duration, easing,
  and offscreen multiplier.

You can override one action call without changing the Root or factory default:

```tsx
actions.swipeLeft(
  SwipeDeckActionMotion.direct({
    duration: 180,
  }),
);
```

`actionMotion` precedence is replacement-based, not deep-merged:

1. factory `actionMotion` from `createSwipeDeck({ actionMotion })`;
2. `Root actionMotion`, which replaces the factory default for that Root;
3. per-call recipe passed to `swipeLeft(recipe)` or `swipeRight(recipe)`.

Actions are callback-safe. If a React Native press event is passed to `swipeRight` or `swipeLeft`,
the event argument is ignored and the configured action motion is used.

### Undo / back swipe motion

Undo is opt-in. Add `undoEnabled` to a Root when that deck exposes undo/back-swipe UX. When
enabled, each successful swipe stores one key/index/direction metadata entry in a LIFO undo stack.
Lookups use a key-to-index map for the current `data`, and invalid entries are pruned when data or
keys change. When omitted, successful swipes do not store undo metadata, `canUndo` stays `false`,
and `actions.undo()` returns `false`.

When accepted, the deck temporarily renders the main stack from the restored index, animates that
real current card from the side it originally left, then commits the restored index.

```tsx
import { createSwipeDeck, SwipeDeckUndoMotion } from '@react-native-motion-kit/swipe-deck';

const ProfileDeck = createSwipeDeck<Profile>({
  undoMotion: SwipeDeckUndoMotion.spring({
    springConfig: {
      damping: 36,
      stiffness: 300,
      mass: 3,
    },
  }),
});

function ProfileDeckExample() {
  return (
    <ProfileDeck.Root data={profiles} getKey={(item) => item.id} undoEnabled>
      <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
    </ProfileDeck.Root>
  );
}

function UndoButton() {
  const state = ProfileDeck.useDeckState();
  const actions = ProfileDeck.useDeckActions();

  return (
    <Pressable disabled={!state.canUndo} onPress={actions.undo}>
      <Text>Undo</Text>
    </Pressable>
  );
}
```

Undo is disabled by default so decks that do not expose undo controls pay no undo-history cost.
With `undoEnabled`, repeated undo restores previously swiped cards in LIFO order while their keys
remain present in `data`. Long-running undo-enabled decks retain one metadata entry per accepted
swipe until that entry is undone or pruned by data changes. Undo motion uses zero-duration
`SwipeDeckUndoMotion.timing()` by default, so the card is restored immediately unless you opt into a
custom motion.

Available recipes:

- `SwipeDeckUndoMotion.spring(options?)`: restores the card with Reanimated `withSpring`.
- `SwipeDeckUndoMotion.timing(options?)`: restores the card with deterministic `withTiming`.

Both recipes accept:

- `from: 'auto' | 'left' | 'right'`: `auto` returns from the original swipe direction.
- `entryDistance`: number or layout callback for the offscreen start distance.

`timing` also accepts `duration` and `easing`; its default duration is `0`. `spring` accepts `springConfig`.

Undo motion precedence is replacement-based:

1. factory `undoMotion` from `createSwipeDeck({ undoMotion })`;
2. `Root undoMotion`, which replaces the factory default for that Root;
3. per-call recipe passed to `actions.undo(recipe)`.

Undo is callback-safe. If a React Native press event is passed to `undo`, the event argument is
ignored and the configured undo motion is used. During undo restore, public interaction values
(`progress`, `signedProgress`, `direction`, `translationX`, `translationY`) remain neutral, so
progress-driven swipe overlays do not flash.

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
change per render, or one-off route values. Create factories and ids outside render paths; dynamic
factories or dynamic ids create long-lived namespaces that the registry intentionally keeps stable.

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

If you only need card rendering, you can use the static API without creating a factory instance.
This is useful for small inline decks, but it does not expose factory hooks such as
`useDeckState`, `useDeckActions`, `useDeckInteraction`, `useDeckEvent`, or
`useDeckEventListener`.
Static `Root` does not accept `id`; use a factory instance when you need named deck state,
actions, interactions, or model events.
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
    <SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={2}>
      {/* minimum budget: current + immediate next */}
    </SwipeDeck.Root>
  );
}

function DefaultDeck() {
  return (
    <SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={3}>
      {/* default budget for smoother next-card promotion */}
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
| `visibleCardCount={1}`                          | Up to `2` cards when enough data exists.    |
| `visibleCardCount={2}`                          | Up to `2` cards when enough data exists.    |
| `visibleCardCount={20}` with 10 remaining items | At most those 10 remaining items.           |
| even values                                     | Kept as the maximum budget; not rounded up. |

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
