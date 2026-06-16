---
'@react-native-motion-kit/swipe-deck': minor
---

Add `interaction.dismissDirection` to `useDeckInteraction()` so UI-thread consumers can read the accepted dismiss side without waiting for JS swipe events or inferring from raw drag direction.

```tsx
function DeckDismissFeedback() {
  const { dismissDirection, phase } = ProfileDeck.useDeckInteraction();

  const rightStyle = useAnimatedStyle(() => ({
    opacity: phase.get() === 'dismissing' && dismissDirection.get() === 'right' ? 1 : 0,
  }));

  return <Animated.View style={rightStyle} />;
}
```
