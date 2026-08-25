# Story 49 — Rebuild Body Weight as the Reference-Quality Setframe Chart

## User Story
As a user logging morning weight, I want a clear, interactive weight history that helps me distinguish daily fluctuations from the direction of my weight over time so that logging gives me useful feedback rather than another list of numbers.

## Why This Is the Reference Chart
Weight is ideal for proving the new Progress architecture:
- familiar unit,
- noisy day-to-day behavior,
- meaningful time-range changes,
- dynamic Y-scale requirement,
- individual points matter,
- smoothing becomes useful with enough history.

This chart establishes the visual and interaction quality bar for later Setframe charts.

## Information Hierarchy

### Header
**Body weight**

### Range selector
`W  M  3M  6M  Y  All`

### Selected-range summary
Example:

**Aug 19–25**

Start: **166.8 lb**  
Current: **168.6 lb · Aug 25**  
Change: **+1.8 lb**

Start/current/change must be derived from the selected range — not from some unrelated “current week.”

### Plot
Primary series:
- real logged measurements.

Once enough data exists:
- add a clearly differentiated smoothed/trend line.

Do not imply a raw connecting line is a physiological trend unless that is its actual meaning.

### Point selection
Tap/scrub updates a stable detail area:

**166.8 lb**  
**Aug 22**

The active point is visibly selected.

### Useful deterministic context
Once supported by enough data:
- `7-day average: 167.9 lb`
- `+0.4 lb vs previous 7 days`

Do not judge gain/loss as good or bad without explicit goal context.

## Sparse Data
With only one or two entries:
- show real points,
- explain that more data is needed for smoothing,
- do not manufacture trend.

## Axis
Use a dynamic Y range with human-friendly padding.

For values 166.8–168.6, a range roughly around 165–170 can be reasonable. A 0–200 axis is not useful for seeing weight change.

## Acceptance Criteria
- [ ] Body Weight uses the shared range selector.
- [ ] Each range materially changes displayed data/aggregation.
- [ ] Start/current/change is derived from selected range.
- [ ] Real points remain inspectable.
- [ ] Tap exposes exact date + weight.
- [ ] Scrub works where supported.
- [ ] Dynamic Y axis makes real variation legible without exaggeration.
- [ ] Trend line has an explicit minimum-data threshold.
- [ ] Raw measurements and derived trend are visually/accessibly distinct.
- [ ] Week boundaries use global Setframe semantics.
- [ ] Missing days are missing, never treated as zero.
- [ ] User units are respected.
- [ ] Narrow mobile layout has no clipping/overflow.
- [ ] Non-visual accessibility summary exists.
- [ ] Figma reviewer approves this as the pattern other charts should follow.

## Product-wide Definition of Done

- Mobile-first responsive web.
- Matching user-facing behavior in the mobile application.
- Mobile web and mobile app reviewed side-by-side.
- GitHub reviewer validates implementation/code quality.
- Figma reviewer validates design parity.
- Loading, empty, success, disabled, degraded-data, and error states handled where applicable.
- Keyboard, focus, touch-target, VoiceOver/screen-reader, reduced-motion, and color-contrast behavior considered.
- Behavioral tests cover important user-visible outcomes.
- Existing historical data and metric semantics are preserved unless explicitly changed.
- Typecheck, lint, relevant tests, and production build pass.
- No unrelated scope creep.
- Validate narrow mobile widths and desktop/full-width layouts.
- Explicitly test horizontal overflow and sticky-navigation regressions on mobile Safari.


## Copilot / Claude Steering Document

Do not rush this implementation. Other Progress charts will inherit this interaction grammar.

Document exact calculations:
- selected range,
- first/last measurement,
- change,
- seven-day average,
- smoothing formula if used.

Reference principles:
- MyFitnessPal: Start / Current / Change paired with a plot.
- Apple Health: explicit timeframe, direct point selection, selected date/value, sensible scale.

Do not copy branding or layouts pixel-for-pixel.

“Fun and smart” should come from responsiveness, smooth selection, clear transitions, useful summaries, and meaningful milestones — not gratuitous decoration.

Provide seeded screenshots for every range and a short mobile interaction recording.
