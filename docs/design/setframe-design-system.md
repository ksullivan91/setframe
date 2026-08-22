# Setframe — Proposed Design System Direction (v0, Draft)

Status: **Proposal only — not approved, not implemented.** No components or
tokens have been coded yet. This synthesizes
`docs/design/figma-reference-audit.md` into a concrete but still-adjustable
direction for your review.

## 1. Brand recap (from the branding prompt)

Setframe should feel: focused, modern, precise, athletic, calm, trustworthy,
data-aware, premium-without-luxury, serious-without-clinical. Avoid:
aggressive/macho/CrossFit-cliché, neon/cyberpunk, medical-portal, generic
enterprise SaaS, gamified-for-its-own-sake.

## 2. Color direction (proposed, not final)

Following the Fluent "one brand ramp + one neutral ramp" methodology (§4 of
the audit), rejecting File 3's pink/black and File 1's default lavender
tint as "not distinctly Setframe." The earlier draft of this doc proposed a
blue/teal accent — the user rejected that ("blue/teal is boring... big fan
of purple") and requested a purple direction, sourced from a 4th reference
file (`docs/design/figma-reference-audit.md` §5).

- **One primary accent, purple/indigo-violet family.** Starting point:
  `#6979f8` (indigo-violet), found in File 4 as a text-link/tag accent.
  This reads as genuinely purple/violet rather than blue/teal, while still
  avoiding neon/cyberpunk saturation — fits the brand brief's "one clear
  accent, calm/precise/premium" criteria. **Not yet locked**: before
  implementation, run this hue (and 1–2 nearby variants — e.g. slightly
  more saturated/"grape," or slightly deeper) through:
  1. A proper tint/shade ramp generation pass (10-step brand ramp, per
     File 2's Fluent Theme Designer methodology) so every control state
     (default/hover/pressed/disabled, light + dark) has a token, not just
     one hex.
  2. A WCAG AA contrast check against both near-black text and
     white/near-white surfaces, in both themes.
  Confirm the exact final hex + ramp with the user once generated (see §8).
- **Neutral ramp**: near-black text, anchored on `#151522` (from File 4) —
  a cool/blue-violet-shifted near-black rather than pure `#000000`. This is
  now a **3-for-3 cross-file convention** (Files 1, 3, and 4 each
  independently chose a near-black, never pure black, for primary text),
  so it's a strong signal to keep regardless of accent hue. Surfaces:
  off-white/near-white in light theme; File 4 additionally showed the
  near-black neutral doing double duty as the dark-theme surface color
  (no separate "dark navy" token needed) — a minimal-palette technique
  worth adopting.
- **Semantic status colors** (success/caution/error/info), never used as
  the only signal (icons/text always pair with color, per master spec
  §13). File 4 also incidentally exposed `#00C48C` (green) and `#FF647C`
  (red/coral) elsewhere in its node tree — reasonable starting points for
  `status.success`/`status.error` if a fresh pair is wanted, though these
  are not yet contrast-checked either.
- Dark theme is a parity requirement from day one (architecture, not just
  visual reskin), matching File 1, File 2, and File 4's dual-theme
  approaches.

Proposed semantic token names (values TBD pending accent approval):

```ts
color.text.primary
color.text.secondary
color.text.inverse
color.surface.canvas
color.surface.raised
color.border.default
color.border.subtle
color.action.primary
color.action.primaryHover
color.action.destructive
color.status.success
color.status.caution
color.status.error
color.status.info
color.chart.series1 .. color.chart.series4
```

## 3. Typography direction

- **Primary typeface: Inter** (from File 1) — open-licensed (SIL OFL), free
  to ship on web and React Native, already has strong numeral-legibility
  features (tabular figures, stylistic sets) which directly serves
  Setframe's "275 × 5" / "169.6 lb" legibility requirement from the master
  spec.
- Reject Circular Std (File 3) due to commercial licensing — do not bundle
  it.
- Weight usage mirrors File 1's pattern: Regular (400) for labels/body,
  Semi Bold (600) for numeric metrics and headings — gives the "confident
  hierarchy without shouting" feel the brand personality calls for.

Proposed scale (to refine once implemented against real screens):

| Token | Size / Line height | Weight | Use |
|---|---|---|---|
| `display` | 32/40 | Semi Bold | Rare, hero moments only |
| `pageTitle` | 24/32 | Semi Bold | Screen titles |
| `sectionTitle` | 18/24 | Semi Bold | Card/section headers |
| `body` | 14/20 | Regular | Default text |
| `compactBody` | 13/18 | Regular | Dense lists |
| `label` | 12/16 | Regular | Field labels, captions |
| `helper` | 12/16 | Regular (muted color) | Helper/error text |
| `numericMetric` | 24/36 | Semi Bold, tabular figures | Dashboard KPIs |
| `numericWorkoutSet` | 18/24 | Semi Bold, tabular figures | Set rows (`275 × 5`) |
| `button` | 14/20 | Semi Bold | Button labels |
| `caption` | 11/14 | Regular | Timestamps, meta |

## 4. Spacing & radius

- Spacing scale: adopt the master spec's suggested `4/8/12/16/24/32/40/48`,
  which is a superset compatible with File 1's observed 8/24 usage.
- Radius: adopt a **restrained 2-tier** scale rather than File 1's full
  4/8/12/20 range — Setframe is not a decorative dashboard; propose `8px`
  (small controls: inputs, chips, small buttons) and `16px` (cards/sheets).
  Reject File 3's ultra-tight `2px` (reads as dated/skeuomorphic) and File
  1's `20px` (reads as too soft/consumer-app for a training-record tool).

## 5. Elevation & surfaces

- Favor whitespace, dividers, and subtle surface-color contrast over
  shadows (master spec §16), directly informed by rejecting File 1's
  everything-is-a-floating-card tendency. Cards should exist only for
  genuinely distinct groupings (e.g., a single workout's exercise block),
  not for every row.

## 6. Layout patterns to adopt

- **Web** ("Today"/"Progress"/dashboard-style screens): File 1's
  three-column shell (`Sidebar` + content + optional `RightSidebar`) and
  unified `Card`/metric-tile anatomy — adapted with Setframe's own tokens.
- **Mobile**: File 3's single-column `Appbar` + scrollable body shell, its
  screen inventory (steps/calories/distance/calendar/history), and its
  compact metric-tile anatomy (icon + label + big number) — reimplemented
  with Flexbox/auto-layout (not absolute positioning), Setframe tokens, and
  verified contrast (reject the 60%-opacity-text-on-color pattern found in
  the audit).
- **Both**: Fluent's per-control light/dark parity discipline as an
  internal QA habit once components exist.

## 7. Component priorities (build foundation first, per master spec §18)

Order of first implementation once approved, straight from the audit's
"reusable" findings:
1. Design tokens (`packages/design-tokens`) — color, type, spacing, radius.
2. `Card`/surface primitives, `Text`/`NumericText`, `Stack`/`Inline`.
3. `MetricTile` + `DailyMetricRow` (informed by Files 1 & 3).
4. Web `AppShell` (sidebar/header) — informed by File 1.
5. Mobile tab shell + `Appbar` — informed by File 3.
6. `SetRow` (the master spec's "most important component") — not directly
   sourced from any reference file; Setframe-original, designed against the
   numeric-legibility type tokens above.

## 8. What needs your decision before implementation starts

1. **Accent color** — ✅ implemented in Figma: purple/indigo-violet ramp
   generated from `#6979F8` (step 500), see
   `docs/design/setframe-figma-style-guide.md`. Review the live ramp in
   Figma and confirm, or request adjustments.
2. **Typeface** — approve Inter, or provide a different open-licensed
   preference. (Already used in the Figma typography specimen.)
3. **Radius scale** — ✅ implemented: `Radius/Small` (8), `Radius/Large`
   (16), `Radius/Full` (999) now exist as Figma variables and are used in
   the first draft components.
4. Confirm the "reject" lists in §5 of the audit (pink/black, Microsoft
   blue/Fluent iconography, Circular Std, SF Pro for web/Android,
   absolute-positioning technique) — anything you actually want kept
   despite the audit's recommendation?

Token files and Figma components now exist (see
`docs/design/setframe-figma-style-guide.md`) — no production app screens
have been built yet.
