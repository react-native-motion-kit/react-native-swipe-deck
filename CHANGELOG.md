# @react-native-motion-kit/swipe-deck

## 1.5.0

### Minor Changes

- [#23](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/23) [`3fecbb0`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/3fecbb0f6a6055c4150b930f9da49740f8430d3a) Thanks [@saseungmin](https://github.com/saseungmin)! - Add opt-in upward swipe support across gestures, programmatic actions, events, interaction state,
  and undo, with a public live `interaction.intentDirection` source for one-at-a-time reaction UI.

  ```tsx
  function DeckControls() {
    const { swipeUp } = ProfileDeck.useDeckActions();

    return (
      <Pressable onPress={swipeUp}>
        <Text>Super Like</Text>
      </Pressable>
    );
  }

  <ProfileDeck.Root
    data={profiles}
    getKey={(item) => item.id}
    allowedDirections={["left", "right", "up"]}
  >
    <ProfileDeck.Card>
      {({ item }) => <ProfileCard profile={item} />}
    </ProfileDeck.Card>
  </ProfileDeck.Root>;
  ```

  Upward dismisses are backward-compatible and explicitly opt-in: omitting `allowedDirections`
  continues to allow only left and right. Gesture-driven up requires the default `drag.mode: 'free'`;
  horizontal drag mode rejects an upward release through the existing snap-back motion, while
  `swipeUp()` remains available when `'up'` is allowed.

  `SwipeDirection`, committed swipe and undo events, `interaction.intentDirection`, and
  `interaction.dismissDirection` now include `'up'`. Only centered upward gestures enter the internal
  up cone; upper-left and upper-right diagonals stay horizontal. When the raw semantic winner is not
  allowed, `intentDirection`, `progress`, `signedProgress`, and numeric `direction` stay neutral while
  physical card translation still follows the finger. Programmatic up actions support the existing
  direct and springboard action-motion recipes, and an upward card can be restored through the
  existing undo flow.

  TypeScript consumers with exhaustive `switch` statements or `Record<SwipeDirection, ...>` mappings
  must add an `'up'` branch even when a deck does not opt into upward dismisses.

### Patch Changes

- [#25](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/25) [`9be410c`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/9be410cb8bfb82d8b739ad1899e6ff377ce64d53) Thanks [@saseungmin](https://github.com/saseungmin)! - Prevent gesture-driven dismisses from briefly jumping when the finger is released on Android.
  Committed swipes now animate only their primary dismiss axis, preserving the final cross-axis drag
  position instead of restarting an unnecessary timing animation during the gesture handoff.

- [#26](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/26) [`85ccb41`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/85ccb41ca4975f8db94bef4df1852c5dc6b3cace) Thanks [@saseungmin](https://github.com/saseungmin)! - Reclaim factory registry entries after the final committed `Root` or public hook consumer for an
  id unmounts. Stable navigation route keys are now supported as deck instance ids, provided the key
  does not change while the screen is mounted.

  The duplicate-Root rule is unchanged: two simultaneous Roots from the same factory still require
  distinct ids. This release also changes the documented identity contract. Actions and interaction
  shared values stay stable only while at least one committed consumer retains the id; after a gap
  with zero committed consumers and deferred eviction, a later consumer for the same id receives a
  fresh action/interaction identity.

## 1.4.1

### Patch Changes

- [`607a44e`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/607a44edf676a6fa10296c760b3a59a6f7e42774) Thanks [@saseungmin](https://github.com/saseungmin)! - docs: add swipe deck preview asset

## 1.4.0

### Minor Changes

- [#21](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/21) [`e95ea8a`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/e95ea8a2f47786fc2a1f56f814c0dc0b3f4292ca) Thanks [@saseungmin](https://github.com/saseungmin)! - Add `interactive` to `SwipeDeck.Card` so active-card children such as CTA buttons or links can receive touches without exposing raw React Native `pointerEvents`.

  ```tsx
  <ProfileDeck.Card interactive={({ item }) => item.type === "ad"}>
    {({ item }) => <AdCard ad={item} onPressCta={() => openAd(item)} />}
  </ProfileDeck.Card>
  ```

  Only the active card can become interactive. Background cards remain non-interactive to preserve swipe-deck safety.

### Patch Changes

- [#19](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/19) [`16b7636`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/16b76360f837758ad48baa6b1ea48f935e40e9fa) Thanks [@saseungmin](https://github.com/saseungmin)! - Update the README and docs quick start links for the published docs site and Expo Snack demo.

## 1.3.1

### Patch Changes

- [#15](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/15) [`3521a83`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/3521a83948a521a94eef9c0a9dd6acd9e7baf1a5) Thanks [@saseungmin](https://github.com/saseungmin)! - Add the Rspress documentation site and refresh the npm package metadata.

- [#18](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/18) [`4a326d6`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/4a326d623ccfd88b6844994dfd9d7c665a37a18b) Thanks [@saseungmin](https://github.com/saseungmin)! - Migrate repository tooling from Yarn to pnpm while keeping the npm package published from the repository root.

## 1.3.0

### Minor Changes

- [#13](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/13) [`335c5cf`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/335c5cf0b8461e0538179b6c9c82e73e6c0c5ae4) Thanks [@saseungmin](https://github.com/saseungmin)! - Add `source` to committed swipe events so apps can distinguish gesture commits from programmatic action commits.

  ```tsx
  ProfileDeck.useDeckEventListener("swipe", (event) => {
    if (event.source === "gesture") {
      console.log("User swiped", event.direction);
      return;
    }

    console.log("Programmatic action swiped", event.direction);
  });
  ```

  `event.source` is `'gesture'` when a pan release commits the swipe and `'programmatic'` when
  `actions.swipeLeft()` or `actions.swipeRight()` commits it. `programmatic` does not mean button; map
  it to a button only when that matches your app's UI.

  This is a TypeScript-visible event payload shape change: `source` is a required field on
  `SwipeEvent<T>`, so object literals, fixtures, or `useDeckEvent('swipe', initialValue)` values must
  include it.

## 1.2.0

### Minor Changes

- [#10](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/10) [`0a9615b`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/0a9615be845a4aade827bb76246835fb441c8c8f) Thanks [@saseungmin](https://github.com/saseungmin)! - Add Root-level `allowedDirections` to restrict accepted dismiss directions. Disallowed gesture releases keep the normal snap-back behavior, while programmatic swipe actions return `false` before starting dismiss motion.

  ```tsx
  <ProfileDeck.Root
    data={profiles}
    getKey={(item) => item.id}
    allowedDirections={["right"]}
  >
    <ProfileDeck.Card>
      {({ item }) => <ProfileCard profile={item} />}
    </ProfileDeck.Card>
  </ProfileDeck.Root>
  ```

  Use `allowedDirections={["left"]}` for a pass-only deck, omit it for both directions, or pass `[]` to keep drag feedback while rejecting all dismisses.

- [#12](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/12) [`96f1fc5`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/96f1fc579aebc8500b65e51738d96de065a3d99d) Thanks [@saseungmin](https://github.com/saseungmin)! - Allow `visibleCardCount={1}` to render only the active card.

  This is the lightest rendering budget for decks that do not need a visible next-card stack or
  next-card promotion animation. The default remains `3`, and `visibleCardCount={2}` still renders the
  active card plus the immediate next card.

  ```tsx
  <ProfileDeck.Root
    data={profiles}
    getKey={(item) => item.id}
    visibleCardCount={1}
  >
    <ProfileDeck.Card>
      {({ item }) => <ProfileCard profile={item} />}
    </ProfileDeck.Card>
  </ProfileDeck.Root>
  ```

## 1.1.0

### Minor Changes

- [#9](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/9) [`da9b96e`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/da9b96ec75d1ca8049bcef16a60170de916ca64b) Thanks [@saseungmin](https://github.com/saseungmin)! - Add `interaction.dismissDirection` to `useDeckInteraction()` so UI-thread consumers can read the accepted dismiss side without waiting for JS swipe events or inferring from raw drag direction.

  ```tsx
  function DeckDismissFeedback() {
    const { dismissDirection, phase } = ProfileDeck.useDeckInteraction();

    const rightStyle = useAnimatedStyle(() => ({
      opacity:
        phase.get() === "dismissing" && dismissDirection.get() === "right"
          ? 1
          : 0,
    }));

    return <Animated.View style={rightStyle} />;
  }
  ```

- [#7](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/7) [`c3d8949`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/c3d89495dd6ccb2095ef736da238052f9a0120dd) Thanks [@saseungmin](https://github.com/saseungmin)! - Add `interaction.phase` to `useDeckInteraction()` so UI-thread consumers can distinguish idle, dragging, dismissing, and undoing deck lifecycles without inferring from progress or JS events.

  ```tsx
  function DeckPhaseFeedback() {
    const { phase } = ProfileDeck.useDeckInteraction();

    const dismissingStyle = useAnimatedStyle(() => ({
      opacity: phase.get() === "dismissing" ? 1 : 0.32,
    }));

    return <Animated.View style={dismissingStyle} />;
  }
  ```

## 1.0.2

### Patch Changes

- [#5](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/5) [`d30d558`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/d30d558204d6194e7e035b49d2fd96444d3b8438) Thanks [@saseungmin](https://github.com/saseungmin)! - Lower the minimum `visibleCardCount` to 2 while keeping the default at 3, allowing compact decks to render only the active card and the immediate next card.

  ```tsx
  <SwipeDeck.Root
    data={profiles}
    getKey={(item) => item.id}
    visibleCardCount={2}
  >
    <SwipeDeck.Card>
      {({ item }) => <ProfileCard profile={item} />}
    </SwipeDeck.Card>
  </SwipeDeck.Root>
  ```

## 1.0.1

### Patch Changes

- [#3](https://github.com/react-native-motion-kit/react-native-swipe-deck/pull/3) [`a6b2b6b`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/a6b2b6b8ca9c2649da9fdba9e15ebe84569047ad) Thanks [@saseungmin](https://github.com/saseungmin)! - Update the English and Korean READMEs with the React Native Motion Kit logo and remove internal API direction notes from the public docs.

## 1.0.0

### Major Changes

- [`32f1f9a`](https://github.com/react-native-motion-kit/react-native-swipe-deck/commit/32f1f9ab7049733d3691b91f5427a947d44d2219) Thanks [@saseungmin](https://github.com/saseungmin)! - Initial stable release of `@react-native-motion-kit/swipe-deck`.

  - Add factory-scoped `createSwipeDeck<T>()` components and hooks.
  - Render a bounded swipe deck powered by Reanimated and Gesture Handler.
  - Support programmatic swipe actions, undo, deck state, and event hooks.
  - Add customizable Tinder-style, action, and undo motion configuration.
  - Include example app, documentation, CI, and release setup.
