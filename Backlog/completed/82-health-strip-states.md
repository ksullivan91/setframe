# Story 82 — The health strip, including the state we cannot detect

**Status:** Shipped 2026-09-03. Depends on 75.
**Design:** `docs/design/log-dashboard.md` §5.
**Figma:** `Spec/Health states`.

## User story

As someone who has not connected Apple Health, I want the offer to read
as an offer, so that my dashboard does not look broken on day one.

## What to build

Four states, from `useHealthConnection`'s existing resolution:

| State | Treatment |
|---|---|
| `connected` | four-metric strip → Trends |
| `not_connected` | an offer: *"Connect Apple Health — steps, sleep and heart rate fill in on their own"* |
| `no_data` | *"No health data yet — if you meant to share it, check Setframe in the Health app"* + deep link |
| `unavailable` | render nothing at all |

## The constraint that shapes this

**"Declined" is not a state we can detect.** iOS's
`getRequestStatusForAuthorization` returns only `not_asked` or `asked` —
never granted or denied. A refusal and a granted-but-empty day are
indistinguishable, and `useHealthConnection` already folds both into
`no_data` (there is a comment saying so).

So the `no_data` copy must be true in both cases. **Any wording that
says "you declined" is a guess that is wrong half the time.**

## Acceptance

- `unavailable` renders no section — an offer that cannot be accepted is
  worse than silence.
- No copy anywhere asserts the user denied permission.
- The `no_data` deep link opens the Health app's Setframe sources page.
