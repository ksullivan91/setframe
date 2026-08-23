# Setframe Product Backlog

Work items live in this folder. Anything in the root is open; anything in
`completed/` has shipped to production.

Each batch of stories arrives with its own README describing the review it
came from and the delivery standards that apply. Those READMEs are archived
alongside their stories, named `README-{range}-{review}.md`.

## Open

- `setframe-guided-setup-stories/` — stories 18–19, a batch converting
  novice-user beta feedback about the Guided Setup wizard into scoped
  stories (workout create/rename/remove, optional prescription values).
  See its own `README.md` for the review context and suggested order.
  (Stories 17 and 20 already shipped — see `completed/`.)
- `21-schedule-rest-days-in-training.md` — extends the shipped rest day
  feature so rest can be planned ahead or corrected after the fact from the
  Training schedule table, instead of only being declared on the day itself.
  (Renumbered from 17 to make room for the guided-setup batch above.)
- `WAIT-automated-visual-and-e2e-testing.md` — deferred by request. Filed so the
  gap is tracked, deliberately not started.
- `WAIT-figma-accentsubtle-token-fix.md` — deferred by request. Fixes
  `Semantic/Action/AccentSubtle` and other `Semantic/*` alias mismatches
  found during the 2026-08-23 color-token reconciliation (see
  `docs/design/setframe-figma-style-guide.md` §23).

## Shipped

- `completed/README-01-07-gym-ux-review.md` — stories 01–07.
- `completed/README-08-10-active-workout-ux-review.md` — stories 08–10.
- `completed/README-11-16-progress-experience-review.md` — stories 11–16.
