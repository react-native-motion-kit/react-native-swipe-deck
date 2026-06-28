# React Native Swipe Deck

> English | [한국어](./README.ko.md)

<div align="center">
  <img src="./assets/logo.png" width="300px" alt="React Native Motion Kit logo" />
</div>

## Overview

Need Tinder-style cards without hand-wiring gesture state, programmatic actions, animation state, and committed events on every screen?

`@react-native-motion-kit/swipe-deck` is a high-performance swipe deck library for React Native. It is built on Reanimated, Worklets, and Gesture Handler, with a typed compound API for card stacks, like/pass buttons, progress-driven overlays, undo flows, and multiple independent deck instances.

### Key Features

- 🤌 **Gesture-First Deck UX** - Drag, flick, threshold, and direction controls tuned for Tinder-style card stacks
- 🏎️ **High-Performance Animations** - Smooth UI-thread card motion powered by React Native Reanimated and Worklets
- 🪟 **Bounded Render Window** - Mount only the active card and a small forward stack instead of the whole data set
- 🧬 **Item-Stable Promotion** - Stable item keys let promoted cards keep their React Native view identity
- 🧠 **Typed Compound API** - Create one typed deck family with Root, Card, hooks, actions, and events
- 🎛️ **External Control API** - Trigger swipeLeft, swipeRight, and undo from buttons or other UI components
- 🎨 **Motion Recipes** - Tune gesture motion, programmatic actions, and undo restores independently
- 🧩 **Multi-Instance Management** - Manage multiple deck roots independently with stable factory-scoped IDs
- ↩️ **Undo Support** - Opt into back-swipe UX with action-safe undo motion and LIFO history
- 🪄 **Easy-to-Use API** - Start with Root and Card, then add hooks only when controls or events need them

## Quick Start

### 📚 Documentation

Full documentation is available at: <https://react-native-swipe-deck.pages.dev>

### Examples & Demo

- [📁 Example Project](https://github.com/react-native-motion-kit/react-native-swipe-deck/tree/main/example) - Real implementation code with various use cases
- [🤖 Expo Snack](https://snack.expo.dev/@harang/react-native-swipe-deck) - Try it instantly on Expo Snack

### 🤖 AI

- [llms.txt](https://react-native-swipe-deck.pages.dev/llms.txt): A structured index file containing the titles, links, and brief descriptions of all documentation pages.
- [llms-full.txt](https://react-native-swipe-deck.pages.dev/llms-full.txt): A full-content file that concatenates the complete content of every documentation page into a single file.

### Installation

```sh
npm install @react-native-motion-kit/swipe-deck react-native-gesture-handler react-native-reanimated react-native-worklets
```

Then follow the Reanimated/Worklets setup for your React Native or Expo version.
Make sure `react-native-worklets/plugin` is the last Babel plugin.

### Basic Usage

```tsx
import { Pressable, Text, View } from 'react-native';
import { createSwipeDeck, SwipeDeckMotion } from '@react-native-motion-kit/swipe-deck';

type Profile = {
  id: string;
  name: string;
  bio: string;
};

const ProfileDeck = createSwipeDeck<Profile>({
  motion: SwipeDeckMotion.tinder(),
});

function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <View>
      <Text>{profile.name}</Text>
      <Text>{profile.bio}</Text>
    </View>
  );
}

function ProfileDeckControls() {
  const { activeIndex, count, canSwipe } = ProfileDeck.useDeckState();
  const { swipeLeft, swipeRight } = ProfileDeck.useDeckActions();
  const current = activeIndex >= 0 ? activeIndex + 1 : 0;

  return (
    <View>
      <Text>{`${current} / ${count}`}</Text>
      <Pressable disabled={!canSwipe} onPress={swipeLeft}>
        <Text>Nope</Text>
      </Pressable>
      <Pressable disabled={!canSwipe} onPress={swipeRight}>
        <Text>Like</Text>
      </Pressable>
    </View>
  );
}

export function ProfileDeckScreen({ profiles }: { profiles: Profile[] }) {
  return (
    <View>
      <ProfileDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={3}>
        <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
      </ProfileDeck.Root>

      <ProfileDeckControls />
    </View>
  );
}
```

Use hooks from the same `ProfileDeck` factory as the `Root` when you need controls, animated overlays, or committed model events: `ProfileDeck.useDeckState()`, `ProfileDeck.useDeckActions()`, `ProfileDeck.useDeckInteraction()`, `ProfileDeck.useDeckEvent()`, and `ProfileDeck.useDeckEventListener()`.

## Contributing

For details on how to contribute to the project and set up the development environment, please refer to the [Contributing Guide](CONTRIBUTING.md).

## License

[MIT](./LICENSE)
