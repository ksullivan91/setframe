# Setline — Figma Style Guide (v0, in progress)

Status: **Live in Figma, actively being built.** This is the first real
design-system artifact created *in Figma itself* (not just proposal docs).
It implements the color direction from `setline-design-system.md` and the
purple-accent audit in `figma-reference-audit.md` §5, using GitHub Copilot
CLI's Figma MCP write tools (`use_figma`).

**Figma file**: `Setline` — `https://www.figma.com/design/pb64t99w7Um3FTeFiJ1riz/Setline`
(user-created project, not a reference/community file).

## Pages

- **📖 Cover** (`0:1`) — default blank page, not yet used.
- **🎨 Foundations** (`3:2`) — tokens and first draft components. Everything
  below lives here.

## What's built so far

### 1. Color — `Setline/Color` variable collection (Light + Dark modes)

- **Accent ramp** (`Color/Accent/50…950`, 11 steps) — indigo/violet,
  anchored on the exact `#6979F8` from the "Brainstorming UI Style Kit"
  reference file at step `500`. Generated as a proper HSL ramp (lightness
  + saturation stepped, hue held constant) rather than hand-picked, so
  every step is derivable/regeneratable.
- **Neutral ramp** (`Color/Neutral/0…950`, 13 steps) — cool, slightly
  violet-shifted near-black anchored on `#151522` at step `900` (the same
  hex found in that reference file, and consistent with the "near-black,
  never pure black" pattern independently observed in Files 1 and 3 of
  the audit).
- **Status colors** (`Color/Status/Success|Error|Caution|Info`) — single
  swatches for now, not yet ramped (see open items below).
- **Semantic aliases** (`Semantic/Text/*`, `Semantic/Surface/*`,
  `Semantic/Border/*`, `Semantic/Action/*`, `Semantic/Status/*`) — alias
  the ramp values and **flip per mode** (e.g. `Semantic/Text/Primary` =
  Neutral/900 in Light, Neutral/0 in Dark). All components below are
  bound to semantic variables, not raw ramp steps or hex, so switching
  the file's variable mode toggles every component between light/dark.

