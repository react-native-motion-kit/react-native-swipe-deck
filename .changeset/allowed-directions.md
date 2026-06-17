---
'@react-native-motion-kit/swipe-deck': minor
---

Add Root-level `allowedDirections` to restrict accepted dismiss directions. Disallowed gesture releases keep the normal snap-back behavior, while programmatic swipe actions return `false` before starting dismiss motion.

```tsx
<ProfileDeck.Root data={profiles} getKey={(item) => item.id} allowedDirections={['right']}>
  <ProfileDeck.Card>{({ item }) => <ProfileCard profile={item} />}</ProfileDeck.Card>
</ProfileDeck.Root>
```

Use `allowedDirections={["left"]}` for a pass-only deck, omit it for both directions, or pass `[]` to keep drag feedback while rejecting all dismisses.
