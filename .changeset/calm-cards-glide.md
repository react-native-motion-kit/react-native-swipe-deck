---
'@react-native-motion-kit/swipe-deck': patch
---

Prevent gesture-driven dismisses from briefly jumping when the finger is released on Android.
Committed swipes now animate only their primary dismiss axis, preserving the final cross-axis drag
position instead of restarting an unnecessary timing animation during the gesture handoff.
