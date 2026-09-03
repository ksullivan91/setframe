# Stories 75–83 — The Log dashboard

**Origin:** a product-owner design session on 2026-09-03, not a review.
Today was described as "a bunch of random stuff just thrown onto a
screen", and the word "Today" was found not to mean anything to a user
with no context for the app.

**Design record:** `docs/design/log-dashboard.md` — read it first. It
carries the reasoning and the traps; the stories carry the work.
**Decisions:** ADR 0013 (day view + tab shape), ADR 0014 (auto-close).
**Figma:** `Dashboard v3 — bolder` (`388:357`), playable — five entry
points in the prototype flow dropdown.

## Order

75 and 76 are the shell and must land first. 77–82 are largely
independent of each other. 83 is a prerequisite for nothing but should
not be deferred indefinitely — it is a shipped accessibility defect.

```
75 navigation shell  ──┬── 77 Trends tab
                       ├── 78 training states ── 79 session shapes
76 the day view      ──┼── 80 log rows + optimistic saving
                       ├── 81 auto-close abandoned sessions
                       └── 82 health strip states
83 palette (independent, and overdue)
```

## Standards for this batch

- **The frames are the spec for what; the design record is the spec for
  why.** Where they disagree, the design record wins and the frame is
  wrong — say so rather than building the frame.
- **Do not port measured values off the frames without checking the
  spacing scale.** The frames were re-bound to `Setline/Spacing` on
  2026-09-03; anything off 4/8/12/16/24/32/40/48 is drift, not intent.
- **No new use of `text.disabled` or `status.error` as text.** Both fail
  AA. Story 83 fixes the existing ones.
- Every mutation keeps `onError` — the source-level guard in
  `src/__tests__/mutationFeedback.test.ts` enforces it and exists
  because 14 mutations once failed silently.
- Mobile only. Web is a landing page.
