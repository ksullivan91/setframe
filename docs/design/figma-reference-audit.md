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
| 4 | "Brainstorming UI Style Kit (Community)" | `KbPnTv3BW7xghMNrhE8dnu` | A blog/reader-app mockup kit (by Rusmir Arnautovic / "BM"). Requested specifically for its **color scheme** (per user: "blue/teal is boring... big fan of purple"). Linked node (`1:102`) is the cover/promo canvas showing two stacked iPhone mockups (a side-nav menu screen + an article/blog reader screen). |

Note: Figma's remote MCP page-listing consistently returned only the first
page ("Cover") for files #2, #3, and #4 in this session — full page
enumeration needs either a live desktop/browser Figma session or direct
node IDs (which we had, from the user's URLs). This is a tooling
limitation, not a finding about the files themselves.

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

## 5. File 4 — Brainstorming UI Style Kit audit (purple/violet accent)

Requested specifically for its color scheme, after rejecting the earlier
blue/teal accent direction ("blue/teal is boring... big fan of purple").

**What was inspected:** the cover canvas (`1179:22097`) showing two mocked
iPhone screens — a dark side-navigation/menu screen (`1179:22130`, "06 -
Menu Screen") and a light article/blog-reader screen (`1179:22097`'s right
phone, "05 - Article Screen") — plus the nested blog-card component
(`1179:22183`) for real token values. This is a **blog/reader app** kit,
not a fitness kit — it's in scope for color/typography reference only, per
the user's request, not for layout/IA (File 3 already covers fitness
mobile IA).

**Design tokens observed (real values via `get_design_context`):**
- **Accent (the purple)**: `#6979f8` — a periwinkle/indigo-violet, used
  sparingly as a text-link/tag color ("Posted in **Design tools**"), not as
  a large fill. Reads as softer and more blue-violet than a saturated
  "grape purple" — closer to an indigo. This is the closest real hex this
  file offers to "purple"; there was no swatch library node exposing a
  full purple ramp (variable/style lookups returned empty for this
  community file, consistent with the tooling limitation noted in earlier
  audits).
- **Neutral/near-black text**: `#151522` — another "not pure black,
  slightly cool/blue-violet-shifted" choice, consistent with the pattern
  Files 1 and 3 also independently used. Reinforces near-black (not
  `#000000`) as a cross-file convention worth keeping regardless of accent
  hue.
- **Secondary/muted text**: `#999999` (gray).
- **Divider**: `#E4E4E4` at ~60% opacity (`rgba(228,228,228,0.6)`), used
  as hairline borders around avatars and section dividers.
- **Dark surface** (menu screen background, from screenshot inspection,
  not a text-node hex): a near-black navy (`~#151522`-family, consistent
  with the near-black text token doing double duty as a dark-mode surface
  — a nice, minimal-palette trick).
- **Status/accent secondary**: `#00C48C` (green) and `#FF647C` (red/coral)
  appear elsewhere in the file's node tree (likely chart/status use) —
  useful precedent for Setline's existing `status.success`/`status.error`
  semantic slots, not for the primary accent.
- **Typography**: SF Pro Display (headings, Light/Semibold) and SF Pro Text
  (body/labels, Light/Regular/Medium) — Apple's system font. Not
  open-licensed for arbitrary redistribution the way Inter is, but as
  Apple's system font it's free to *reference on iOS* (San Francisco ships
  with the OS); not relevant for web/Android, where Inter remains the
  practical cross-platform choice.
- **Radius**: blog-card thumbnail images use a tight `5px` — closer to
  File 3's dense/sharp end than File 1's soft `20px`.

**Assessment for Setline:**
- ✅ Reusable: the `#6979f8` indigo-violet as a literal starting point for
  Setline's primary accent — it satisfies the brand brief's "one clear
  accent, not neon/cyberpunk, not medical-blue" criteria while genuinely
  reading as purple/violet rather than blue/teal. The near-black
  (`#151522`) neutral-text convention lines up with what Files 1 & 3
  already independently converged on, so keeping "near-black, not pure
  black" as Setline's neutral-ramp anchor is now a 3-for-3 cross-file
  pattern.
