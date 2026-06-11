---
'@react-native-motion-kit/swipe-deck': patch
---

Lower the minimum `visibleCardCount` to 2 while keeping the default at 3, allowing compact decks to render only the active card and the immediate next card.

```tsx
<SwipeDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={2}>
  <SwipeDeck.Card>{({ item }) => <ProfileCard profile={item} />}</SwipeDeck.Card>
</SwipeDeck.Root>
```
