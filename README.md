# @react-native-motion-kit/swipe-deck

[한국어](README.ko.md)

<div align="center">
  <img src="./assets/logo.png" width="300px" alt="React Native Motion Kit logo" />
</div>

High-performance Tinder-style swipe deck and swipe cards for React Native,
powered by Reanimated, Worklets, and Gesture Handler.

## Highlights

- **Small render window**: mounts only the active card and a bounded forward stack.
- **Item-keyed rendering**: promoted cards keep their React Native view identity.
- **Typed compound API**: create one typed deck family with `createSwipeDeck<T>()`.
- **Deck hooks**: read state, run actions, subscribe to events, and drive animated overlays.
- **Motion recipes**: tune gesture motion, programmatic actions, and undo restores separately.

## Installation

```sh
npm install @react-native-motion-kit/swipe-deck react-native-gesture-handler react-native-reanimated react-native-worklets
```

Then follow the Reanimated/Worklets setup for your React Native or Expo version.
Make sure `react-native-worklets/plugin` is the last Babel plugin.

## Quick Start

```tsx
import { Text, View } from 'react-native';
import { createSwipeDeck, SwipeDeckMotion } from '@react-native-motion-kit/swipe-deck';

type Profile = {
  id: string;
  name: string;
};

const ProfileDeck = createSwipeDeck<Profile>({
  motion: SwipeDeckMotion.tinder(),
});

function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <View>
      <Text>{profile.name}</Text>
    </View>
  );
}

export function ProfileDeckScreen({ profiles }: { profiles: Profile[] }) {
  return (
    <ProfileDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={3}>
      <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
    </ProfileDeck.Root>
  );
}
```

Use `ProfileDeck.useDeckState()`, `ProfileDeck.useDeckActions()`,
`ProfileDeck.useDeckInteraction()`, `ProfileDeck.useDeckEvent()`, and
`ProfileDeck.useDeckEventListener()` around the same factory Root when you need
controls, animated overlays, or committed model events.

## Docs

Full guides are maintained in this repository under `docs/` while the public
site is being prepared.

- [Overview](docs/docs/1.x/en/guide/getting-started/overview.mdx)
- [Quick Start](docs/docs/1.x/en/guide/getting-started/quick-start.mdx)
- [API Reference](docs/docs/1.x/en/guide/usage/api-reference.mdx)
- [AI Usage Guide](docs/docs/1.x/en/guide/getting-started/ai.mdx)

AI-readable docs are generated during the docs build:

- [llms.txt](docs/doc_build/llms.txt)
- [llms-full.txt](docs/doc_build/llms-full.txt)

## License

MIT
