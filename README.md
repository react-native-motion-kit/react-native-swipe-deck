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

The deck renders a bounded window only: previous, current, and next cards where available. It does not render the whole data set.

## API direction

The primary API is compound/slot based: `Root` owns the data and `Card` defines card rendering. Use `createSwipeDeck<T>()` to create a typed component family so `Root`, `Card`, and future slots share the same item type without repeating generics in JSX.

The MVP intentionally does not expose public `Provider`, `controller` props, `id` registry, triggers, or arbitrary prerender controls. Registry-first external control is tracked as a future design direction in the repo planning docs, not as shipped API.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
