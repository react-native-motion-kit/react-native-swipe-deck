---
'@react-native-motion-kit/swipe-deck': minor
---

Allow `visibleCardCount={1}` to render only the active card.

This is the lightest rendering budget for decks that do not need a visible next-card stack or
next-card promotion animation. The default remains `3`, and `visibleCardCount={2}` still renders the
active card plus the immediate next card.

```tsx
<ProfileDeck.Root data={profiles} getKey={(item) => item.id} visibleCardCount={1}>
  <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
</ProfileDeck.Root>
```
