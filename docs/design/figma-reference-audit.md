# Setline — Figma Reference Audit

Status: Draft for review. No application UI has been built or modified.
Connected via GitHub Copilot CLI's remote Figma MCP server
(`https://mcp.figma.com/mcp`), authenticated as `Kyle` (Figma Pro, Full seat).

This audits the three reference files the user selected, to extract
reusable structural/visual patterns while explicitly avoiding copying any
source branding.

## 1. Files reviewed

| # | File | Figma key | What it actually is |
|---|---|---|---|
| 1 | "Dashboard UI Kit — Dashboard (Free Admin Dashboard, Community)" | `C6AIeKt8TLCUMOqRZ2ugOa` | A community duplicate of **SnowUI** (byewind.com) — a polished analytics/admin dashboard kit. Node `0:1` "🟪 Dashboard" page, "Dashboard Overview" frame is the reference screen. |
| 2 | "Microsoft Fluent 2 Web (Community)" | `Om99Xb8VRgqBXU9pAtG9y6` | Official Microsoft Fluent 2 Figma resources. The linked node (`9738:8`, "Docs") is specifically the **"Fluent Theme Designer" plugin instructions page** — it documents Fluent's brand/neutral-ramp theming *methodology*, not a static hex palette. |
| 3 | "Free Fitness App UI Kit (Community)" | `kOdmydShFZWaj5mw0ZWOdF` | A dense (~40+ screen) mobile fitness app UI kit (pink/black "Realti"-style branding). The linked node (`2:154`, "Page 2") is a "More Free UI Kits" promo/gallery page; the real screens live in other frames within the same file (e.g. `202:10972` "Home/Home"). |

Note: Figma's remote MCP page-listing consistently returned only the first
page ("Cover") for files #2 and #3 in this session — full page enumeration
needs either a live desktop/browser Figma session or direct node IDs (which
we had, from the user's URLs). This is a tooling limitation, not a finding
about the files themselves.

## 2. File 1 — Dashboard UI Kit ("SnowUI") audit

**Layout/structure (reusable):**
- Persistent left `Sidebar` (212px) + main content + optional right
  `RightSidebar` (280px) three-column shell; sticky `Header` (68px) above
  content.
- Content grid built from a consistent `Card` primitive: 24px padding, 8px
  internal gap, 20px corner radius, used for both small KPI tiles and large
  chart "Block" containers (330px/280px tall).
- KPI tiles follow one anatomy: label → big animated number
  ("Rolling number" component) → trend indicator (`IconText`, e.g.
  "+11.01%").
- Chart blocks (line, donut, bar) sit in the same `Card`/`Block` shell —
  visual consistency across very different data types.

**Design tokens observed (via `get_design_context`, real values, not
guesses):**
- Typography: **Inter**, Regular 400 for labels (12–14px, 16–20px line
  height), Semi Bold 600 for metric numbers (24px/36px line height). Uses
  stylistic-set font features (`ss01`, `cv01`, `cv11`) for tabular/legible
  numerals — directly relevant to Setline's "numbers must be extremely
  legible" requirement.
- Color sample: card background `#edeefc` (very light indigo/lavender
  tint), primary text `#1c1c1c` ("black/100%" semantic token, not pure
  black) — i.e., the kit already uses **semantic color aliases**, not raw
  hex, internally (`--color-2`, `--black/100%`).
- Radius scale observed: 4 / 8 / 12 / 20 px.
- Spacing observed: 8 / 24 px gaps and padding.
- Has light and dark theme variants (seen in the "SnowUI" cover/thumbnail
  frame: light dashboard + a near-identical dark dashboard).

**Assessment for Setline:**
- ✅ Reusable: the three-column shell, the single unifying `Card` primitive
  for both KPI tiles and charts, the metric-tile anatomy (label → big
  number → trend), semantic color-alias approach, dual light/dark theme.
- ✅ This maps almost directly onto Setline's `MetricTile`,
  `DailyMetricRow`, `ActivitySummary`, and web `AppShell`/dashboard-style
  "Today"/"Progress" screens.
- ⚠️ Too generic-SaaS to copy literally: needs Setline's own type scale,
  color ramp, and restrained-elevation direction (master spec explicitly
  warns against "generic enterprise SaaS" and "dense enterprise tables").
- ❌ Not reusable as-is: this is a desktop-dashboard-first layout; Setline's
  primary surface is mobile logging, so this kit only really informs the
  **web** "Today"/"Progress"/"Training" screens, not mobile.
- Brand-specific to strip: "SnowUI" wordmark/branding, the exact lavender
  tint if it reads as too closely tied to this kit's identity (it's generic
  enough to be safe, but Setline should pick its own accent rather than
  reuse `#edeefc` verbatim).

## 3. File 2 — Microsoft Fluent 2 Web audit

**What it actually contains at the linked node:** a walkthrough of the
**Fluent Theme Designer** plugin: pick a brand color + neutral color, the
plugin generates a full accessible color ramp and a "UI Preview Sticker
Sheet" (brand ramp swatches, neutral ramp swatches, applied to real
controls: toggles, radios, buttons, input fields, in both light and dark).

