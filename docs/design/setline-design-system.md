# Setline — Proposed Design System Direction (v0, Draft)

Status: **Proposal only — not approved, not implemented.** No components or
tokens have been coded yet. This synthesizes
`docs/design/figma-reference-audit.md` into a concrete but still-adjustable
direction for your review.

## 1. Brand recap (from the branding prompt)

Setline should feel: focused, modern, precise, athletic, calm, trustworthy,
data-aware, premium-without-luxury, serious-without-clinical. Avoid:
aggressive/macho/CrossFit-cliché, neon/cyberpunk, medical-portal, generic
enterprise SaaS, gamified-for-its-own-sake.

## 2. Color direction (proposed, not final)

Following the Fluent "one brand ramp + one neutral ramp" methodology (§4 of
the audit), not Fluent's actual colors, and rejecting File 3's pink/black
and File 1's default lavender tint as "not distinctly Setline":

- **One primary accent**, used sparingly (primary actions, active states,
  key data lines). Proposed direction: a deep, slightly desaturated blue or
  teal — reads as precise/calm/trustworthy without becoming "electric blue"
  or a medical-portal blue. Exact hex to be chosen together with you before
  lock-in (this is the one piece of §13 in the branding prompt that
  explicitly should not be finalized before this review).
- **Neutral ramp**: near-black text (`#1c1c1c`-to-`#141414` range, not pure
  `#000000` — matches the "not pure black" pattern both source files
  independently converged on) through to off-white/near-white surfaces.
  Avoid pure white canvas in favor of a very subtle off-white
  (`~#F7F8FA`-ish) for reduced eye strain during gym/mobile use.
- **Semantic status colors** (success/caution/error/info), never used as
  the only signal (icons/text always pair with color, per master spec §13).
- Dark theme is a parity requirement from day one (architecture, not just
  visual reskin), matching File 1 and File 2's dual-theme approach.

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
  Setline's "275 × 5" / "169.6 lb" legibility requirement from the master
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
  4/8/12/20 range — Setline is not a decorative dashboard; propose `8px`
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
  unified `Card`/metric-tile anatomy — adapted with Setline's own tokens.
- **Mobile**: File 3's single-column `Appbar` + scrollable body shell, its
  screen inventory (steps/calories/distance/calendar/history), and its
  compact metric-tile anatomy (icon + label + big number) — reimplemented
  with Flexbox/auto-layout (not absolute positioning), Setline tokens, and
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
   sourced from any reference file; Setline-original, designed against the
   numeric-legibility type tokens above.

## 8. What needs your decision before implementation starts

1. **Accent color** — approve the deep blue/teal direction, or provide a
   different starting hue.
2. **Typeface** — approve Inter, or provide a different open-licensed
   preference.
3. **Radius scale** — approve the proposed 8/16px restrained pair.
4. Confirm the three "reject" lists in §5 of the audit (pink/black,
   Microsoft blue/Fluent iconography, Circular Std, absolute-positioning
   technique) — anything you actually want kept despite the audit's
   recommendation?

No component code, token files, or app screens will be created until these
are confirmed.
