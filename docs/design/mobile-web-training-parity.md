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

| # | Web | Mobile | Kind |
|---|---|---|---|
| 1 | "Guided setup" button in the page header, shown once programs exist | Only inside the Programs tab | structure |
| 2 | Workout rows carry an estimated duration (`~50 min`) | Name and chevron only | missing information |
| 3 | "New workout" carries a `+` icon | Text only | cosmetic |
| 4 | Detail card summarises `2 exercises · approximately 50 min` | Absent | missing information |
| 5 | Detail card has a `⋮` menu (rename / remove workout) | Absent | missing capability |
| 6 | Each exercise row has `↑ ↓` reorder controls | Absent | known gap, ADR 0009 |
| 7 | Each exercise row has a `⋮` menu | Absent | missing capability |

Items 5 and 7 are the significant ones: they are not styling, they are
actions a user can perform on web and simply cannot on mobile.

Item 6 is already recorded in ADR 0009 as deliberately web-only — the
reorder endpoint exists but no drag interaction was built. It stays
deferred here rather than being silently reopened.

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
