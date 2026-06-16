---
'@react-native-motion-kit/swipe-deck': patch
---

Add `interaction.phase` to `useDeckInteraction()` so UI-thread consumers can distinguish idle, dragging, dismissing, and undoing deck lifecycles without inferring from progress or JS events.

```tsx
function DeckPhaseFeedback() {
  const { phase } = ProfileDeck.useDeckInteraction();

  const dismissingStyle = useAnimatedStyle(() => ({
    opacity: phase.get() === 'dismissing' ? 1 : 0.32,
  }));

  return <Animated.View style={dismissingStyle} />;
}
```
