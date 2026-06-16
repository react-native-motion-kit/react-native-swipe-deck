# @react-native-motion-kit/swipe-deck

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
