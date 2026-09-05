# ADR 0013: The Day View, and the Shape of the Tab Bar

Status: Accepted. Date: 2026-09-03.
Amends: ADR 0009 (which set the current four tabs).

## Context

Today was specified in `github-copilot-fitness-app-master-prompt.md`
§"Today screen" as a **list of eleven things to show** — date, planned
workout, CTA, weight, BP, macros, steps, active calories, exercise
minutes, rings, sync state. That is an inventory, not a hierarchy, and
the screen rendered it faithfully: fourteen cards of near-equal weight
with no answer to "what is this screen for". The product owner's words
were "it seems almost like a bunch of random stuff just thrown onto a
screen."

Two further problems were found while designing the replacement.

**The name did not survive first contact.** "Today" as a *screen* name
means nothing to someone with no context for the app. The same word as a
*date control* explains itself immediately, which is how MyFitnessPal
uses it — its "Today ▾" is a date picker, not a title.

**The screen was doing two jobs that want opposite layouts.** It is a
decision surface ("what do I do now", which wants one dominant action)
and a record of a day ("what happened", which wants scannable parity
across many small facts). Trying to be both is what made the workout card
shout while nine health tiles murmured underneath it.

### The backend was already a day view

`GET /v1/dashboard/today` takes `localDate` as a **required** query
parameter, and all seven of its queries — session, manual entry, activity
summary, nutrition, schedule, override, rest day — are scoped by it
(`apps/api/src/routes/dashboard.ts`). Only the client hardcoded today.
Browsing to an arbitrary date needs no new API surface.

## Decision

**The tab is a place called Log; the date is a control inside it.**

- The tab is renamed **Log** — what lifters already call a training
  record, and what the brand line ("Log the set. Keep the record.")
  already says. Every entry the day holds — weight, activity, journal —
  lives on it, so the name describes the contents.
- The header carries a date control (`Today ▾`, `Sat 30 Aug ▾`) and a
  week strip. Today is the default date, not the only one.
- **Settings moves to an avatar in the top right**, freeing its tab.
- The freed tab becomes **Trends**, and the split is by provenance, not
  by topic — see below.

**Progress and Trends divide on the source-of-truth boundary the
architecture already draws.** Everything in Progress is *derived from
sets the user logged*: it lives in our DB and exists only because they
trained. Everything in Trends is *measured about the user*, is
authoritative from HealthKit per `docs/architecture.md` §5, and is true
whether or not they ever open the app. Stated for humans: **Progress is
what you did; Trends is what your body is doing.** Body weight moves to
Trends — it is measured, not performed, and it already coexists with a
HealthKit value under source precedence.

> **Amended 2026-09-05: body weight and intensity live on Progress.**
>
> The provenance rule is a good rule and it produced a bad screen. Weight
> is the number people opened Progress to see, and on Trends it was reduced
> to a summary card next to resting heart rate — a worse view of the same
> number the fuller chart already gave. Time in heart-rate zones landed in
> Trends for the same reason and felt equally wrong: what it answers is
> *how hard was the work*, which is a question about training.
>
> Both now sit on Progress, where they read against training volume — the
> same weeks, one chart saying how much work there was and the other how
> hard it was. Body fat stays on Trends; it has no second home.
>
> The provenance boundary still governs **where data comes from and who owns
> it**. It turned out to be the wrong rule for **which screen a chart
> belongs on**, because a reader asks "what is this telling me about my
> training", not "where was this measured".

**Past dates are read-only, except rest.** A past day shows what
happened; the single mutable thing is whether the day counted as rest,
which `POST`/`DELETE /v1/rest-days/:localDate` already supports for any
date. This keeps ADR 0005's append-mostly fact model intact.

## Consequences

- ADR 0009's principle is unchanged and is what justifies this: *a tab is
  a place.* Today was not a place, it was a bulletin board. Log is a
  place — one day, browsable.
- No new API surface for the date strip. The client passes a different
  `localDate`.
- Full back-fill was **rejected** for now. Logging a workout onto a past
  date is not just an insert: PR flags (`isPrWeight`, `isPrReps`) are
  computed server-side on write against the sets existing at that moment,
  so a back-dated heavy set can invalidate a PR already awarded to a
  later session. That needs a recompute pass, and is deliberately out of
  scope.
- `text.disabled` and `status.error` both fail WCAG AA as text and are
  used as ordinary text in 43 shipped places. The new screens do not
  inherit that; see story 83.

## Alternatives considered

**Keep the name Today and add the date control.** Rejected, but narrowly:
the control alone probably does fix the comprehension problem, since the
word stops being a title. It was rejected because the tab would then be
named for a date while containing weight, activity and journal entries —
the name would describe one of its rows rather than the place.

**Name the metrics tab Health.** Rejected by the product owner, who
wanted something that reads as insight rather than storage. *Readiness*
and *Recovery* were rejected in turn because both imply a computed score;
we compute none, and the master prompt rules out an AI coach for MVP.
