# Setframe Autonomous UX Review System

Absolutely. I’d turn this into a **first-class quality system in the Setframe repo**, not just a few Playwright tests.

The key idea is that we want three distinct things working together:

1. **Deterministic regression tests** — “does the workflow still work?”
2. **Autonomous UX review** — “is this workflow understandable, efficient, responsive, and pleasant?”
3. **Visual/product review artifacts** — screenshots, findings, severity, before/after evidence

Playwright is unusually well-suited for this now because its CLI is explicitly designed for coding agents, and Playwright also ships planner/generator/healer agents that can explore apps, produce human-readable plans, generate tests, and repair broken tests.

Reference:
- https://playwright.dev/docs/getting-started-cli

---

## 1. Repository structure I’d establish

I’d recommend something close to this:

```text
setframe/
├── .claude/
│   └── skills/
│       └── setframe-ux-review/
│           ├── SKILL.md
│           ├── heuristics.md
│           ├── personas.md
│           └── severity-rubric.md
│
├── docs/
│   └── ux/
│       ├── PRINCIPLES.md
│       ├── PERSONAS.md
│       ├── WORKFLOWS.md
│       └── DEFINITION_OF_DONE.md
│
├── ux-tests/
│   ├── scenarios/
│   │   ├── onboarding.md
│   │   ├── program-setup.md
│   │   ├── workout-session.md
│   │   ├── additional-activity.md
│   │   ├── progress-review.md
│   │   └── error-recovery.md
│   │
│   ├── fixtures/
│   │   ├── novice-user.ts
│   │   ├── established-user.ts
│   │   └── populated-history.ts
│   │
│   ├── reports/
│   │   └── .gitkeep
│   │
│   └── README.md
│
├── tests/
│   ├── ux/
│   ├── regression/
│   └── seed.spec.ts
│
├── playwright.config.ts
└── package.json
```

I would deliberately keep **UX scenarios separate from executable tests**.

A scenario is product intent:

```text
User needs to add an unexpected exercise during an active workout.
```

The Playwright test is an implementation artifact proving it works.

That separation matters because if the UI changes, you shouldn't lose the original reason the test exists.

---

## 2. Install both Playwright Test and the agent tooling

For Setframe I would use regular Playwright tests **plus** Playwright CLI.

```bash
npm install -D @playwright/test @playwright/cli
npx playwright install
npx playwright-cli install --skills
```

Playwright's CLI gives Claude/Copilot browser interaction through concise commands and accessibility snapshots. It supports screenshots, network inspection, persistent sessions, different browsers, arbitrary Playwright code, and tracing.

Reference:
- https://playwright.dev/docs/getting-started-cli

Then initialize Playwright's own agents for Claude:

```bash
npx playwright init-agents --loop=claude
```

Playwright currently exposes three useful roles:

- **Planner** — explores the product and produces a Markdown test plan
- **Generator** — turns plans into executable Playwright tests
- **Healer** — investigates failing tests and attempts repairs

Reference:
- https://playwright.dev/docs/test-agents

I would use those for functional coverage, but create our own **Setframe UX Reviewer** on top of them.

---

## 3. The Setframe UX-review skill

This is where most of the value comes from.

I would create:

```text
.claude/skills/setframe-ux-review/SKILL.md
```

with something like this:

```markdown
# Setframe Autonomous UX Reviewer

You are reviewing Setframe as a product user before reviewing it as a developer.

Your responsibility is NOT merely to verify that controls work.

Your responsibility is to determine whether a user can successfully,
efficiently, confidently, and pleasantly accomplish the intended task.

## Core rule

DO NOT inspect implementation code before completing the first usability pass.

First experience the product exactly as a user would.

Only inspect the implementation after documenting UX findings.

---

# Review workflow

For every assigned workflow:

1. Launch the application using Playwright.
2. Use the assigned viewport and persona.
3. Complete the workflow without source-code knowledge.
4. Capture evidence throughout the workflow.
5. Document UX problems.
6. Categorize severity.
7. Only then inspect the implementation.
8. Recommend the smallest coherent fix that addresses the underlying cause.
9. If authorized, implement the fix.
10. Repeat the exact same workflow.
11. Capture matching after screenshots.
12. Verify no neighboring workflows regressed.

---

# Evaluate all workflows for

## Task clarity
- Is the next action obvious?
- Does the interface explain what the user is doing?
- Are concepts differentiated clearly?
- Does terminology match the user's mental model?

## Visual hierarchy
- Is there one clear primary action?
- Are multiple buttons competing for attention?
- Does destructive styling appear only for destructive behavior?
- Are completion states visually meaningful?

## Interaction cost
- Count taps/clicks required.
- Identify unnecessary scrolling.
- Identify repeated data entry.
- Identify unnecessary confirmation steps.
- Identify places where data could be inherited or intelligently defaulted.

## Feedback
- Every async action must visibly respond.
- Optimistic updates should be used where safe.
- Loading states must not cause layout instability.
- Success/error feedback must be contextual.

## Error recovery
- Can users undo mistakes?
- Can users edit previously entered information?
- Can users recover without navigating to another feature?
- Do destructive actions require appropriate confirmation?

## Mobile ergonomics
- No horizontal scrolling.
- Interactive targets meet touch-size expectations.
- Keyboard must not obscure required controls.
- Sticky navigation must remain usable.
- Inputs must not trigger unwanted viewport zoom.
- Bottom sheets/modals must stay within viewport bounds.
- Important actions must be reachable without excessive scrolling.

## Accessibility
- Semantic labels exist.
- Keyboard interaction works.
- Focus moves predictably.
- Focus is restored after dialogs.
- Color is never the only state indicator.
- Dynamic updates are communicated appropriately.

## Data integrity
- UI state must match persisted state.
- Optimistic updates must roll back on failure.
- Duplicate actions must not create duplicate records.
- Analytics/progress data must reflect corrected historical data.

---

# Setframe-specific product principle

Data entry is a cost paid by the user.

Every interaction should either:

1. reduce the cost of entering data,
2. increase confidence that the data is correct, or
3. make the resulting insight rewarding enough to justify the effort.

If an interaction adds friction without advancing one of those three goals,
flag it.

---

# Completion states

Setframe should celebrate meaningful progress without becoming childish.

Completed exercises, workouts, streaks, and milestones should feel distinct
from ordinary form states.

Do not reduce completion to a small label added to a busy component.

---

# Review evidence

For every issue record:

- workflow
- persona
- viewport
- screenshot
- observed behavior
- expected user expectation
- severity
- recommendation
- regression risk

Do not change code until the initial review report is complete.
```

That one rule — **don't inspect the implementation until you've used the product** — is extremely important.

Otherwise coding agents tend to explain the UI to themselves from the implementation, which destroys the usability-testing value.

---

## 4. Give it personas

You already discovered how valuable this is from the beta test where “Program → Workout → Exercise” wasn't obvious.

I'd create at least these six.

### Novice Fitness User

```markdown
## Novice Fitness User

Experience:
- Has exercised casually.
- Has never intentionally created a structured training program.
- Does not know fitness programming terminology.

Mental model:
"I want to tell the app what I'm doing today."

Watch closely for:
- confusion between program, workout and exercise
- assumptions that setup screens represent today's workout
- unexplained concepts like RPE, 1RM, working set
- unclear next actions
```

### Experienced Lifter

```markdown
## Experienced Lifter

Experience:
- Understands programming and lifting terminology.
- Logs sets regularly.

Priorities:
- speed
- previous-session context
- low interaction count
- fast correction
- one-handed use between sets

Watch for:
- repeated weight/reps entry
- waiting for API responses
- excessive scrolling
- friction adding/removing sets
```

### Recovery / General Wellness User

Important for the additional-activity work:

```text
Does mobility, walking, cycling, yoga and recovery work.

Does not think every physical activity is a "workout."
```

### Interrupted User

This one would uncover a lot:

```text
User gets a phone call, leaves Safari, returns 15 minutes later,
changes exercises, accidentally edits the wrong set, etc.
```

### Accessibility / Reduced Dexterity User

Not pretending the AI has a disability—just explicitly evaluating:

```text
Large touch targets, low precision, keyboard navigation,
screen-reader semantics, reduced motion.
```

### Data-Motivated User

Extremely important for Setframe:

```text
This user logs because they expect useful insights later.

Evaluate whether Progress provides enough reward to justify continued logging.
```

That final persona should hammer the Progress page repeatedly.

---

## 5. Standard viewport matrix

I wouldn't make Claude test every device on every trivial story.

I'd establish tiers.

### Every story

```text
390 × 844   mobile
1440 × 900  desktop
```

### UX-sensitive stories

```text
375 × 667   small mobile
390 × 844   typical mobile
430 × 932   large mobile
768 × 1024  tablet
1440 × 900  desktop
```

### Release regression

Add:

```text
WebKit
Chromium
Firefox
```