**Assessment for Setline:**
- ✅ Reusable *methodology*, not literal tokens: Fluent's core idea — derive
  a full semantic ramp (`brand-10` … `brand-160`-style steps, neutral ramp)
  from **one accent + one neutral base**, and apply it consistently to
  every control state (default/hover/pressed/selected/disabled) in both
  themes — is exactly the kind of systematic token architecture
  `packages/design-tokens` should follow (`color.action.primary`,
  `color.surface.raised`, etc., per the master spec's semantic-token
  requirement).
- ✅ Reusable: light/dark parity shown side-by-side for every control in
  the sticker sheet is a good QA pattern to adopt for Setline's own
  component audit once tokens exist.
- ❌ Not reusable: Microsoft's actual brand blue and Fluent's specific
  iconography/wordmark are Microsoft's identity — Setline must pick its
  own accent (per branding spec: "one clear primary accent," avoiding
  "excessive electric blue").
- This file is best used as a **process reference** (how to structure a
  ramp + apply it), not a visual asset to copy from.

## 4. File 3 — Free Fitness App UI Kit audit

**Layout/structure (reusable):**
- Mobile-only, single-column, `Appbar` + scrollable `Body` per screen.
- Home screen anatomy: greeting/appbar → big "Statistical" card row (steps,
  distance, points) → small square metric `Cards` (icon + label + big
  number, e.g. "235 Kcal" for Treadmill) → weekly `Calendar` strip → recent
  activity list.
- Covers exactly the metric types Setline needs on mobile: steps, distance,
  calories, workout duration/timers, weekly calendar, GPS route map,
  subscription/paywall screen, profile, activity history list.
- Small metric-card anatomy (icon top-left, label, big bold number, thin
  gradient accent line at the top edge) is a strong, compact pattern for
  Setline's mobile `MetricTile`/`DailyMetricRow`.

**Design tokens observed:**
- Typography: **Circular Std** (Book 400 / Bold 700) — a licensed
  commercial font (not safe to ship as-is; see §6).
- Color sample: primary text `#040415` (near-black, slightly blue-shifted)
  — again a "not pure black" choice, consistent with File 1's pattern.
- Metric-card radius: 2px (much tighter than File 1's 20px) — this kit
  leans sharper/denser than the dashboard kit.

**Accessibility/technical issues found (avoid copying):**
- ⚠️ Cards use **absolute pixel positioning with percentage insets**
  (`left-[14.29%]`, `top-[calc(50%+28px)]`, etc.) rather than auto-layout/
  flex — brittle for responsive/dynamic content and a bad pattern to port
  into React Native (which has no absolute-percentage-based layout
  primitive as clean as this implies; Setline mobile should use Flexbox).
- ⚠️ Some text sits at low opacity (60%) directly on a colored background —
  needs a contrast check before Setline reuses that treatment; don't
  inherit without verifying WCAG contrast.
- Heavy pink/black branding and "Realti"/kit-specific iconography must be
  fully replaced — this is the most brand-specific of the three files.

**Assessment for Setline:**
- ✅ Reusable: screen inventory/IA (which metrics go where), the compact
  metric-tile anatomy, single-column mobile shell, calendar-strip pattern.
- ❌ Not reusable: Circular Std font, pink/black palette, absolute-layout
  implementation technique, "Realti" wordmark/iconography.

## 5. Cross-file synthesis

| Pattern | Source | Setline decision |
|---|---|---|
| Semantic color aliases over raw hex | Files 1 & 2 | **Adopt.** `packages/design-tokens` uses semantic names only. |
| Card/tile as the one grouping primitive (not nested cards) | File 1 | **Adopt**, restrained per master spec §16 (use whitespace/dividers before shadows). |
| Metric anatomy: label → large number → trend/context | Files 1 & 3 | **Adopt** for `MetricTile`, `DailyMetricRow`, `PRBadge`. |
| Brand ramp + neutral ramp generation methodology | File 2 | **Adopt process**, not Microsoft's actual colors. |
| Light/dark theme parity shown per-control | File 2 | **Adopt as a QA practice** once Setline components exist. |
| Mobile single-column, appbar+body, calendar strip | File 3 | **Adopt IA**, not its visuals. |
| Absolute/percentage positioning for layout | File 3 | **Reject** — use Flexbox/auto-layout equivalents. |
| Circular Std / any file's specific typeface | Files 1 & 3 use Inter / Circular Std respectively | Decide separately (§6). Inter is safe to reuse if desired (open license); Circular Std is not free to redistribute. |
| Pink/black, Microsoft blue, "SnowUI"/"Realti" branding | All 3 | **Reject entirely** — none of it becomes Setline's identity. |

## 6. Font licensing note

- **Inter** (File 1): SIL Open Font License — safe to use/ship on web and
  mobile.
- **Circular Std** (File 3): a commercial font (Lineto) — **not** safe to
  bundle/ship without a license. If Setline wants a geometric-sans feel
  similar to Circular Std, use a comparable open-licensed alternative
  (e.g., system fonts, or an open geometric sans) rather than embedding
  Circular Std files.
- Fluent's default web font (Segoe UI / system-ui stack) is effectively
  "use the OS font," which is a safe, zero-licensing-risk default worth
  considering for Setline too.

## 7. What's next

See `docs/design/setline-design-system.md` for the proposed Setline token
direction synthesized from this audit, and
`docs/design/figma-to-code-map.md` for the component-to-implementation
mapping. Both are proposals pending your approval before any application UI
is built.
