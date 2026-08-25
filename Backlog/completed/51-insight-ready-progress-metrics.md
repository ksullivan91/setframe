# Story 51 — Create an Insight-Ready Progress Metric Architecture

## User Story
As a user who consistently logs data, I want Setframe to surface concise, meaningful observations about my progress so that logging feels rewarding now and can evolve into personalized AI coaching later.

## Product Vision
Charts are necessary, but charts are not the end state.

Progress should increasingly answer:
- What changed?
- Compared with what?
- Is there a pattern?
- What evidence supports it?
- Is there enough data to say anything?
- Eventually: what should I consider next?

Before OpenAI generates coaching, Setframe needs a deterministic analytics layer that produces trustworthy facts.

## Architecture Goal
Create an insight-ready metric contract.

Illustrative shape:

```ts
type ProgressInsightInput = {
  metric: 'body_weight' | 'training_frequency' | 'training_volume' | string;
  selectedRange: ProgressRange;
  currentPeriod: {
    start: string;
    end: string;
    value?: number;
    count?: number;
  };
  previousPeriod?: {
    start: string;
    end: string;
    value?: number;
    count?: number;
  };
  change?: {
    absolute?: number;
    percent?: number;
  };
  trend?: {
    direction: 'up' | 'down' | 'flat' | 'insufficient_data';
    slope?: number;
    confidence?: 'low' | 'medium' | 'high';
  };
  sampleCount: number;
  dataQuality: string[];
};
```

Exact schema may differ. The principle is non-negotiable:

**AI should receive calculated evidence, not infer everything from raw chart pixels or loosely structured history.**

## Initial deterministic insights

### Body Weight
`Your 7-day average is 167.9 lb, 0.4 lb above the previous 7 days.`

### Training Frequency
`You've completed 2 sessions this week, compared with 3 last week.`

### Training Volume
`Training volume is 8% higher than the previous four-week average.`

Only surface these when sample size and semantics support them.

## Future OpenAI Layer
A future intelligence service can combine:
- normalized metric summaries,
- recent workouts,
- historical comparison windows,
- explicit user goals/preferences,
- Apple Health context where authorized,
- Additional Activity and recovery context.

Possible future outputs:
- plateau/pattern detection,
- adherence changes,
- workload changes,
- recovery/performance relationships,
- coaching suggestions.

This story does **not** add AI coaching yet.

## UX Intent
Create a subtle location for useful factual observations.

No generic motivational filler.

No insight is better than a meaningless insight.

Where useful, an insight should link to its supporting chart and selected period.

Example:
`Volume is up 12% vs last month` → focus Volume with Month selected.

## Acceptance Criteria
- [ ] Shared metric-summary contract exists.
- [ ] Body Weight, Training Frequency, and Volume can produce deterministic summaries.
- [ ] Calculations are unit tested.
- [ ] Previous-period comparisons use equivalent windows.
- [ ] Partial-current-period behavior is explicitly defined.
- [ ] Insufficient data returns an explicit state.
- [ ] Data-quality flags can represent missing/sparse data.
- [ ] UI can render factual insight copy without any AI service.
- [ ] Insight can deep-link/focus supporting visualization where implemented.
- [ ] No medical/prescriptive inference is added.
- [ ] Architecture docs describe future OpenAI consumption without coupling chart components directly to prompts.

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

### Build facts first
Do not add OpenAI calls in this story.

The immediate goal is trustworthy analytics infrastructure.

### Comparison rigor
Examples:
- 7 days → previous 7 days.
- Month → previous equivalent month/window.
- Partial current week → compare equal elapsed days in prior week, or explicitly label comparison as partial.

Document the chosen behavior.

### Avoid insight theater
Do not add cards that merely restate:
`Your current weight is 168.6 lb.`

An insight should add comparison, pattern, context, or data-quality information.

### Future-proofing
Keep prompt construction outside chart components.

A future service should consume normalized summaries, not UI state.

### Completion evidence
Provide examples of:
- useful upward/downward change,
- flat/neutral trend,
- sparse data,
- partial period,
- no insight available.