Since you're specifically seeing Safari/iPhone quirks, **WebKit deserves first-class status**.

Playwright supports Chrome, Firefox, WebKit, and Edge.

Reference:
- https://playwright.dev/docs/getting-started-cli

---

## 6. Permanent Setframe workflows

This is where the autonomous system becomes powerful.

Instead of telling Claude what to test every time, we define canonical journeys.

### Workflow A — New user → first workout

```markdown
# New User First Training Program

1. Open Setframe with an account containing no programs.
2. Navigate to Training.
3. Begin Guided Setup.
4. Create:
   - Program: My Training
   - Workout: Upper A
   - Workout: Lower A
5. Add at least 4 exercises to each workout.
6. Include:
   - preloaded exercise
   - custom exercise
   - bodyweight exercise
   - duration-based activity
7. Schedule workouts.
8. Finish setup.
9. Navigate Today.
10. Preview today's workout.
11. Start workout.

Success means:
- user understands Program → Workout → Exercise hierarchy
- no duplicated exercise creation
- no dead ends
- no horizontal overflow
- schedule is understandable
```

### Workflow B — Real gym session

This should mirror your behavior:

```markdown
# Active Strength Workout

1. Start scheduled workout.
2. Log first exercise:
   - change weight across sets
   - repeat same reps
3. Use quick cascade controls.
4. Override one individual set.
5. Add one extra set.
6. Remove one planned set.
7. Add an unexpected exercise.
8. Remove one planned exercise for today only.
9. Correct a mistakenly entered weight.
10. Collapse/expand multiple exercises.
11. Finish workout.
12. Review completed workout.
```

This single workflow would have discovered half the bugs you've reported manually.

### Workflow C — Recovery day

```markdown
1. Complete recovery workout.
2. Add walk.
3. Add another walk later.
4. Add yoga.
5. Add outdoor cycle with minutes + seconds + distance.
6. Edit an activity.
7. Remove an activity.
8. Inspect Today summary.
9. Inspect Progress.
```

### Workflow D — Progress payoff

This one should be brutal.

```markdown
Assume a populated account with 12 weeks of data.

User goal:
"I want to understand whether I'm improving."

Without consulting implementation:
1. Open Progress.
2. Determine:
   - training consistency
   - body-weight direction
   - strength direction
   - strongest improving lift
   - whether volume has increased
   - recent anomalies
3. Change chart time ranges.
4. Inspect individual points.
5. Open exercise history.
6. Return to overview.

Record:
- anything unclear
- unexplained metrics
- charts that require inference
- missing comparisons
- low-value cards
- places where data exists but insight does not
```

That should be mandatory for any significant Progress work.

---

## 7. UX scoring rubric

Give Claude numbers so "looks good" isn't an acceptable conclusion.

Score each workflow from 1–5:

| Dimension | Meaning |
|---|---|
| Task clarity | User knows what to do |
| Efficiency | Few unnecessary actions |
| Feedback | System clearly responds |
| Error recovery | Mistakes are easy to fix |
| Visual hierarchy | Attention is directed correctly |
| Mobile ergonomics | Comfortable one-handed/mobile use |
| Accessibility | Keyboard/semantic/focus quality |
| Delight | Experience provides meaningful positive feedback |
| Data payoff | Entered data produces useful value |

Then establish a gate:

```text
No story may be considered UX-complete if:

- any dimension scores below 3
- Task Clarity < 4
- Mobile Ergonomics < 4 for gym workflows
- Error Recovery < 4 for data-entry workflows
```

For the Progress page:

```text
Data Payoff < 4 = failure.
```

That's intentional.

---

## 8. Severity rubric

I'd use:

**P0 — Blocking**

Cannot complete task, data loss, destructive corruption.

**P1 — Serious**

Major workflow confusion, wrong persisted data, inaccessible primary action, mobile overflow preventing use.

**P2 — Friction**

Task succeeds but unnecessarily difficult, repetitive, or unclear.

**P3 — Polish**

Spacing, animation, secondary hierarchy, minor visual inconsistencies.

And one Setframe-specific category:

**DX — Data Experience**

The product technically presents data but fails to help the user understand it.

That's particularly useful for Progress because otherwise weak graphs can get incorrectly classified as "visual polish."

---

## 9. Screenshot artifacts

Every important UX test should produce:

```text
ux-tests/reports/
└── 2026-08-26-workout-input/
    ├── before/
    │   ├── 01-workout-open.png
    │   ├── 02-bulk-entry.png
    │   └── 03-completed.png
    │
    ├── after/
    │   ├── 01-workout-open.png
    │   ├── 02-bulk-entry.png
    │   └── 03-completed.png
    │
    └── report.md
```

