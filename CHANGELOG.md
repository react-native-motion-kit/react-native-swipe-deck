# @react-native-motion-kit/swipe-deck

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
