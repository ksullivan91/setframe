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

**Bug fix**: `Checkbox/Checked` initially rendered lopsided (13×24
instead of a proper 24×24 square) because its auto-layout frame was
sized `AUTO` and hugged the checkmark glyph asymmetrically. Fixed by
setting both axes to `FIXED` 24×24 with centered content — now matches
`Checkbox/Unchecked` exactly.

All of the above are bound to `Semantic/*` and `Spacing`/`Radius`
variables, no hardcoded hex/px, and were screenshot-verified.

### 7. First real screens + shells — proves tokens/components against actual content

- **`Screen/Mobile/Today`** (node `13:3`, "📱 Screens" page) — implements
  §13's Today screen field-for-field: date header, live sync-status pill,
  unobtrusive "Updating health data…" reconciliation text, a
  `TodayCard/PlannedWorkout` card (today's workout name + last-done date +
  full-width Start CTA — the "what am I doing today" thesis), a "Today's
  check-in" section (morning weight + BP systolic/diastolic via
  `TextField/Numeric`, kept visually separate from HealthKit data per
  §10's provenance rule), and a "From Apple Health" metric grid (steps,
  active calories, exercise minutes, MyFitnessPal-via-HealthKit calories)
  using the `MetricTile` pattern. This is the first frame in the file
  where every earlier token/component decision gets stress-tested against
  real, dense content simultaneously.
- **`Shell/Mobile/TabBar`** (node `14:2`) — wraps a clone of the Today
  screen in the exact 4-tab mobile nav from §13 ("Mobile tabs: Today,
  Training, Progress, Settings") — this is a literal spec requirement,
  not a design choice, so the 4 labels/order are fixed.
- **`Shell/Web/AppShell`** (node `14:65`) — 240px sidebar + content area,
  1280px desktop canvas, with the 5-item web nav from §13 ("Web nav:
  Today, Training, History, Progress, Settings" — note History exists on
  web but not mobile per spec). Adopts File 1's sidebar+content structure
  per `setline-design-system.md` §6, with Setline's own tokens (no
  File-1-style card nesting in the content area).

### 8. Additional primitives — Select and Toast

- **`Select/Dropdown`** (node `14:81`) — §13's Program editor needs a
  progression-rule picker (a small fixed set of options: e.g. linear /
  double-progression / percentage-based) — a native `<select>`-shaped
  control, not free text entry.
- **`Toast/Error`** + **`Toast/Success`** (nodes `14:84`, `14:87`) — §15's
  offline strategy explicitly calls for "retry failed writes"; the error
  toast includes a visible "Retry now" action (red, on dark toast
  surface) so failures are actionable rather than silent, consistent with
  the Today screen's HealthKit-attention precedent. Success toast
  (e.g. "Workout saved") is the plain positive-confirmation case.

### 9. Second and third real screens — Workout Logger + Exercise History