And the report:

```markdown
# Workout Input UX Review

## Result
PASS / NEEDS WORK

## Persona
Experienced lifter

## Viewport
390 × 844 WebKit

## Task
Complete a 5-exercise workout.

## Interaction count
Before: 47
After: 28
Change: -40%

## Findings

### P1 — Bulk-entry action does not persist sets
...

### P2 — Exercise and set hierarchy unclear
...

## Scores

| Area | Before | After |
|---|---:|---:|
| Task clarity | 2 | 4 |
| Efficiency | 2 | 5 |
| Feedback | 2 | 4 |
| Error recovery | 3 | 4 |
| Mobile ergonomics | 3 | 5 |
| Delight | 1 | 4 |

## Remaining concerns
...
```

Now you get measurable before/after UX rather than:

> “Implemented story 62 successfully.”

---

## 10. Add interaction-cost measurement

This is one of the most valuable things we can introduce.

For the workout flow, Claude should count:

- taps
- typing events
- scroll-to-action events
- explicit saves
- modal transitions
- waits

Then we can actually say:

> Logging 3×8 bench went from 13 interactions to 5.

That's a meaningful product improvement.

For Setframe, I'd add a rule:

> Any redesign of an existing workflow must report before/after interaction cost.

---

## 11. Network/API behavior review

Playwright CLI can inspect network traffic, so the reviewer should also detect problems like your set-saving issue.

Reference:
- https://playwright.dev/agent-cli/capabilities

For data-entry workflows:

```text
Flag:

- serialized mutations that unnecessarily block subsequent actions
- duplicate requests
- requests triggered merely by focusing fields
- long mutation latency without optimistic UI
- multiple API requests that could be batched
- stale data after mutation
```

That bridges UX and architecture.

In other words:

> “Saving Set 1 blocks Set 2 for 1.4 seconds”

becomes a UX defect—not merely an implementation detail.

---

## 12. Automated browser console checks

Every workflow should finish with:

```text
Verify:
- no console errors
- no unhandled promise rejections
- no failed API calls
- no React key warnings
- no unexpected horizontal overflow
```

And I'd make horizontal overflow an actual assertion.

Something like:

```ts
expect(
  await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth
  )
).toBe(true);
```

You've had enough mobile horizontal-scroll bugs that this deserves permanent regression coverage.

---

## 13. Mobile keyboard regression suite

Setframe needs a dedicated one because you've repeatedly encountered Safari input issues.

Have a reusable test exercise:

```text
At 390×844 WebKit:

1. Focus every text field.
2. Focus every numeric field.
3. Open every select.
4. Dismiss keyboard.
5. Verify:
   - page scale unchanged
   - bottom nav positioned correctly
   - active input visible
   - no horizontal overflow
   - no layout shift leaving content offscreen
```

This would permanently protect the input-zoom fix.

---

## 14. UX reviewer should NOT fix everything it sees

Very important.

Give it this rule:

```text
During story validation:

Classify unrelated findings separately.

Do not silently fix unrelated issues.

Record them in:
ux-tests/reports/<review>/backlog-findings.md
```

That preserves your **no unrelated scope creep** rule while still benefiting from autonomous discovery.

---

## 15. Definition of Done upgrade

I'd make this the new Setframe product-wide definition of done:

```markdown
# Setframe Definition of Done

A story is not complete until:

## Functional
- Acceptance criteria are satisfied.
- Relevant unit/integration tests pass.
- Relevant Playwright regression tests pass.
- Failure/error states have been tested.

## Responsive
- Designed mobile-first.
- Validated at minimum:
  - 390×844
  - 1440×900
- No unintended horizontal overflow.
- Mobile keyboard interaction has been validated for input-heavy features.

## Cross-platform
- Equivalent behavior exists in mobile app where applicable.
- Mobile web and mobile app have been compared for behavioral and visual parity.

## UX
- The canonical workflow has been run by the Setframe UX Reviewer.
- Initial review occurred before implementation inspection.
- Before/after screenshots are attached for meaningful visual changes.
- No P0/P1 UX findings remain.
- No UX score is below 3.
- Task clarity and mobile ergonomics score at least 4 for core flows.
- Interaction cost is documented when modifying an existing workflow.

## Accessibility
- Controls have accessible names.
- Focus behavior is correct.
- Keyboard navigation works where applicable.
- Dynamic feedback is accessible.
- Color is not the sole indicator of state.

## Async behavior
- Loading states are appropriate.
- Optimistic updates are used when safe.
- Optimistic failures roll back correctly.
- Duplicate actions are prevented.
- Mutation latency does not unnecessarily block adjacent interactions.

## Review
- GitHub/code review completed.
- Figma/design review completed.
- Automated UX workflow completed.
- Web/mobile visual parity reviewed.

## Scope
- No unrelated product behavior was changed.
- Newly discovered unrelated issues are documented separately.
```

