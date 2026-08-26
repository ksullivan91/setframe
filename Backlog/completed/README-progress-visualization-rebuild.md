# Progress visualization rebuild — 2026-08-25

*(Deliberately unnumbered. This came from direct feedback rather than a
numbered review pack, and an earlier draft of this file was filed as
"52-54", which collides with the real stories 52-54 in the mobile parity
audit.)*

## Where this came from

Direct feedback after stories 46–51 shipped:

> These charts really aren't much better and I don't think you fully
> understood the spike or the readme. These charts are not rich. They are
> barely better than what we had before.

Followed by an explicit widening of the constraints: *"don't be afraid to
use libraries or packages that can assist with building out truly rich
graphs"*, and *"feel free to totally reinvent this page knowing where we
want to take this progress page with not only the data we have but the
insights and coaching we eventually want to build"*.

## The diagnosis

The 46–51 pack listed, as a problem to fix, that "the new charts largely
retained the old information architecture." Stories 48–50 did it again:
real machinery — calendar windows, per-range bucketing, scrub, honest
partial periods — hung on the same three cards. Three single scalars over
time with a range picker added. That answers "what is changing"; it cannot
answer "what caused it" when no chart shares an axis with any other.

Full diagnosis, the data inventory behind it, and the principles applied
are in `docs/design/progress-visualization-direction.md`.

## What shipped

**ADR 0010 — d3 as headless maths.** ADR 0008 evaluated three charting
options and all three were *component* libraries; it rejected them
correctly, since a React Native renderer cannot run on web and canvas/Skia
regresses the accessibility baseline. It never examined headless maths.
`d3-scale`/`shape`/`array`/`time` touch no DOM — they return numbers and
SVG path strings that DOM `<path d>` and `react-native-svg` `<Path d>`
consume identically. They are a dependency of `packages/domain` only;
neither app imports d3 and neither renderer changed.

**Three new views, both platforms:**

- **Strength** — per-lift estimated 1RM as small multiples over a shared
  time axis, with the 18 already-computed PR flags finally rendered as an
  annotation layer.
- **Plan vs actual** — `plannedCount` derived from the active program
  version's schedule, replacing a `null` hardcoded since the route was
  written.
- **Training composition** — weekly volume by movement group, plus a
  migration backfilling `movement_pattern` that took ungrouped volume in
  production from 15,725 lb to 0.

**Mobile tooltips rebuilt** as anchored popovers over a new `PopoverHost`.
The bottom-sheet version covered the whole app and took two taps to switch —
the defect web fixed in Story 46, which the mobile file had recorded as an
accepted consequence of modality.

## What this batch is worth remembering for

**Rendering found what reasoning did not.** Two designs changed only after
looking at pixels: the composition chart's grey "Other" band was one of the
largest things on screen, and an absolute minimum-span floor flattened light
lifts while failing to damp heavy ones. Neither was visible in a green test
suite.

**Mutation testing caught four vacuous tests, three of them mine.** A
sum-invariant test where every fixture was `completed: true`; a
version-selection test where both versions produced the same answer; and an
"omits unplanned weeks" test duplicated across two layers so mutating either
copy changed nothing. Every behavioural claim in this batch was verified by
reintroducing the bug.

**Two test-harness defects worth not repeating.** `vi.clearAllMocks()`
leaves queued `mockReturnValueOnce` values in place, so a test that queues
more mocks than its route consumes leaks the rest into the next test.
And `findAll` in react-test-renderer returns both the component instance and
its host node, so slice-by-index assertions silently compare interleaved
data unless filtered to hosts.

## Follow-ups

- `Backlog/57-movement-pattern-coverage.md` — the backfill is done; exposing
  `movement_pattern` for editing is not, so coverage decays as the library
  grows.
- View 4 (body-weight context: intake, resting HR, mood) needs health and
  nutrition sync live before it can be built or verified.
- The observation/coaching contract sketched in the direction document is
  designed for, not built.
