# Setframe Definition of Done

A story is done when a person could use the thing, on the device they actually
hold, without being surprised. Passing tests is necessary and not sufficient.

## Functional

- The workflow completes end to end, not just the happy path.
- State is derived from data wherever it can be, not stored as a presentation
  flag that can drift.
- Today's customisation never writes back to the program template.
- Nothing the user typed is lost by a state change.

## Responsive

- Built and checked at **390px first**. That is the product; 1440px is where
  it happens to be developed.
- No horizontal page scrolling. Measure it — `scrollWidth - clientWidth` — do
  not eyeball it. This has shipped twice.
- Nothing clipped, nothing hidden behind sticky navigation or Safari chrome.
- Desktop behaviour stays deliberate rather than incidental.

## Cross-platform

- Web and native reach the same outcome. Presentation may be platform-native;
  the state model, completion logic and information hierarchy may not diverge.
- Shared decisions live in `packages/domain`, so both renderers cannot drift.
- Compare the two side by side before calling it done.

## UX

- The most important thing on the screen looks the most important.
- Interaction cost is justified: every tap carries data or a decision, not
  ceremony.
- Completed states are materially different from active ones, not the same
  layout tinted green.
- Copy names what the user controls, in the user's words.

## Accessibility

- State is never carried by colour alone.
- Every control has an accessible name; expanded/collapsed state is exposed.
- Touch targets ≥44px.
- Focus order survives controls being conditionally removed.
- Reduced motion is honoured — the movement goes, the meaning stays.

## Async behaviour

- Loading, saving, failure and retry are all designed, not just handled.
- One loading state per screen. Sections that each decide their own readiness
  race, and the user sees a finished panel above a skeleton.
- A confident wrong answer while loading is worse than showing nothing.
- Optimistic updates resolve visibly, and a failure is recoverable with the
  entered data intact.

## Review

- Run the UX reviewer over the affected journey:
  `npm run ux:review --workspace=@setframe/web`.
- Open the screenshots. A finding is only real if you can see it.
- Suspect your own selector before the product — see the review skill.

## Scope

- Fix what the story asks for. Report what it does not.
- A defect found while working on something else becomes a story, not a
  drive-by edit inside an unrelated diff.
