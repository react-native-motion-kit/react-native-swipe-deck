---
'@react-native-motion-kit/swipe-deck': minor
---

Reclaim factory registry entries after the final committed `Root` or public hook consumer for an
id unmounts. Stable navigation route keys are now supported as deck instance ids, provided the key
does not change while the screen is mounted.

The duplicate-Root rule is unchanged: two simultaneous Roots from the same factory still require
distinct ids. This release also changes the documented identity contract. Actions and interaction
shared values stay stable only while at least one committed consumer retains the id; after a gap
with zero committed consumers and deferred eviction, a later consumer for the same id receives a
fresh action/interaction identity.