- ✅ Reusable: using the near-black neutral as the dark-theme surface color
  too (rather than a separate near-black-navy token) — a genuinely useful,
  minimal-palette technique worth adopting.
- ⚠️ Use as a **starting point, not a literal lock**: `#6979f8` is one
  specific indigo; Setline should still run it (and 1–2 nearby
  variants — more violet/less blue, or slightly deeper/more saturated) through
  a proper ramp-generation pass (per File 2's Fluent methodology, §3/§6
  below) and a contrast check (WCAG AA against both the near-black text
  and white/near-white surfaces) before lock-in, rather than hardcoding
  this exact hex untested.
- ❌ Not reusable: the blog/reader IA (article screen, side-nav menu
  screen) — not fitness-relevant; File 3 remains the IA source for mobile
  fitness screens. SF Pro as a cross-platform web/Android typeface
  (licensing/availability mismatch vs. Inter).

## 6. Cross-file synthesis

| Pattern | Source | Setline decision |
|---|---|---|
| Semantic color aliases over raw hex | Files 1 & 2 | **Adopt.** `packages/design-tokens` uses semantic names only. |
| Card/tile as the one grouping primitive (not nested cards) | File 1 | **Adopt**, restrained per master spec §16 (use whitespace/dividers before shadows). |
| Metric anatomy: label → large number → trend/context | Files 1 & 3 | **Adopt** for `MetricTile`, `DailyMetricRow`, `PRBadge`. |
| Brand ramp + neutral ramp generation methodology | File 2 | **Adopt process**, not Microsoft's actual colors. |
| Light/dark theme parity shown per-control | File 2 | **Adopt as a QA practice** once Setline components exist. |
| Mobile single-column, appbar+body, calendar strip | File 3 | **Adopt IA**, not its visuals. |
| Absolute/percentage positioning for layout | File 3 | **Reject** — use Flexbox/auto-layout equivalents. |
| Near-black (not pure `#000000`) text/neutral anchor | Files 1, 3 & 4 independently | **Adopt** — 3-for-3 cross-file convention. |
| Indigo/violet accent (`#6979f8`) | File 4 | **Adopt as starting point** for primary accent, pending ramp-generation + contrast pass (§5, §8). |
| Circular Std / any file's specific typeface | Files 1, 3 & 4 use Inter / Circular Std / SF Pro respectively | Decide separately (§7). Inter remains the practical cross-platform (web + Android + iOS) choice; Circular Std and SF Pro are not. |
| Pink/black, Microsoft blue, "SnowUI"/"Realti" branding | Files 1–3 | **Reject entirely** — none of it becomes Setline's identity. |

## 7. Font licensing note

- **Inter** (File 1): SIL Open Font License — safe to use/ship on web and
  mobile.
- **Circular Std** (File 3): a commercial font (Lineto) — **not** safe to
  bundle/ship without a license. If Setline wants a geometric-sans feel
  similar to Circular Std, use a comparable open-licensed alternative
  (e.g., system fonts, or an open geometric sans) rather than embedding
  Circular Std files.
- **SF Pro** (File 4): Apple's system font — free to reference on iOS
  (ships with the OS) but not licensed for arbitrary redistribution on
  web/Android; Inter remains the practical single cross-platform choice.
- Fluent's default web font (Segoe UI / system-ui stack) is effectively
  "use the OS font," which is a safe, zero-licensing-risk default worth
  considering for Setline too.

## 8. What's next

See `docs/design/setline-design-system.md` for the proposed Setline token
direction synthesized from this audit, and
`docs/design/figma-to-code-map.md` for the component-to-implementation
mapping. Both are proposals pending your approval before any application UI
is built.