- **`Screen/Mobile/WorkoutLogger`** (node `15:2`) — the master spec's
  single most emphasized screen ("must be exceptional"). Header shows
  workout name + elapsed time + a `Finish` affordance (spec's "complete
  workout anyway" deviation). The `ExerciseBlock` card (node `15:9`)
  shows target prescription, last performance, and an editable suggestion
  line together — so the user has full context before touching a number
  — then 3 realistic `SetRow/Editable` instances (2 completed via
  checkbox, 1 in-progress, matching a real mid-workout state rather than
  all-checked or all-empty), an inline "+ Add set," and per-row
  duplicate/remove icons. A dashed-border "+ Add exercise" affordance
  below the card covers the spec's "ad hoc exercise" deviation. A
  drag-handle glyph on the exercise name row stands in for "session
  reorder" (interaction, not static-mock-able, but the affordance exists).
- **`Screen/Web/ExerciseHistory`** (node `16:2`) — placed on web (History
  is a web-only nav item per §13, absent from the 4 mobile tabs).
  Restrained stat-tile row (top set, est. 1RM via Epley formula, last
  session volume — no chart, per spec's "keep charts restrained"), then
  a `SessionHistoryCard` list (date + full set breakdown + PR badge on
  the session where it occurred).

Both screens reused Card/MetricTile/SetRow/badge patterns already
established rather than inventing new visual language — validates that
the token/component set from §5–§8 holds up under denser, more realistic
content.

### 10. Sign In + Program Editor — completing the named §13 screen list

- **`Screen/Web/SignIn`** (node `17:2`) — this does **not** redesign
  Clerk's own `<SignIn/>` component (per §11.5, Clerk owns the actual
  auth UI/logic); it documents the page chrome around Clerk's mount
  point: centered card, Setline wordmark + tagline, minimal surrounding
  layout. Field/button styling is illustrative of Clerk's appearance-API
  theming target, not custom-built production form fields.
- **`Screen/Web/ProgramEditor`** (node `18:12`) — the last named MVP
  screen from §13 ("Create program, weekly/day sequence, workouts,
  exercises, reorder, prescriptions, progression rule, activation. Web
  can be richer"). Includes: program title + Active-status pill +
  Archive action; a `ProgramDayCard` weekly sequence list (drag handles
  for day reorder, exercise counts per day); an expanded
  `ProgramDayDetail` card for "Day 1 — Push" showing per-exercise
  prescriptions (sets × reps @ weight) with drag handles (exercise
  reorder), a `Select/Dropdown`-based progression-rule picker, and the
  same "+ Add exercise" convention used in the Workout Logger screen for
  consistency.

**Layout correction**: all 7 screen/shell frames were initially created
without explicit `x`/`y` coordinates and stacked at the same origin
(invisible overlap, only visible once placed side-by-side or scrolled).
Fixed by auditing every frame's actual parent page (2 shells and 1 screen
had also silently landed on the wrong page — `📖 Cover` instead of
`📱 Screens` — because the current-page context wasn't re-set before
those specific `use_figma` calls) and assigning each a distinct grid
position with generous gutters. Screenshotted the whole `📱 Screens` page
afterward to confirm zero overlap.

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
- **AppShell content area is a placeholder** — the web shell proves the
  sidebar/nav structure but doesn't yet mount a real page (e.g. Today at
  web width); mobile got a full real screen first since it's the higher
  MVP priority (spec calls mobile "the trusted bridge to on-device
  data").
- **`Card` now exists** (see §6 above), but `Stack`/`Inline`/`NumericText`
  as named low-level primitives in `setline-design-system.md` §7 still
  don't — `MetricTile`, `SetRow`, and the new components were built
  directly with ad hoc auto-layout rather than composed from shared
  layout primitives first; worth revisiting once more screens exist and
  repeated patterns emerge.
- ~~Icon set undecided~~ — **resolved in §15**: Lucide adopted, all
  placeholder glyphs replaced with real icons.
- ~~Web AppShell content area is a placeholder~~ — **resolved in §16**:
  real Today content now mounted inside the shell, "Today" nav item
  shows an active state. Training/History/Progress/Settings nav items
  still link out to their standalone screens rather than being mounted
  in-shell (standalone screens exist per §14) — acceptable for a
  design-reference file; a real app would swap content in-place via
  routing.
- **Session/day/exercise reorder and drag interactions** are shown only
  as static affordance glyphs (`≡`), not interactive prototypes — Figma
  static frames can't demonstrate drag behavior; this is a build-time
  concern for the real app, not a design-file gap.
- **Web AppShell's Training/History nav items** still have no
  corresponding screens — Progress and Settings destinations are now
  covered (mobile), but "Training" (the day-by-day workout list feeding
  into the logger) and web-width "History"/"Progress"/"Settings"
  equivalents remain unbuilt.

## 11. Progress screen (`Screen/Mobile/Progress`, node `19:2`)

**Grounding**: unlike Today/WorkoutLogger/ExerciseHistory/ProgramEditor,
§13 names "Progress" as a nav destination but doesn't spell out its
fields. This screen is instead grounded in: the branding prompt's stated
thesis "make progression obvious over time"; the Exercise History
screen's "restrained charts" precedent (reused rather than reinvented —
see §9); and §10's body-weight manual input as the one other
longitudinal, user-owned metric besides lift numbers. **This is an
interpretation, not a spec-literal build — flagged for your
confirmation.**

Three trend cards, each with a label, a headline metric, a delta/context
line, and a small 6-bar "sparkline" row (bars bound to
`Semantic/Action/AccentSubtle`, varying height, no axis/gridlines — kept
deliberately restrained rather than a full charting component):

- **Body weight (30 days)** — headline weight + "-3.1 lb since Jul 21"
- **Bench press top set** — headline "195 × 6" + "Est. 1RM 232 lb, +12 lb
  this month"
- **Weekly volume** — headline total lb + "+8% vs last week"

Positioned at `x=1410, y=900` in the mobile row on the `📱 Screens` page.

## 12. Settings screen (`Screen/Mobile/Settings`, node `20:2`)

