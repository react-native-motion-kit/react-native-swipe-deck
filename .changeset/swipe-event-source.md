---
'@react-native-motion-kit/swipe-deck': minor
---

Add `source` to committed swipe events so apps can distinguish gesture commits from programmatic action commits.

```tsx
ProfileDeck.useDeckEventListener('swipe', (event) => {
  if (event.source === 'gesture') {
    console.log('User swiped', event.direction);
    return;
  }

  console.log('Programmatic action swiped', event.direction);
});
```

`event.source` is `'gesture'` when a pan release commits the swipe and `'programmatic'` when
`actions.swipeLeft()` or `actions.swipeRight()` commits it. `programmatic` does not mean button; map
it to a button only when that matches your app's UI.

This is a TypeScript-visible event payload shape change: `source` is a required field on
`SwipeEvent<T>`, so object literals, fixtures, or `useDeckEvent('swipe', initialValue)` values must
include it.
