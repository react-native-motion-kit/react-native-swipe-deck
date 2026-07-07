---
'@react-native-motion-kit/swipe-deck': minor
---

Add `interactive` to `SwipeDeck.Card` so active-card children such as CTA buttons or links can receive touches without exposing raw React Native `pointerEvents`.

```tsx
<ProfileDeck.Card interactive={({ item }) => item.type === 'ad'}>
  {({ item }) => <AdCard ad={item} onPressCta={() => openAd(item)} />}
</ProfileDeck.Card>
```

Only the active card can become interactive. Background cards remain non-interactive to preserve swipe-deck safety.
