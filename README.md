# @react-native-motion-kit/swipe-deck

High-performance Tinder-style swipe deck and swipe cards for React Native, powered by Reanimated and Gesture Handler.

## Installation

```sh
npm install @react-native-motion-kit/swipe-deck react-native-gesture-handler react-native-reanimated react-native-worklets
```

Follow the Reanimated/Worklets setup for your React Native or Expo version, including adding `react-native-worklets/plugin` as the last Babel plugin.

## Usage

```tsx
import { SwipeDeck } from '@react-native-motion-kit/swipe-deck';

<SwipeDeck<Profile>
  data={profiles}
  getKey={(item) => item.id}
  onSwipe={({ item, direction }) => {
    console.log(item, direction);
  }}
  onEndReached={() => {
    console.log('No more cards');
  }}
>
  <SwipeDeck.Card<Profile>>
    {({ item, role, isActive }) => <ProfileCard profile={item} role={role} active={isActive} />}
  </SwipeDeck.Card>
</SwipeDeck>;
```

The deck renders a bounded window only: previous, current, and next cards where available. It does not render the whole data set.

## API direction

The primary API is compound/slot based: `SwipeDeck` is the root and `SwipeDeck.Card` defines card rendering. For full TypeScript safety with the compound slot, pass the same item type to `SwipeDeck` and `SwipeDeck.Card`.

The MVP intentionally does not expose public `Provider`, `controller` props, `id` registry, triggers, or arbitrary prerender controls. Registry-first external control is tracked as a future design direction in the repo planning docs, not as shipped API.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
