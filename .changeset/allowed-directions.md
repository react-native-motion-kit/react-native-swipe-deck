---
'@react-native-motion-kit/swipe-deck': minor
---

Add Root-level `allowedDirections` to restrict accepted dismiss directions. Disallowed gesture releases keep the normal snap-back behavior, while programmatic swipe actions return `false` before starting dismiss motion.