**Grounding**: §13 lists "Settings" in both the web nav (5 items) and
mobile tab bar (4 items). Content grounded in: §33 ("Design account
deletion feasibility... No need for polished deletion UI in first pass")
— so deletion gets a simple, clearly-labeled destructive row rather than
a multi-step confirmation flow; §11.5 (Clerk owns user identity/profile
editing — we only surface a read-only summary + hand-off, never rebuild
Clerk's own UI); and the data model's `preferred_units` enum
(imperial/metric, defaulting to imperial per the confirmed ADR decision).

Three grouped sections, each a bordered card of label/value rows:

- **Account** — Email (read-only), "Manage account → Clerk"
- **Preferences** — Units ("Imperial (lb) ›"), Timezone
- **Danger zone** — "Delete account" / "This cannot be undone", label
  text bound to `Semantic/Action/Destructive` (red) to keep it
  unambiguous without needing a heavier UI treatment

Positioned at `x=1880, y=900` in the mobile row.

## 13. Sign Up screen (`Screen/Web/SignUp`, node `21:2`)

**Grounding**: same as Sign In (§10) — per §11.5, Clerk owns the actual
`<SignUp/>` component; this is page chrome only (wordmark, tagline,
centered `AuthCard`) around Clerk's mount point. Email/password fields
shown are illustrative placeholders for Clerk's hosted fields, not
custom form fields to implement. CTA reads "Create Account"; footer
links back to Sign In ("Already have an account? Sign in").

Positioned at `x=0, y=900` in the web row on `📱 Screens` (reuses the
Sign In row's y-coordinate space since both are auth entry points, not
authenticated-app screens).

## What's intentionally not done yet (updated)

- Everything else previously listed under §"What's intentionally not
  done yet" above remains true (icon set undecided, no dark-mode
  screenshot pass, AppShell content area still a placeholder, etc.) —
  see that section for the full list.

## 14. Layout reorganization + full mobile/web parity pass

**Trigger**: user flagged that screens were still landing on top of
each other (`Screen/Web/SignUp` had landed at the same `x=0, y=900` as
`Screen/Mobile/Today`), and asked to organize mobile vs. web screens
more clearly, building out whichever platform was missing a given
screen.

**Spec re-check before building**: §13 confirms `Web nav: Today,
Training, History, Progress, Settings` vs. `Mobile tabs: Today,
Training, Progress, Settings` — the two nav lists are identical except
History is web-only. §13's Program Editor line adds: *"Web can be
richer; mobile may have lighter editing initially."* This means, per
spec, every screen except Exercise History needs both a mobile and web
version — Exercise History is intentionally web-nav-only, but the user
asked for a lightweight mobile version too (reachable as a drill-in, not
a tab-bar destination).

**Canvas reorganization**: all screens repositioned into two aligned
rows on `📱 Screens`, ordered by nav sequence (Sign In → Sign Up →
Today → Training → Program Editor → History → Progress → Settings →
Shell):
- Web row at `y=0`, mobile row at `y=900`.
- Verified programmatically (bounding-box overlap check across all 18
  frames) — zero collisions after the pass.

**New screens built to close parity gaps:**
- `Screen/Web/Today` (node `25:2`) — same §13 fields as mobile, but a
  2-column layout (planned workout + check-in on the left, Apple Health
  metric grid on the right) since web width allows parallel content
  without the vertical scroll mobile needs.
- `Screen/Web/Training` (node `26:2`) — the web counterpart to
  `WorkoutLogger`. Main column reuses the same exercise-block/set-row
  pattern as mobile for consistency; adds a persistent "Session Summary"
  sidebar (elapsed time, sets completed, volume so far) that mobile's
  width can't afford as a standing panel — a "web can be richer"
  enrichment, not a new requirement.
- `Screen/Mobile/ProgramEditor` (node `29:59`) — the "lighter" mobile
  editing experience §13 explicitly calls for: program title/status
  pill, weekly day sequence (view + reorder handles), one expanded
  day's exercise list as view-only prescriptions, and an explicit note
  ("Edit on web for reorder, prescriptions, and progression rules")
  rather than replicating web's inline progression-rule dropdown.
- `Screen/Mobile/ExerciseHistory` (node `29:91`) — explicitly NOT a tab
  bar destination (History stays web-nav-only per §13); built as a
  drill-in screen (e.g. tapping an exercise name from a past session)
  with a condensed single-row stat strip instead of web's 3 separate
  tiles, and a shorter session list.
- `Screen/Web/Progress` (node `29:2`) — same 3 trend cards as mobile
  (§11), arranged in a 3-column row instead of stacked, since web width
  fits all three without scrolling.
- `Screen/Web/Settings` (node `29:38`) — same content as mobile (§33
  deletion allowance, Clerk hand-off, `preferred_units`), but centered
  in a single ~560px column rather than full-bleed — settings content
  doesn't benefit from extra horizontal space the way data-dense
  screens do.
- `Screen/Mobile/SignIn` (node `29:117`) and `Screen/Mobile/SignUp`
  (node `29:128`) — same Clerk-chrome pattern as the existing web
  versions (§10/§13), just narrower `AuthCard` (342px vs. 360px) to fit
  the 390px mobile frame.

**Result**: 18 total frames on `📱 Screens`, full mobile+web parity for
every screen except Exercise History (web = full stat/history nav
destination, mobile = lighter drill-in only, by design), zero overlaps
verified both visually and via bounding-box check.

## What's intentionally not done yet (as of §14)

- **Mobile Program Editor's "+ Add exercise" and progression-rule
  editing** are explicitly deferred to web — the mobile screen shows a
  note pointing users to web rather than a stubbed-out lighter version
  of those flows. Worth a follow-up decision on whether *any* mobile
  editing (e.g. simple reorder) should be interactive-feeling in a later
  pass, or if "view + redirect to web" is the permanent mobile answer.
- Everything else previously listed under earlier "not done yet"
  sections remains true (no dark-mode screenshot pass, AppShell content
  area still a placeholder, no interactive drag-reorder prototyping,
  etc.) **except the icon set, resolved below in §15.**

## 15. Icon library decision + placeholder glyph replacement

**Grounding**: §17 (Iconography) requires "Use a consistent icon library
only after checking license and cross-platform practicality... Avoid
mixing icon styles." This was the last named "not done yet" item
blocking a clean pass over `IconButton`, `SetRow/Editable`, and every
screen's reorder-handle affordances (`≡`, `⧉`, `+`, `−` were all plain
text-character placeholders until now).

