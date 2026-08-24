# Setframe Product Backlog — Mobile Input Zoom / Viewport Stability

## Story

28. [Prevent Persistent Mobile Zoom After Input Focus](./28-prevent-persistent-mobile-input-zoom.md)

(Numbered 28, not 23 — 23 was already taken by the completed
edit-logged-sets-from-completed-workout-review story; renumbered on
import to avoid collision.)

## Likely Root Cause

On iOS Safari, form controls with an effective font size below approximately 16px can trigger automatic zoom on focus.

Also inspect:
- visual viewport changes,
- keyboard resizing,
- sticky/fixed navigation,
- scroll restoration,
- transforms.

## Important Accessibility Rule

Do not fix this using `maximum-scale=1` or `user-scalable=no`.

Users must retain pinch-to-zoom.

## Coordination

Review alongside Story 20 — Mobile Overlay, Keyboard, and Scroll Position Stability.
