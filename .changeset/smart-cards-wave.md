---
'@react-native-motion-kit/swipe-deck': minor
---

Add opt-in upward swipe support across gestures, programmatic actions, events, interaction state,
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
  allowedDirections={['left', 'right', 'up']}
>
  <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
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
