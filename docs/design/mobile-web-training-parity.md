# Training — mobile vs web parity audit

Date: 2026-08-25. Method: web rendered at a 390 × 844 viewport and
screenshotted, mobile screenshotted on an iPhone 17 Pro simulator, the two
compared side by side against the source of both screens.

## Why this audit exists

Mobile's Training screen was rebuilt from web's source and reported
complete on a green test suite. The product owner's response was "this
looks awful and nothing like our web app." A structural rebuild had been
done — tabs, header, safe area — but the two screens had never actually
been put next to each other, so everything below went unnoticed.

## What made the comparison impossible before

Two blockers, both now removed, both worth recording because they are the
reason the divergence survived:

1. **Web's authenticated routes sit behind Clerk's `<SignedIn>` gate**, and
   `dev:mock` only replaces the API, not auth. Reaching `/training` meant
   signing in through a real 2FA email code. Now: `VITE_DESIGN_REVIEW=true`
   with mocks renders the app unauthenticated (`env.bypassAuthForDesignReview`,
   guarded on dev + mocks + explicit opt-in).
2. **MSW mocked `/programs/:programId/workouts`**, but Story 25 renamed
   that resource to `day-types` and added `schedule-slots`. Nothing called
   the old path, so Training sat on its loading skeleton forever under
   `dev:mock` — the screen was literally un-reviewable. Handlers added.

On the mobile side, `EXPO_PUBLIC_DEV_INITIAL_ROUTE` now lands the app on
any screen directly, since the Simulator has no tap primitive.

## Divergences found

| # | Web | Mobile | Kind | Status |
|---|---|---|---|---|
| 1 | "Guided setup" button in the page header, shown once programs exist | Only inside the Programs tab | structure | closed |
| 2 | Workout rows carry an estimated duration (`~50 min`) | Name and chevron only | missing information | closed |
| 3 | "New workout" carries a `+` icon | Text only | cosmetic | open |
| 4 | Detail card summarises `2 exercises · approximately 50 min` | Absent | missing information | closed |
| 5 | Detail card has a `⋮` menu (remove from program / delete) | Absent | missing capability | closed |
| 6 | Each exercise row has `↑ ↓` reorder controls | Absent | ADR 0009 said web-only | closed |
| 7 | Each exercise row has a `⋮` menu | Absent | **misdiagnosed** | not a gap |

### 5 — workout actions (closed)

Web's two items are genuinely different, and mobile had neither: Story 25
made program↔workout membership explicit, so *Remove from this program*
leaves the workout intact for every other program using it, while *Delete
permanently* destroys it. Mobile now offers both through a native action
sheet — the platform's equivalent of web's dropdown, and already the
pattern this app uses for destructive per-item actions. Both confirm, and
the delete confirmation says outright that it is not scoped to this
program, because the two options sit next to each other and that
difference is the whole point.

### 6 — reordering (closed, and ADR 0009 corrected)

ADR 0009 recorded this as web-only because "the endpoint exists but
drag-reorder needs an interaction this screen does not yet have." That
reason was wrong: **web does not use drag either.** It moves one position
at a time with arrow buttons and POSTs the resulting order. Mobile now
does the same, with the end arrows disabled rather than omitted so a
screen reader still announces them. ADR 0009 has been amended rather than
left carrying a false claim.

### 7 — exercise row menu (not a gap)

Recorded as "missing capability" on the strength of web having a `⋮` menu.
That was wrong. Web's menu holds *Edit* and *Delete*; on mobile, tapping
an exercise row opens `ExerciseEditSheet`, which edits the prescription
**and already carries its own destructive Remove**. Both actions are
reachable in the same number of taps. Adding a second menu offering the
same two things would be a redundant path, not new capability, so it was
deliberately not built.

Worth noting as a method failure rather than just a wrong row: the gap was
recorded by comparing *controls* rather than *reachable actions*. Two
platforms can offer identical capability through different affordances,
and a parity audit that only diffs widgets will keep manufacturing
findings like this one.

## Deliberate differences, not defects

- **Mobile shows `Editing <program name>`** above the workout list. Web
  names the program elsewhere in its wider layout; mobile's header does
  not, and "View" selects a program without activating it, so without this
  the user cannot tell which program their edits land on. Keep.
- **Mobile uses `Sheet` where web uses a centred modal.** Platform idiom.

## Not a product defect — mock data

The web screenshot renders exercise names as raw UUIDs. That is this
audit's own fixture being wrong (`mockDayTypeExercises` does not match the
shape `ProgramEditorPage` reads), not a bug in the screen. Worth fixing so
the next comparison is clean, but it is not a finding.

## Screenshots

- `/tmp/parity/web-training.png` — web at 390px
- `/tmp/setframe-shots/training-rebuilt.png` — mobile, Workouts tab
- `/tmp/setframe-shots/programs-tab.png` — mobile, Programs tab
