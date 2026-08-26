# Story 50 — Rebuild Training Frequency and Weekly Volume Visualizations

## User Story
As a user reviewing my training, I want to understand how often I am training and how workload is changing over time so that I can see consistency and workload patterns rather than isolated totals.

## Screenshot / Gym-Test Evidence
The current cards still look like sparse static reporting:
- only a couple of bars sit at the end of a 12-week area,
- the X axis does not communicate the periods clearly,
- `Jun–Aug` is not an interactive time-range model,
- the current green bar is not self-explanatory,
- there is little useful selected-value detail,
- the user cannot meaningfully explore the history.

# Part A — Training Frequency

## Metric semantics
Define this before charting:

**Training session** = completed scheduled/ad hoc workout session according to Setframe's existing metric rules.

Additional Activity must not silently inflate this metric.

## Range behavior
- **Week:** daily session count.
- **Month:** daily or weekly marks based on legibility; document choice.
- **3M / 6M / Y:** weekly session counts.
- **All:** weekly or monthly aggregation based on history length.

## Selected detail
Selecting a mark updates a stable detail area:

**Aug 18–24**  
**2 workouts**

If reliable program data exists, optional secondary context can show:
- planned sessions,
- completed sessions,
- rest days.

Do not show these if semantics are not trustworthy.

## Comparison
Useful example:

`2 sessions this week`  
`Previous week: 3`  
`↓ 1`

Do not show unexplained averages.

# Part B — Training Volume

## Metric definition
Explicitly document the formula.

For strength work, likely:
`completed weight × completed reps`

Exclude:
- unsaved sets,
- duration/distance-only representations,
- activities for which weight × reps is meaningless.

Never let walking/cycling create misleading `0 lb volume` records.

## Range behavior
- **Week:** daily volume.
- **Month+:** weekly total volume.
- **All:** aggregate intentionally for readability.

## Selected detail
Example:

**Aug 18–24**  
**12,420 lb total volume**

Optionally:
- contributing sessions,
- comparison with previous equivalent period.

## Axis
Frequency and volume bar charts normally use zero baselines.

Use human-friendly labels such as `10k`, `20k` if full labels do not fit.

## Acceptance Criteria
- [ ] Both charts use the universal range selector.
- [ ] Sessions chart uses period-appropriate bucketing.
- [ ] Volume chart uses period-appropriate bucketing.
- [ ] X axis communicates actual dates/periods.
- [ ] Selecting a mark reveals exact period + value.
- [ ] Current-period styling is explained and not color-only.
- [ ] Previous-period comparisons are correct where displayed.
- [ ] Week-start semantics match all of Progress.
- [ ] Session counts exclude Additional Activity by default.
- [ ] Volume excludes representations where weight × reps is meaningless.
- [ ] Missing periods are zero only when zero is semantically true.
- [ ] Partial current week is clearly communicated as partial.
- [ ] Mobile marks have forgiving touch targets.
- [ ] Accessibility summary communicates current/selected/trend values.
- [ ] No horizontal overflow.

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

Do not treat every metric as the same chart.

Body Weight is a measurement time series.  
Sessions is a count.  
Volume is an additive workload.

They should share interaction grammar, not identical visual encoding.

### Partial periods
If today is Tuesday, the current week's bar is incomplete.

Use copy such as:
`Current week · 2 so far`

Do not present it as directly comparable to a finished prior week without context.

### Realistic fixture requirement
Seed at least 12 weeks of realistic data for QA.

A screenshot with only two non-zero bars is not sufficient evidence that the experience works.

### Completion evidence
Provide:
- W/M/3M/6M/Y screenshots,
- selected bar state,
- partial-current-week state,
- sparse-data state,
- mobile interaction recording.