Contrast check (WCAG, computed programmatically, not yet re-verified
inside Figma's own contrast tooling):
- `#151522` (neutral text) vs. white surface: **18.07:1** — passes AAA.
- `#6979F8` (accent/500, used as a subtle tag/link color, not large text)
  vs. white: **3.69:1** — passes AA for large text/UI components (3:1),
  **not** for normal-size body text; kept as a tag/accent color only, per
  its role in the source file.
- `Semantic/Action/Primary` (Accent/600, `#3349F8`) vs. white button
  label: **6.09:1** — passes AA for normal text, safe for button labels.

### 2. Typography — Inter, 11-step scale

Same scale proposed in `setline-design-system.md` §3 (`display` through
`caption`), now rendered as a real live specimen frame with actual Inter
Regular/Semi Bold text nodes bound to `Semantic/Text/Primary` /
`Secondary`. Includes the numeric-legibility rows (`numericMetric`,
`numericWorkoutSet`) called out as Setline's key requirement.

### 3. Spacing — `Setline/Spacing` variable collection

8 numeric variables (`Spacing/4` … `Spacing/48`), single mode, bound as
the actual `width` of specimen bars — not just documented, but literally
driving node geometry so the scale can be visually audited.

### 4. Radius — `Setline/Radius` variable collection

3 numeric variables: `Radius/Small` (8), `Radius/Large` (16),
`Radius/Full` (999, for pills/avatars) — matches the restrained 2-tier
scale from `setline-design-system.md` §4.

### 5. First draft components (`Components (draft)` frame)

All built with auto-layout (Flexbox-equivalent), not absolute positioning
— explicitly avoiding the anti-pattern flagged in the audit (File 3):

- **`Button/Primary`** — `Semantic/Action/Primary` fill,
  `Semantic/Action/PrimaryText` label, `Radius/Small`, Inter Semi Bold.
- **`MetricTile`** — label → big number → trend row anatomy, directly
  from the audit's File 1 (SnowUI) + File 3 pattern. `Radius/Large`,
  `Semantic/Surface/Raised` fill, `Semantic/Border/Subtle` stroke.
- **`SetRow`** — label ("Set 1") → large numeric value ("275 × 5",
  `numericWorkoutSet` scale) → PR badge pill using
  `Semantic/Action/AccentSubtle`. This is the master spec's flagged
  "most important component," Setline-original (not sourced from any
  reference file).

### 6. Second round of foundation components — grounded in real MVP flows

Every component below was built to satisfy a specific, cited requirement
in `github-copilot-fitness-app-master-prompt.md` — not speculative UI:

- **`Card`** (node `8:2`) — the audit/design-system doc explicitly warns
  against "everything is a floating card" (File 1's tendency); to avoid
  building a decorative wrapper, this is demonstrated as an **exercise
  block** grouping 3 sets under one exercise name, matching §5's
  "genuinely distinct groupings" rule and §13's exercise-history/session
  display needs.
- **`TextField/Numeric`** (node `8:18`) — labeled numeric input with a
  unit suffix (`lb`), directly for §10's manual daily inputs (morning
  weight, systolic/diastolic BP) and §13/§15's numeric-keyboard entry
  requirement. Unit suffix matters because weight, reps, and BP are all
  unitless numbers without it.
- **`Checkbox/Checked` + `Checkbox/Unchecked`** (nodes `8:23`, `8:25`) —
  §13's "quick completion" for inline set rows: a single tap to mark a
  set done, explicitly *not* a modal per set.
- **`IconButton`** ×4 (nodes `8:26`–`8:32`, add/remove/duplicate/reorder)
  — §13's "add/remove/reorder, duplicate previous set" actions. Sized
  28–32px circular tap targets (icon-only, no label) to stay compact in
  an inline row while still meeting §15's "large targets" mobile intent.
  Icon glyphs are text placeholders pending a real icon set decision.
- **`SyncStatusPill`** ×3 states — synced / syncing / needs-attention
  (nodes `8:34`, `8:37`, `8:40`) — §13's Today-screen requirement to show
  "last sync state," an unobtrusive "Updating health data…" indicator
  during reconciliation, and the master spec's rule to show *actionable*
  status (not generic failure) when HealthKit needs attention — hence a
  distinct caution-colored "Health access needed" state rather than a
  single generic error pill.
- **`SetRow/Editable`** (node `8:43`) — the fuller version of the
  master-spec's flagged "most important component." Combines checkbox +
  set number + weight input + "×" + reps input + duplicate/remove icons
  in one inline row, directly implementing §13's line: "inline editable
  set rows; no modal per set... numeric keyboard, next-field navigation,
  quick completion, add/remove/reorder, duplicate previous set." The
  earlier static `SetRow` (read-only, with PR badge) remains as the
  **history/log display variant** — the two are deliberately different
  components for different contexts (editing live vs. reviewing past
  sessions), not a duplicate.

All of the above are bound to `Semantic/*` and `Spacing`/`Radius`
variables, no hardcoded hex/px, and were screenshot-verified.

## What's intentionally not done yet

- **Status color ramp**: only single swatches exist for
  success/error/caution/info; no light/dark-mode-aware tint/shade steps
  yet (unlike the accent/neutral ramps). Needed once components require
  hover/subtle-background variants of status colors (e.g. a "success"
  toast background).
- **In-Figma contrast/accessibility audit**: contrast numbers above were
  computed with a local WCAG script, not Figma's own contrast-checking
  plugin/tooling — worth a second pass once more components exist.
- **No mobile-specific components yet** (tab bar, calendar strip, appbar
  from File 3's IA) — only the first 3 cross-platform primitives exist.
- **No dark-mode screenshot verification** — modes are wired correctly
  (semantic aliases flip), but no screenshot has been taken with the
  Dark mode active to visually confirm it end-to-end.
- **`Card` now exists** (see §6 above), but `Stack`/`Inline`/`NumericText`
  as named low-level primitives in `setline-design-system.md` §7 still
  don't — `MetricTile`, `SetRow`, and the new components were built
  directly with ad hoc auto-layout rather than composed from shared
  layout primitives first; worth revisiting once more screens exist and
  repeated patterns emerge.
- **Icon set undecided** — `IconButton` glyphs are text-character
  placeholders (`+`, `−`, `⧉`, `≡`), not real icons; needs a decision
  (e.g. Lucide/Phosphor) before implementation.
- **No web `AppShell` or mobile tab shell** yet (§7 items 4–5) — still
  foundation-only, per the user's "start designing" request scoped to
  style guide + first components, not full screens.

## How this was built

Entirely via GitHub Copilot CLI's Figma MCP `use_figma` tool (JavaScript
against the Figma Plugin API) — variable collections, aliasing, and
auto-layout component construction were all done programmatically, then
verified visually via `get_screenshot` after each step (color ramps,
typography, spacing, radius, and components were each screenshotted and
inspected before moving on, catching this early and avoiding rework).

## Next steps

1. Review the live Figma file directly and confirm the accent ramp,
   neutral ramp, and first 3 components read the way you want.
2. Decide whether to keep building components (Card/Input/Tab
   bar/Appbar) before any real app screens, or move straight to a first
   real screen (e.g. mobile "Today" or the workout logging `SetRow` in
   context) to validate the tokens against real content sooner.
3. Ramp the status colors once a concrete use case needs a tint/shade
   (e.g. a toast or badge background).
