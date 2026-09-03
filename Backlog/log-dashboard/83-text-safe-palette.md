# Story 83 — Text-safe colours: `text.disabled` and `status.error`

**Status:** Open. Independent of the rest of the batch, and overdue —
this is a shipped accessibility defect, not new work.

## The defect

Three semantic tokens are used as ordinary text and none passes WCAG AA
(4.5:1 for body text). The third was found on 2026-09-03 while checking
the Log frames against the gallery — it had been invisible because a
green "↓ 1.2" reads as decoration until you measure it:

| Token | Value | On white | Used as text in |
|---|---|---|---|
| `text.disabled` | `#a9a9bc` | **2.31:1** | **43 call sites** |
| `status.error` | `#FF647C` | **2.85:1** | the delete button, and every destructive control |
| `status.success` | `#00C48C` | **2.26:1** | trend deltas, and anywhere green means "good" |

`text.disabled` is not marking disabled controls. It is on eyebrows in
onboarding, field labels in the prescription sheet, notes in
`SaveAsWorkoutCard` and `NoPlanRoutes`, the "Browse templates" CTA
label, and the `prev` ghost values in `SetRow`.

The `#FF647C` failure was found by the product owner on the delete
button and has been known since; it is included here because it is the
same class of bug and the same fix.

## What to build

- Sweep the 43 `text.disabled` usages. Where the text is not describing
  a disabled control, use `text.secondary` (`#65658b`, 7.0:1). Reserve
  `text.disabled` for genuinely disabled controls, where the low
  contrast *is* the signal.
- Add a **text-safe step to the success ramp** as well — `#00674B`
  measures 5.9:1 and is what the Trends deltas use. `status.success` is a
  surface and an icon colour; it has never been a text colour, and using
  it as one is how the trend arrows ended up at 2.26:1.
- Add a **text-safe step to the error ramp** — the ramp currently has no
  step that passes as text on white. `#A11133` measures 7.1:1 and is the
  value the Log designs use.
- Destructive controls keep `#FF647C` as a *surface*; their label needs
  the contrast to sit on it, or the fill needs to darken.
- Add a source-level guard, in the style of
  `src/__tests__/copyGuards.test.ts`, failing on new `text.disabled`
  usage outside a disabled context.

## Acceptance

- No text in the app renders below 4.5:1 against its background.
- The guard fails if someone reintroduces the pattern.
- Disabled controls still look disabled.

## Why a guard

The same defect reappeared three times in one design session — the new
screens inherited it by copying existing ones. A convention in a doc
will not hold; the codebase already uses source-level guards for exactly
this class of problem (safe-area insets, `userId` scoping, no-HealthKit-
writes, copy rules).