**Decision**: adopted **Lucide** (`lucide-react` for web,
`lucide-react-native` for mobile) — see `docs/adr/0006-icon-library.md`
for the full license/cross-platform comparison against Phosphor,
Heroicons, and Font Awesome. Lucide won on: permissive ISC license,
first-class packages maintained by the same team for both platforms
(no community-wrapper gap), and a single thin-line style consistent
with the rest of Setline's restrained visual language.

**Replacement pass** (all done via real Lucide path data, not
approximations):
- `IconButton` row in Foundations: `+` → `Plus`, `−` → `Minus`,
  `⧉` → `Copy`, `≡` → `GripVertical`.
- `SetRow/Editable` in Foundations: duplicate/remove icons → `Copy`/
  `Minus`.
- `Select/Dropdown` chevron → `ChevronDown`.
- All reorder-handle glyphs across `Screen/Mobile/WorkoutLogger`,
  `Screen/Web/ProgramEditor`, and `Screen/Mobile/ProgramEditor` (11
  instances) → `GripVertical`.
- All duplicate-set glyphs in `Screen/Mobile/WorkoutLogger`'s 3
  `SetRow/Editable` instances → `Copy`.

**Bug hit + fixed during this pass**: the first batch of
`GripVertical` replacements on the screen-level reorder handles
accidentally left a solid fill on the icon's outer wrapper frame
(inherited from the old text node's frame), which visually covered the
dot-grid glyph underneath with a flat gray square. Fixed by explicitly
clearing `fills = []` on each wrapper frame after insertion, verified
via screenshot on `Screen/Web/ProgramEditor` (dot-grid now renders
correctly, subtle and small) and `Screen/Mobile/WorkoutLogger`.

No remaining text-glyph placeholders exist anywhere in the file as of
this pass.

## 16. AppShell wired to real content (`Shell/Web/AppShell`, node `14:65`)

**Grounding**: the AppShell previously only proved the sidebar/nav
structure with a text placeholder ("Page content mounts here...") in
its content area — flagged as a gap in the prior "not done yet" list.

**What changed**: removed the placeholder text and mounted a real
Today-screen layout directly inside the shell's content frame (same
2-column pattern as the standalone `Screen/Web/Today`, resized to fit
the shell's 1040px content width vs. the standalone screen's full
1280px). The "Today" sidebar nav item now shows an active state
(background tint bound to `Semantic/Action/Primary`, semi-bold white
label) so the shell reads as a believable in-context screenshot rather
than an abstract nav diagram.

**Bug hit + fixed**: the active nav item's label was first left on its
default dark `Semantic/Text/Primary` color, which read as low-contrast
dark-on-blue. Fixed by rebinding the label's fill to
`Semantic/Action/PrimaryText` (white) to match the same
button-on-accent contrast pattern used everywhere else in the file.

**Scope decision**: only "Today" was mounted in-shell. Training,
History, Progress, and Settings nav items remain unmounted (still just
styled nav rows) — their content already exists as standalone screens
elsewhere in the file (§14), and duplicating all five into the shell
would be repetitive busywork for a static design file with no routing.
This is noted as an acceptable, intentional scope limit, not a gap.

## 21. Accessibility fixes + `ExerciseEditModal` (closing the edit-exercise gap)

**Tap targets**: bumped every `ExerciseBuilderRow`'s edit (✎) and delete
(🗑) `IconButton`s from 36×36 to 44×44 across all built rows (10 rows
found across `Screen/Web/Training`, `Screen/Web/ProgramEditor`,
`Screen/Mobile/ProgramEditor`) — now meets the WCAG 2.5.5 AAA target
size, not just the 2.5.8 AA minimum.

