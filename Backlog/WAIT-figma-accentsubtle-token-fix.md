# Story — Fix `Semantic/Action/AccentSubtle` Token Wiring in Figma

> **Status:** Deferred / holstered. Captured so it is not lost. Not part of the
> current active phase — do not start without explicit sign-off.

## User Story

As a maintainer, I want the Figma `Semantic/Action/AccentSubtle` variable to
actually resolve to a subtle accent tint (as its name and the code-side
`packages/design-tokens` definition both intend), so that components using it
as a fill are visually distinct from `Semantic/Action/Primary` and don't
repeatedly trip the same contrast bug.

## Motivation

During the 2026-08-23 color-token reconciliation (making `packages/design-tokens`
the source of truth for the Figma `Setframe/Color` variable collection — see
`docs/design/setframe-figma-style-guide.md` §23), a deeper inspection of the
`Semantic/*` alias bindings turned up a mismatch independent of the raw-ramp
drift that pass already fixed:

- **Figma**: `Semantic/Action/AccentSubtle` aliases to `Accent/500` (light
  mode) / `Accent/400` (dark mode) — the same vivid step used for
  `Semantic/Action/Primary`.
- **Code** (`packages/design-tokens/src/semantic-colors.ts`): `action.accentSubtle`
  is `accent[100]` (light) / `accent[900]` (dark) — a pale tint, matching what
  "subtle" implies.

This is very plausibly the root cause behind the repeated "solid-fill
AccentSubtle reads near-identical to Primary" contrast bugs already logged in
the style guide (§16 AppShell nav label, §22 WorkoutLogger "Finish" button and
PR toast card) — each of those fixes patched the *affected component's* text
color, but none addressed why `AccentSubtle` itself resolves to a vivid,
non-subtle color in the first place. Any future component that reaches for
`AccentSubtle` expecting a light background tint is likely to reproduce the
same bug.

A handful of other, lower-impact dark-mode alias mismatches were also found in
the same pass (`Text/Secondary`, `Text/Disabled` in light mode;
`Surface/Canvas`, `Surface/Raised`, `Action/Primary`, `Action/PrimaryHover`,
`Action/PrimaryText` in dark mode) — worth folding into the same pass since
they're the same class of issue.

## Desired Outcome

1. Rebind `Semantic/Action/AccentSubtle` in the Figma `Setframe/Color`
   collection: light mode → `Accent/100`, dark mode → `Accent/900` (matching
   `semantic-colors.ts` exactly).
2. Rebind the other identified mismatches to their code-side equivalents:
   - `Semantic/Text/Secondary` (light) → `Neutral/600`
   - `Semantic/Text/Disabled` (light) → `Neutral/400`
   - `Semantic/Surface/Canvas` (dark) → `Neutral/900`
   - `Semantic/Surface/Raised` (dark) → `Neutral/850`
   - `Semantic/Action/Primary` (dark) → `Accent/500`
   - `Semantic/Action/PrimaryHover` (dark) → `Accent/400`
   - `Semantic/Action/PrimaryText` (dark) → `Neutral/900`
3. Screenshot-verify every screen on both `📱 Mobile` and `🖥️ Web` pages in
   **both** Light and Dark mode after rebinding — this is also the file's
   first real dark-mode visual pass (previously deferred, per the style
   guide's running "not done yet" list), so treat this as an opportunity to
   catch anything else Dark-mode-specific that's never been looked at.
4. Update `docs/design/setframe-figma-style-guide.md` with the outcome.

## Open Questions

- Should this be done as one bulk rebind (fast, but a big visual diff across
  ~19+ frames to review at once) or split per-screen so each can be spot
  checked incrementally? Given no Dark-mode screenshot has ever been taken,
  incremental is probably safer.
- Are there other `Semantic/*` aliases beyond the ones enumerated above worth
  a full audit pass, or is this list (found via one full `getLocalVariableCollectionsAsync`
  dump) exhaustive? Re-run that dump at the start of this work to confirm
  nothing else has drifted since 2026-08-23.

## Acceptance Criteria

- [ ] All eight listed `Semantic/*` alias mismatches rebound to match
      `packages/design-tokens/src/semantic-colors.ts`.
- [ ] Every screen on `📱 Mobile` and `🖥️ Web` screenshot-verified in both
      Light and Dark mode, with no clipped/low-contrast/broken content found
      (or found issues logged and fixed in the same pass).
- [ ] `docs/design/setframe-figma-style-guide.md` updated with a new
      section describing the fix and screenshots reviewed.