That is substantially stronger than a normal software DoD.

---

## 16. Give Claude a `/ux-review` command

The ideal developer experience becomes:

```bash
/ux-review workout-session
```

And Claude knows:

```text
1. Start app.
2. Load fixture.
3. Use Playwright.
4. Run personas.
5. Capture screenshots.
6. Create report.
7. Do not modify code.
```

Then:

```bash
/implement-story 63
```

and finally:

```bash
/ux-review workout-session --compare-before-after
```

Even if those commands are implemented as Claude skills/prompts rather than literal binaries, that's the mental model I'd use.

---

## 17. Then create `/story-review`

This one should combine your existing process.

```text
Review Story 63.

1. Read story Markdown.
2. Read steering section.
3. Run targeted tests.
4. Run UX scenario.
5. Compare mobile web/mobile app.
6. Review screenshots against Figma intent.
7. Inspect diff.
8. Verify no unrelated changes.
9. Produce:
   PASS
   PASS WITH FOLLOW-UPS
   FAIL
```

I especially like **PASS WITH FOLLOW-UPS** because otherwise agents either pretend things are perfect or unnecessarily block useful work over minor polish.

---

## 18. CI vs local autonomous review

I would **not** initially put the entire AI UX review into CI.

Instead:

### CI

Run deterministic checks:

```text
unit
integration
Playwright regression
accessibility
responsive overflow
console errors
```

### Local Claude workflow

Run:

```text
exploratory UX
persona testing
screenshots
interaction counting
qualitative scoring
```

Later, once the system stabilizes, you can automate more of it.

---

## 19. One more thing I think could be extremely valuable: seeded history states

Progress is impossible to properly test with a nearly empty account.

We should have fixtures such as:

```text
new-user
1-week-user
4-week-user
12-week-user
1-year-user
```

The 12-week fixture might contain:

- 42 workouts
- 600 sets
- 60 weight check-ins
- progressive lifts
- plateauing lift
- regressing lift
- missed week
- rest days
- walks
- biking
- mobility
- PRs
- corrected historic set

Then Claude can actually evaluate whether Progress is useful.

This would have prevented the earlier situation where the agent was attempting to design graphs from two data points.

---

## 20. Create intentional “messy data”

I'd go even further.

The fixture should include:

```text
missing weigh-in
duplicate-looking exercise names
custom exercise
bodyweight exercise
duration activity
exercise skipped one week
exercise renamed
edited historical set
rest week
high-volume outlier
very short session
additional activities
```

Real fitness data is messy.

If we only test idealized data, Progress will be brittle.

---

## 21. Eventually: autonomous product discovery

Once this infrastructure exists, you can ask Claude something like:

> Use the Setframe UX Reviewer with the novice, experienced lifter, and data-motivated personas. Spend up to 45 minutes exploring the product without changing code. Find the ten highest-value UX opportunities. Support every finding with browser evidence and rank them by expected user impact versus engineering effort.

And now it can **actually use your application** rather than speculate from screenshots.

That's the point where this becomes more than QA.

It becomes a lightweight synthetic product-research system.

---

## Where I would start

I would build this in three phases rather than boiling the ocean.

### Phase 1

Playwright + Setframe UX skill + 390px/1440px workflows + screenshots + reports.

### Phase 2

Canonical personas, seeded database states, interaction counting, WebKit-specific keyboard/overflow regression suite.

### Phase 3

Playwright's planner/generator/healer agents, automated story validation, mobile-app parity automation, and eventually AI-generated backlog discoveries.

Playwright already supports agent definitions and persistent exploratory automation, so that progression aligns well with the tooling instead of fighting it.

Reference:
- https://playwright.dev/docs/getting-started-mcp

For **Setframe specifically**, I'd make the first three autonomous journeys:

1. **Create first program**
2. **Complete a complex gym workout**
3. **Understand 12 weeks of progress**

Those represent your acquisition/onboarding, core daily-use loop, and long-term retention/payoff loop. If those three experiences are exceptional, the product has a very strong foundation.