**Drag-alternative (WCAG 2.5.7, AA)**: added a `ReorderControl` (▲/▼
button pair, 24×20 each) next to the `≡` drag handle on every
`ExerciseBuilderRow`, so reordering exercises no longer requires a drag
gesture.

**New `ExerciseEditModal` component**: closes the gap where the ✎ edit
icon had no destination. Mirrors the existing `ExercisePickerModal`
shell/positioning but is pre-filled for an *existing* row: shows the
prescription kind as a **read-only** pill (kind is fixed at add-time —
changing it means removing and re-adding via the picker), numeric
`InlineField`s for the kind-specific values (Sets/Reps/Weight shown for
the Reps-kind example; a caption notes Duration shows a single Minutes
field and Distance+time shows Distance+Duration), and a `Save
changes` / `Cancel` / `Delete exercise` action row (destructive-styled
per `Semantic/Action/Destructive`, matching the Settings screen's
danger-zone pattern from §12). Built once on `Screen/Web/Training`
(node `81:2`) and cloned into `Screen/Web/ProgramEditor` (`82:2`) and
`Screen/Mobile/ProgramEditor` (`82:29`, adapted to a single-column
326px-wide stacked layout for mobile).

## 22. WCAG contrast fix — WorkoutLogger "Finish" button (node `15:7`)

**Found during**: a full accessibility pass across the Today/Training
redesign screens (contrast, tap targets, color-only cues, icon-button
labeling, drag-reorder alternatives).

**Bug**: the "Finish" button in `Screen/Mobile/WorkoutLogger`'s header
had its fill bound to `Semantic/Action/AccentSubtle` (`#6979f8`) while
its label stayed bound to `Semantic/Action/Primary` (`#3349f8`) —
near-identical hue/lightness, producing a **1.65:1** contrast ratio.
Fails WCAG AA (needs 4.5:1 for normal text, 3:1 minimum even for
large/bold text). Same class of mistake as the §16 AppShell nav-label
bug — a button label left bound to the wrong semantic token instead of
its paired "on-accent" text token.

**Fix**: rebound fill to `Semantic/Action/Primary` and label to
`Semantic/Action/PrimaryText` (white), matching the standard
`Button/Primary` pattern (**6.09:1**, passes AA/AAA) used everywhere
else in the file.

**Items resolved in §21 above** (kept here for history, not re-flagged
as open):
- `IconButton`s bumped to 44×44 and `ReorderControl` added.
- `ExerciseEditModal` built and propagated to all three
  Training/ProgramEditor screens.

**Still-open accessibility items from this pass**:
- Mood-emoji selectors (36×36px circles) on the Today ritual screens
  (`65:192`, `65:2`) pass the 24×24 AA minimum (WCAG 2.5.8) but miss the
  44×44 AAA target.
- Icon-only glyphs (✎/🗑/≡/▲/▼) have no visible text label — dev
  handoff needs `aria-label`s ("Edit exercise", "Delete exercise",
  "Reorder", "Move up"/"Move down").

**Second instance of the same bug, fixed same pass**: the "New PR:
Barbell Bench Press" toast card (node `43:17`, inside
`Screen/Mobile/WorkoutLogger`) had a solid `Semantic/Action/AccentSubtle`
fill with its title text left on `Semantic/Action/Primary` (1.65:1) and
its subtitle on `Semantic/Text/Secondary` (1.4:1) — both meant for
light/subtle backgrounds, not a solid accent fill. Fixed by rebinding
the fill to `Semantic/Action/Primary` and both text lines to
`Semantic/Action/PrimaryText` (white, 6.09:1). Given this is now the
**third** occurrence of this exact mistake (§16 AppShell nav label,
§17 Finish button, this toast card), worth double-checking any other
component using `AccentSubtle`/`Primary` as a solid fill for the same
issue.

## How this was built

Entirely via GitHub Copilot CLI's Figma MCP `use_figma` tool (JavaScript
against the Figma Plugin API) — variable collections, aliasing, and
auto-layout component construction were all done programmatically, then
verified visually via `get_screenshot` after each step (color ramps,
typography, spacing, radius, and components were each screenshotted and
inspected before moving on, catching this early and avoiding rework).

## 17. Competitive-research-driven additions: ghost "last session" text + PR badge + Session Summary screen

**Grounding**: `docs/research/competitive-analysis.md`, "Top 5 Actionable
Ideas" — Idea 1 ("ghost text of last session's numbers pre-filled/shown
under each set's inputs, reducing recall burden during a workout") and
Idea 2 ("a lightweight, immediate PR/achievement signal at the moment
it happens, plus a post-workout summary screen that reinforces
progress"). User approved implementing Ideas 1–2 first: "Start applying
idea 1-2 now (ghost text + PR badge/summary card) — fits current
screens directly."

**What changed**:

- `Screen/Mobile/WorkoutLogger` (`15:2`): added small "prev 185" /
  "prev 8" ghost text (weight/reps, `Semantic/Text/Disabled` color,
  smaller than the live input) under all 3 `SetRow/Editable` rows, and
  a Lucide `trophy` icon badge (stroke bound to
  `Semantic/Action/Primary`) on the Set 3 row, marking it as the
  PR-achieving set. Screenshot-verified.
- New screen `Screen/Mobile/SessionSummary` (node `43:2`, positioned at
  `x=1410, y=1750`, directly below `WorkoutLogger` in the mobile row):
  a post-workout recap with a title/date header, a 3-up stat row
  (Duration / Volume / PRs), a highlighted PR card (accent-subtle
  background, trophy icon, "New PR: Barbell Bench Press — 195 lb × 6,
  up from 185 lb × 8"), a condensed per-exercise set list, and
  Share/Done actions. Screenshot-verified — renders correctly.

**Bug hit + fixed during this build**: the build script failed twice
with `getVariableByIdAsync: Property "id" failed validation`. Root
cause (confirmed via a diagnostic pass that resolved every variable ID
in the script's `varMap` individually): the hardcoded `varMap` had
`"Semantic/Action/AccentSubtle"` mapped to `VariableID:3:42`, which
actually resolves to `Semantic/Action/PrimaryHover`. Corrected to the
real ID (`VariableID:3:45`, looked up by name via
`getLocalVariableCollectionsAsync`). A second, unrelated bug then
surfaced on retry: `Spacing/32` was missing from the same `varMap`
entirely (thrown as a clean "No mapping for" error thanks to added
defensive checks) — added the correct ID (`VariableID:3:56`) and the
build then succeeded cleanly. No orphan debris was left by either
failed attempt (both errored before the frame was appended, or the
partial frame was confirmed gone via a full cross-page node search
before rebuilding). **New practice going forward**: hardcoded `varMap`
tables should have every entry spot-checked against
`getLocalVariableCollectionsAsync` before reuse in a new script,
especially less-common variables (spacing values above `24`,
`AccentSubtle`, etc.), since a wrong-but-plausible ID fails silently
until it's actually dereferenced.

**Web parity (added same pass)**: `Screen/Web/Training` (`26:2`) now
mirrors the same pattern — "prev 180 lb" / "prev 8 reps" ghost text
under Set 1 and Set 2's weight/reps values, "prev 175 lb" / "prev 9
reps" under Set 3, and a trophy PR badge next to Set 3's rep count
(same Lucide `trophy`, `Semantic/Action/Primary` stroke, smaller at
16×16 to fit the denser web row height). Screenshot-verified.

**Not yet done / open questions**: none — Ideas 3–5 are covered in §18
below.

## 18. Competitive-research-driven additions: progression rule labels, HealthKit trends, pre-workout preview

**Grounding**: `docs/research/competitive-analysis.md`, "Top 5
Actionable Ideas" — Idea 3 ("plain-language progression rule labels in
ProgramEditor"), Idea 4 ("curated HealthKit metric grid on Today with
trend vs. 30-day avg"), and Idea 5 ("pre-workout session preview
card"). These are new ideas from the research (not refinements of
Ideas 1–2). User approved implementing all three in this pass.

**Idea 3 — Plain-language progression rule labels**:

- `Screen/Web/ProgramEditor` (`18:12`): the existing "Progression
  rule: [Double progression ▾]" row in `ProgramDayDetail` was
  restructured (dropdown row switched from horizontal to vertical
  parent layout) to add a small secondary-colored description line
  underneath: "Increase reps each session until you hit the top of the
  rep range, then add weight and reset to the bottom." Screenshot-
  verified.
- `Screen/Mobile/ProgramEditor` (`29:59`): mobile has no progression
  rule *editor* (deferred to web per §14), but since the rule still
  applies to the viewed day, added a read-only "Progression rule:
  Double progression" line + the same plain-language description
  above the existing "Edit on web..." note. Screenshot-verified.
- Only the "Double progression" copy was written out as a concrete
  example (matching the day already shown); the other two rule types
  from the research doc (Linear, Percentage-based) are documented here
  as the source copy to reuse once the dropdown becomes interactive:
  - **Linear (+5lb per session)** — "Add weight every session when you
    complete all prescribed reps. Best for beginners on compound
    lifts."
  - **Percentage-based (%1RM)** — "Sets are prescribed as a % of your
    estimated max. Adjusts automatically as your strength improves."

**Idea 4 — HealthKit metric grid trend indicators**:

- Both `Screen/Mobile/Today` (`13:3`) and `Screen/Web/Today` (`25:2`)
  already had a "From Apple Health" 2×2 tile grid (Steps, Active
  Calories, Exercise Minutes, Calories via MFP) from earlier passes —
  this pass added the specific piece Idea 4 called for: a small
  trend-vs-30-day-average line under each tile's value, colored via
  `Semantic/Status/Success` (green, up-arrow) or
  `Semantic/Status/Error` (red, down-arrow) depending on direction.
  Screenshot-verified on both screens.
- **Bug hit + fixed (web only)**: the web tile-grid wrapper frame
  (`25:29`) had a hardcoded `FIXED` height (200px) left over from the
  original build, sized for single-line tiles. Adding the new trend
  line clipped the bottom row. Fixed by resizing the frame to 240px
  (kept `FIXED` sizing rather than switching to `AUTO`, since the
  parent card `25:27` also had a fixed height that would have needed a
  matching change — a straightforward manual resize was simpler and
  fully verified via screenshot).
- **Deferred**: Idea 4's "Connect" dimmed state for unauthorized/
  missing HealthKit permission was not built this pass — no screen
  currently models an unauthorized state for any metric, and doing it
  well needs a decision on where that state belongs (per-tile dimming
  vs. a banner) that wasn't in scope for this batch. Tracked as an open
  item below.

**Idea 5 — Pre-workout session preview card**:

- Both `Screen/Mobile/Today` (`13:3`) and `Screen/Web/Today` (`25:2`)
  already had a "Today's Workout" card with a single "Start Workout"
  button — enhanced on this pass rather than replaced. Changes on both
  platforms:
  - Subtitle line updated from "5 exercises · Last done Aug 15" to
    "Week 2 · Day 3 · 5 exercises · ~45–55 min", matching the research
    doc's literal example copy.
  - Added a secondary "Preview" button (outline style, `Semantic/
    Border/Subtle` stroke) next to "Start Workout", sized to sit
    side-by-side (mobile: Start Workout flexes wider at 230px + Preview
    fixed 88px; web: both auto-sized with 8px gap).
  - "Preview" is understood to open the exercise list with prescribed
    sets × reps × weight (per the research doc), matching content
    already shown elsewhere in `ProgramEditor`'s day-detail view — no
    new screen was built for this since the destination content
    already exists; wiring/interaction is out of scope for a static
    design file.
  - Screenshot-verified on both `Screen/Mobile/Today` and
    `Screen/Web/Today`.

**Not yet done / open questions**:

- Idea 4's dimmed "Connect" state for unauthorized HealthKit metrics —
  needs a design decision on where/how to show it before building.
- All 5 competitive-research ideas are now applied in some form. No
  further research-driven work is queued unless the user requests
  another round or flags additional apps to study.

> **Note**: all `x=`/`y=` coordinates and "mobile row"/"web row"
> references in earlier sections (§10–§18) describe the file as it
> existed on the old single `📱 Screens` page, which no longer exists
> as of §19 below. See §19.2 for current page/frame organization.

## 19. File-wide audit, page reorganization, and dashboard enrichment

**Grounding**: user request to review the current designs for color
correctness, reorganize screens into a real user-flow order instead of
build-order sprawl, split mobile/web onto their own Figma pages, and
enrich sparse screens (Progress, Settings) with more dashboard content.

### 19.1 Color/style audit

Ran a full programmatic scan of every fill/stroke on every node across
all 19 screens, checking for paints not bound to a design-system
variable. Found and fixed 7 issues:

- **6 stray hardcoded white fills** on icon-wrapper frames (the Lucide
  `trophy` PR-badge icons added in §17, on
  `Screen/Mobile/WorkoutLogger`, `Screen/Web/Training`, and
  `Screen/Mobile/SessionSummary`) — same root cause as the §15 grip-icon
  bug: a wrapper frame inherited a solid fill from the text node it
  replaced. Fixed by clearing `fills = []` on each wrapper.
- **1 hardcoded black text fill** on the "Progression rule: Double
  progression" label added to `Screen/Mobile/ProgramEditor` in §18 —
  was never bound to `Semantic/Text/Primary` when it was written.
  Fixed by binding it properly.

Re-ran the scan after fixes: **zero unbound colors remain anywhere in
the file.** This audit + fix should be treated as a periodic practice
after any batch of programmatic component/icon insertions, since the
wrapper-inherited-fill bug has now recurred twice (§15, §19) with the
same shape (icon replaces a text node, wrapper frame keeps the old
fill).

### 19.2 Page reorganization: Mobile/Web split + flow order

The single `📱 Screens` page (19 frames placed in build order across
two rows) was split into two dedicated pages:

- **`📱 Mobile`** (10 frames) — SignIn → SignUp → Today →
  WorkoutLogger → SessionSummary → ProgramEditor → ExerciseHistory →
  Progress → Settings → `Shell/Mobile/TabBar`, left-to-right in a single
  row, ordered to match the real signup-to-daily-use user flow rather
  than the order screens were originally built in.
- **`🖥️ Web`** (9 frames) — SignIn → SignUp → Today → Training →
  ProgramEditor → ExerciseHistory → Progress → Settings →
  `Shell/Web/AppShell`, same flow-ordered single row.

The old `📱 Screens` page was deleted once confirmed empty. Verified
via a programmatic bounding-box collision check on both new pages:
**zero overlaps** on either page after the move (frame heights grew on
some screens per §19.3 below, but the flat single-row layout with
120px x-gaps has no vertical collision risk since every frame starts
at `y=0`).

### 19.3 Dashboard enrichment (Progress + Settings)

Both screens were flagged as visually sparse. Enriched both platforms
identically:

**Progress** (`Screen/Mobile/Progress` node `19:2`,
`Screen/Web/Progress` node `29:2`) — grounded in the domain functions
already named in §9 (`estimateOneRepMax`, `calculateVolume`) and daily
manual inputs in §10:

- Added **2 new trend cards** reusing the exact card pattern from the
  original 3 (label + big value + delta subtitle + 6-bar sparkline):
  "Squat Est. 1RM" (285 lb, +15 lb this month) and "Workouts This
  Month" (14, vs 11 last month).
- Added a new **"Consistency (last 8 weeks)" streak widget** — 8
  columns of 4 dots each (one dot per week of a theoretical 4-session
  program), filled dots bound to `Semantic/Action/Primary`, empty dots
  to `Semantic/Action/AccentSubtle`, plus a bold summary line ("4-week
  streak · 27 of 32 planned sessions completed").
- Web version required wrapping the trend-card row (`layoutWrap:
  "WRAP"`, fixed width, explicit `counterAxisSpacing`) since 5 cards no
  longer fit one 1280px-wide row — this was not needed on mobile since
  cards were already stacked vertically.
- Screenshot-verified on both platforms.

**Settings** (`Screen/Mobile/Settings` node `20:2`,
`Screen/Web/Settings` node `29:38`) — grounded in the
`integration_sync_state` data model entity (master prompt "Integration
sync state" section) for the new Health Sync section, plus standard
expected app settings for Notifications:

- Added an **"Apple Health sync" section**: "Apple Health sync —
  Connected ›" (value text bound to `Semantic/Status/Success`, green)
  and "Last synced — 2 minutes ago".
- Added a **"Notifications" section**: "Workout reminders — On ›" and
  "Weekly progress summary — On ›".
- Both new sections were built by cloning the existing
  Units/Timezone card (identical bordered-card-of-label/value-rows
  pattern) and editing the cloned text nodes, keeping the section
  visually and structurally consistent with Account/Preferences/Danger
  zone rather than introducing a new card style.
- Screenshot-verified on both platforms.

**Not yet done / open questions**:

- Idea 4's dimmed "Connect" state for unauthorized HealthKit metrics
  (still open from §18).
- Further dashboard enrichment (e.g. richer ExerciseHistory, a
  Today-screen weekly-mini-calendar) was not requested this pass but
  could be a natural next step if more screens still feel sparse after
  review.
- No dark-mode pass yet (still deferred per earlier user direction).

## Next steps

1. Review the live Figma file directly and confirm the accent ramp,
   neutral ramp, and first 3 components read the way you want.
2. Decide whether to keep building components (Card/Input/Tab
   bar/Appbar) before any real app screens, or move straight to a first
   real screen (e.g. mobile "Today" or the workout logging `SetRow` in
   context) to validate the tokens against real content sooner.
3. Ramp the status colors once a concrete use case needs a tint/shade
   (e.g. a toast or badge background).

## 20. Real API wiring + mock-mode dev script

- All `apps/web/src/pages/*.tsx` now call the real Fastify API (via
  `useApiClient()` + `@tanstack/react-query`) instead of rendering
  hardcoded sample data. `npm run dev` (the default) requires a running
  `apps/api` dev server and talks to it directly.
- For design/feature iteration without a backend, `npm run dev:mock`
  (sets `VITE_USE_MOCKS=true`) starts an MSW (`msw/browser`) service
  worker — see `apps/web/src/mocks/handlers.ts` for the mocked routes and
  `apps/web/src/mocks/browser.ts` for the worker setup. The old hardcoded
  page mock data was moved into these handlers rather than discarded.
- Some routes exposed by the real API are still stubs returning empty
  data (`GET /v1/exercises/:exerciseId/history` and `/progress`, and
  there's no `GET` list endpoint for a template's exercises) — pages
  using them show an empty/loading state with a `// TODO: apps/api needs
  to expose X` comment at the call site until the backend fills those in.
