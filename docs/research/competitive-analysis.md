# Competitive UX Research Report for Setframe

Date: 2026-08-20. Sources: Apple App Store reviews/listings, Fitbod's
official algorithm blog documentation, press coverage of Whoop (Tom's
Guide), MyFitnessPal review coverage (PCMag), and general Apple
Fitness+/Apple Health iOS 17+ coverage.

**Purpose**: ground Setframe's design/architecture iteration in real
competitive UX patterns, scoped strictly to what fits our locked
spec (strength-training logging, program building, HealthKit
read/reconcile, simple daily check-ins) — explicitly excluding
scope-expanding ideas like social feeds, from-scratch nutrition
logging, or AI coaching.

---

## 1. Strong — Strength Training Logger

### What's Well-Regarded

Strong's core reputation is built on **ruthless UI minimalism**. App Store reviews repeatedly cite "simple, intuitive, functional" as its defining trait. The Verge noted "working out feels more like a game" (framing logging as satisfying, not tedious), and CNBC called it essential gym-prep. With 1.2M+ downloads, its sustained #1 strength-tracking spot on the App Store is backed by reviews from 4+ year users who've never switched.

**Specific praised patterns:**
- **Active workout screen is a single scrollable list**: exercise name → set rows (each row: weight field, reps field, checkmark). No pagination, no modals. Tapping the checkmark logs the set and auto-starts the rest timer in one gesture.
- **Rest timer**: auto-countdown starts on set completion, shows in a persistent banner at the top of the screen — it doesn't take you out of the workout or force you to navigate back. Users praise the non-interruption.
- **Plate calculator**: accessible mid-workout, per-exercise. Given a target weight, it tells you exactly what plates to load on each side of the bar. Reviewers call it "the best feature in the app." Critiqued limitation: only supports standard bar weights (45lb/20lb bars), no custom bar weight — one reviewer spent 275+ workouts working around a 25lb Smith machine bar.
- **Warm-up calculator**: suggests warm-up set weights (e.g., 50%, 70%, 90% of working weight) as separate rows to log before your working sets.
- **PR detection**: sets tagged with a "🏆" indicator inline when a new personal record is hit. No ceremony or confetti — the indicator appears in the set row, users notice it without being interrupted.
- **Set tagging**: individual sets can be marked as Warm-up, Failure, or Drop Set via a long-press or tag picker. This feeds history/analytics without complicating the default logging flow.
- **1RM display & Volume graphs**: accessible from an exercise detail screen with `Weight` and `1RM Progression` charts. Not shown during logging — users go look when they want to.
- **Superset support**: exercises can be grouped. During a superset, you alternate between exercises in the group, each with their own set rows.
- **Apple Watch companion**: logs sets from the wrist, syncs in real-time to iPhone. Consistently called "amazing" in reviews — specifically that watch and phone can be edited simultaneously.

### Feature Ideas for Setframe
- **One-tap set completion + rest timer trigger**: make checking off a set and starting the rest timer a single tap, not two interactions. Users love not having to think.
- **Plate calculator accessible from within the active set row**: a calculator icon on the weight input field, not buried in a menu.
- **Inline PR badge on set completion** — show a small trophy/badge on the set row itself when a PR is logged, without any navigation interruption.
- **Warm-up set suggestion**: before working sets, offer 2-3 warm-up rows pre-populated at percentages of the working weight.

### Patterns to Avoid
- **Exercise type rigidity**: Strong users complain they can't pair "weight + duration" (e.g., weighted plank). The data model treats exercise types as mutually exclusive, making edge-case exercises awkward. Design your `ExerciseType` model to support compound inputs from the start.
- **Custom exercise deletion impossible**: if a custom exercise has history attached, Strong won't let you delete it — only "hide" it. Users find this confusing. Setframe should support soft-delete with history preservation as a distinct, understandable state.
- **Can't customize built-in exercise names**: power users want to rename "Romanian Deadlift" to "RDL." A simple `displayName` override field on the user's exercise record handles this.

---

## 2. Hevy — Social + Logging Hybrid

### What's Well-Regarded

Hevy is widely seen as **Strong's closest rival**, positioned as "Strong with better analytics and a social layer." The free tier is substantially more generous (unlimited routines vs. Strong's 3-routine free limit), which drives trial adoption. Reviews on the App Store (4.8★ on 100k+ ratings) consistently praise the analytics depth.

**Specific praised patterns:**
- **Workout history screen as a calendar heatmap**: month-view calendar where logged workout days are highlighted. Instantly communicates training frequency and consistency without any numbers. Users tap a day to see that session's summary inline.
- **Per-exercise analytics**: tapping any exercise from history shows a dedicated screen with charts for `1RM`, `volume`, `max weight`, and `total reps` — all on a scrollable timeline with time-range toggles (1M / 3M / 6M / All). Hevy's analytics are commonly cited as deeper than Strong's out-of-the-box.
- **Workout summary card**: after finishing a workout, Hevy shows a shareable "workout card" with key stats (duration, volume, PR count, muscle group heat map). Users cite this as motivating — it gives the session a clear endpoint/reward feeling.
- **Superset UI**: exercises in a superset are shown with a bracket/connection indicator on the left of the screen. During logging, you stay on the same screen — the next exercise in the superset is highlighted, you complete its set, then it loops back. Clean without modal interruption.
- **Exercise library search with muscle group filters**: browse-and-filter by primary/secondary muscle group before adding. Users frequently mention this as faster than Strong's search when they don't know the exact exercise name.
- **"Last time" context in active workout**: each set row shows the previous session's weight × reps in small greyed text directly below the input fields. No need to navigate away to see what you did last week.

### Feature Ideas for Setframe
- **"Last time" ghost text on set rows**: show `prev: 185lb × 5` in the weight/reps fields as placeholder text or a subtext label. Zero extra taps — just visible context while logging.
- **Post-workout summary card**: after finishing a session, surface a summary screen (total volume, sets completed, PRs set, duration). Make it shareable as an image. This is a clear session endpoint, which improves satisfaction and retention.
- **Calendar heatmap on the History/Progress screen**: a month or week strip showing which days had workouts logged. Immediately communicates consistency without needing to read numbers.
- **Muscle group filter on exercise picker**: when adding an exercise to a workout or program day, allow filtering by muscle group (push/pull/legs or chest/back/quads/etc.) rather than requiring keyword search.

### Patterns to Avoid
- **Social feed notifications bleeding into workout flow**: Hevy's social layer generates "likes/comments on your workout" notifications that interrupt the workout experience for users who aren't there for the social features. Setframe has no social scope — no feed, but also make sure activity notifications (e.g., sync confirmations) are low-noise.
- **Analytics overload on the Progress screen**: Hevy surfaces 7+ chart types per exercise. Users report feeling overwhelmed when they first open the analytics section. Prioritize 2-3 metrics prominently (1RM trend, volume trend, PR history) and put the rest behind a "more" toggle.
- **Over-generous free tier reducing upgrade motivation**: not a UX issue per se, but a business model note — Hevy's unlimited free tier means users have less incentive to upgrade. Setframe should scope what's free vs. gated thoughtfully.

---

## 3. Whoop / Apple Health — Readiness & Trend Presentation

### What's Well-Regarded (Whoop)

Whoop's app is consistently cited by reviewers (Tom's Guide, general fitness press) as **excellent for daily readiness communication** despite — or because of — its simplicity. The app's design is anchored around two numbers: **Recovery** (0–100%, green/yellow/red) and **Strain** (0–21 scale), shown as the first screen on open.

**Specific praised patterns (Whoop):**
- **Single-screen daily overview**: Recovery score (large, colored number) + Strain score side by side. You know your training context in under 3 seconds. No scrolling required for the daily answer.
- **Color-coded recovery system**: Green (≥67%) = push hard, Yellow (34–66%) = moderate, Red (<34%) = recover. Users internalize this system within days and cite it as the most actionable output the app produces. No ambiguity about what the number means.
- **Recovery sub-breakdown**: tapping the recovery number expands to show its 4 components — HRV, resting heart rate, respiratory rate, sleep performance — each with a trend sparkline. The top-level number is clean; the detail is one tap away.
- **Daily journal (behavioral check-ins)**: each morning, Whoop asks 5-10 short binary questions ("Did you drink alcohol?", "High stress day?"). These are user-configurable. The app later shows correlations between journal answers and recovery scores — a genuinely useful feedback loop users cite as insight-generating. Users who ignore it just skip it; it doesn't block anything.
- **Sleep coach**: tells you "go to bed by 11:04 PM to get 95% sleep need tonight" — a specific, actionable time, not a generic "8 hours" recommendation.

**Specific praised patterns (Apple Health app — iOS 17+):**
- **Summary tab "Highlights" section**: Apple Health's top-of-app section shows 3-4 dynamically selected metrics with context ("Your resting heart rate trended higher than usual this week") using natural language. Users appreciate that the app selects what matters rather than forcing them to hunt.
- **Metrics grid (below Highlights)**: compact icon-grid of health categories (Activity, Heart, Body Measurements, Nutrition, etc.) that lets power users navigate to any data type. Clean visual hierarchy — summary first, drill-down second.
- **Trend indicators with baseline comparison**: individual metrics show a sparkline plus a ±% comparison vs. the prior 30-day baseline. E.g., "Steps: 8,432 today • ↑12% vs your average."

### Feature Ideas for Setframe
- **"Today" screen top section = 3-metric readiness strip**: show Morning Weight, Blood Pressure trend direction (stable/up/down), and Steps from HealthKit as a horizontal 3-card row at the top. Each card tappable to see 30-day history. Derived from Whoop's single-screen daily answer + Apple Health's metrics grid.
- **Color/icon-coded trend direction on check-in metrics**: body weight "↑ 1.2lb this week" in neutral gray vs. blood pressure trending high in amber — low-effort contextual signal without medical claims.
- **Configurable morning journal questions**: 3-5 user-defined daily prompts (e.g., "Sleep quality 1-5", "Recovery feel 1-5") that sit above the workout prompt on the Today screen. Log them in under 30 seconds. Store as `DailyCheckin` rows to enable later correlation views.

### Patterns to Avoid
- **Whoop's initial overwhelm problem**: Tom's Guide reviewer explicitly wrote "Whoop can feel overwhelming for the first week or so." The app has too many unlabeled charts and non-obvious interaction patterns for new users. **Setframe should label every metric, explain every chart**, especially given HealthKit data that users may not have conceptual models for.
- **Apple Health's data-overload default view**: the Health app shows 100+ data categories with no initial prioritization. Users who aren't data-literate bounce. Setframe should never present raw HealthKit data as-is — always present a curated, labeled summary view, not a dump.
- **Passive data without actionable context**: Apple Health shows "exercise minutes: 23" with no context about whether that's good, bad, on-trend, or relevant to today's planned workout. Add baseline comparison ("vs your 30-day avg") and a brief label on every HealthKit metric card.

---

## 4. Future / Fitbod — Adaptive Programming UX

### What's Well-Regarded (Fitbod)

Fitbod's core differentiator is its algorithm (documented publicly on their blog). The UX is designed around making algorithmic suggestions feel credible and transparent — not a black box.

**Specific praised patterns:**
- **"Estimated Strength" as the primary progress metric** (previously "Projected 1RM" — they renamed it after user research revealed many users didn't understand "1RM"): shown as a line chart per exercise with the value prominently displayed and increasing trend visually evident. Fitbod documented they changed the label because clarity matters more than technical precision. *Lesson: name your metrics for users, not for exercise scientists.*
- **7-metric exercise history panel**: per exercise, users can view trends across Estimated Strength, Weight, Volume, Reps, Distance, Time, and Split — selectable via a tab strip. Users select the 1-2 that matter to them; the rest don't crowd the default view.
- **Records/celebrations at workout end**: when you hit a PR, Fitbod shows an in-app celebration screen with a shareable graphic of the record. Separate from the logging flow — it triggers post-session.
- **Muscle recovery fatigue map**: a body silhouette showing which muscle groups are "fresh" (green) vs. "fatigued" (orange/red) based on recent training. Users can manually adjust this to account for activity Fitbod didn't log (a hike, a sports game). Praised for being both educational and actionable.
- **Progression rule transparency**: the algorithm blog post explains that rep ranges, set counts, and rest periods are programmed from published sport science (citing Schoenfeld 2017, Grgic 2018). Users who read this trust the suggestions more. *Lesson: show your work when making prescription suggestions — even a brief tooltip ("Based on your 3-day volume" or "Progressive overload: +5lb from last session") dramatically improves user trust in programmatic suggestions.*

**Specific praised patterns (Future):**
Future's UX is primarily human-coach-delivered (out of Setframe's scope), but its **workout preview UX** is worth noting: before a workout begins, users see a "today's workout" card that includes exercise list, estimated duration, and an intensity indicator. This pre-session context-setting is praised for reducing friction — users know what they're walking into before they start logging.

### Feature Ideas for Setframe
- **Progression rule picker with plain-English labels**: in the ProgramEditor, when a user sets a progression rule for an exercise (e.g., "add 5lb when all reps hit"), show a brief plain-language tooltip like "Linear progression: add weight each session when you complete all prescribed reps. Common for beginners on compound lifts." Don't just show `rule: DOUBLE_PROGRESSION`.
- **Pre-workout preview card on the Today screen**: before starting a workout session, show a "Today: Push A — 6 exercises, ~50 min" summary card. Tapping it opens the WorkoutLogger. Sets expectations and reduces friction.
- **"Rename metric for clarity" principle**: call the user-facing 1RM display "Estimated Max" or "Strength Score," not "1RM" or "Projected 1RM." Fitbod's documented user research found the latter confused non-powerlifters.

### Patterns to Avoid
- **Black-box suggestions**: Fitbod's most common complaint thread is "why did it suggest THIS workout today?" when users don't understand the muscle recovery model. Since Setframe's programming is human-set (not algorithmic), this is less of a risk — but wherever you surface a suggestion (e.g., "add 5lb this session" based on a progression rule), always show the reason inline.
- **Over-complex program template building**: Fitbod hides program structure behind multiple menu layers. Setframe's ProgramEditor should keep the weekly day sequence and exercise assignment visible in one scrollable canvas — not buried in nested screens.

---

## 5. MyFitnessPal — Nutrition Summary Presentation

### What's Well-Regarded

MFP's food database (20.5M+ items, cited in App Store listing) is its moat and most praised feature. But for Setframe's purposes, the relevant UX is how MFP **surfaces daily nutrition summaries** — since Setframe will pull MFP data through HealthKit.

**Specific praised patterns:**
- **Daily macro ring/bar summary**: the home screen shows a calorie "remaining" calculation (Goal − Food − Exercise = Remaining) as a prominent number, plus a bar chart of Protein / Carbs / Fat in grams vs. goal. Users cite this as the reason they open the app daily — it answers "how am I doing today" in 2 seconds.
- **Per-meal breakdown**: food is organized by Breakfast / Lunch / Dinner / Snacks with calorie subtotals per meal. Users praised the ability to see not just daily totals but per-meal distribution.
- **"If every day were like today, you'd weigh X in 5 weeks"**: a projection shown after diary logging. Users find this motivating (or sobering). PCMag notes it as a distinctive, memorable UX moment. *Lesson: turn raw data into a human-readable consequence statement.*
- **Nutrient detail drill-down**: tapping any macro opens a full micronutrient breakdown. Sodium, fiber, sugars, saturated fat — all present but behind a tap. Default view is clean; detail is accessible.

**Patterns to Avoid:**
- **Logging friction driving abandonment**: MFP's #1 cited complaint is that barcode scanning, search, and meal construction is too slow. Users stop logging after 2-3 weeks. Since Setframe is *reading* MFP data via HealthKit (not asking users to log food natively), you sidestep this entirely — but it validates keeping your HealthKit data ingestion fully passive/automatic, never asking users to manually re-enter nutrition data.
- **Ad/upsell interruptions in the data flow**: MFP Premium upsells appear mid-scroll in the nutrition diary. Users find this jarring. Keep Setframe's HealthKit data section ad-free and non-paywalled.
- **Precision theater**: MFP shows nutritional data to 1 decimal gram precision (e.g., "47.3g protein"). Users report this false precision creates anxiety over minor deviations. For Setframe's HealthKit nutrition display, **round to whole numbers** and show a contextual range or goal comparison, not raw decimal values.

---

## Top 5 Actionable Ideas for Setframe

---

### Idea 1: "Last Session" Ghost Text on Every Set Row
**What**: In the active WorkoutLogger, each weight/reps input row shows small greyed-out text below (or as placeholder) with the previous session's logged value for that exercise+set position. E.g., `prev: 185 lb × 5`. No tap needed — it's always there.

**Why it wins**: Hevy users call this out as the feature that most removes mid-workout friction. Strong forces you to navigate away to see history. This one pattern makes every set feel informed.

**Screens/model touched**: `WorkoutLogger` (active session screen) — read from `SetLog` history, display on set input row. No data model changes needed if `SetLog` already stores `weight`, `reps`, `exerciseId`, `sessionDate`.

---

### Idea 2: Inline PR Badge + Post-Session Summary Card (no ceremony during logging, payoff at the end)
**What**: During logging, when a set is completed that beats the user's all-time record for that exercise, show a small `🏆` badge on the completed set row — non-blocking, no modal. After the session is marked "Done," show a dedicated summary screen: total volume, duration, PRs set (with exercise names), and a shareable workout card image.

**Why it wins**: Strong's inline PR badge is loved but the session has no clear "win" moment. Hevy's post-session card is loved but some users feel the in-workout PR feedback is too subtle. Combine both. The during-workout badge is satisfying; the end-of-session card gives closure and a social-sharing hook (without requiring a social feed in Setframe).

**Screens/model touched**: `WorkoutLogger` (set row component — add `isPR: boolean` flag computed on log submission) + new `SessionSummaryScreen` (post-workout). Data model: `WorkoutSession` may need a `prs: ExercisePR[]` derived field or a `PersonalRecord` table with `userId`, `exerciseId`, `metric` (weight/1rm/volume), `value`, `achievedAt`.

---

### Idea 3: Plain-Language Progression Rule Labels in ProgramEditor
**What**: When a user is creating or editing an exercise prescription inside a Program Day, the progression rule selector should show human-readable descriptions alongside each rule type. E.g.:
- **Linear (+5lb per session)** — "Add weight every session when you complete all prescribed reps. Best for beginners on compound lifts."
- **Double Progression (reps first)** — "Increase reps each session until you hit the top of the rep range, then add weight and reset to the bottom."
- **Percentage-based (%1RM)** — "Sets are prescribed as a % of your estimated max. Adjusts automatically as your strength improves."

**Why it wins**: Fitbod's documented user research found "Projected 1RM" was poorly understood by non-powerlifters. The same problem applies to progression rules. Users who understand the rule they've chosen are more likely to follow the program and trust the app.

**Screens/model touched**: `ProgramEditor` (progression rule picker component). Data model: no change needed — this is a UI label/tooltip layer over existing `progressionRule` enum values.

---

### Idea 4: "Today" Screen Health Metric Grid (Curated HealthKit Summary)
**What**: The Today screen includes a compact 2×2 or 3-card horizontal grid of HealthKit-sourced metrics, each showing today's value + a trend indicator vs. 30-day average:
- 📊 **Steps**: `8,432` · ↑ 12% avg
- 🔥 **Active Calories**: `342 kcal` · ↓ 8% avg
- 🍽️ **Nutrition** (from MFP via HK): `1,840 kcal logged` · `142g protein`
- ⚖️ **Body Weight** (from manual check-in or HK): `183.4 lb` · trend arrow

Each card is tappable to open a 30-day sparkline view. Metrics that haven't been authorized or don't have data show a dimmed "Connect" state, not an error.

**Why it wins**: Apple Health dumps 100+ metrics with no hierarchy. Whoop's single-screen daily answer is too hardware-dependent. Setframe can sit in between — curated, labeled, contextual — without requiring Whoop hardware. The MFP nutrition card specifically converts the HealthKit `dietaryProtein` / `dietaryEnergyConsumed` HK types (which MFP writes to HealthKit when users sync) into a usable at-a-glance view.

**Screens/model touched**: `TodayScreen` — new `HealthMetricGrid` component. Data model: `DailyHealthSnapshot` table (`userId`, `date`, `steps`, `activeCalories`, `exerciseMinutes`, `caloriesConsumed`, `proteinGrams`) populated by background HealthKit sync job. Body weight stored in existing `DailyCheckin` table.

---

### Idea 5: Pre-Workout Session Preview Card
**What**: On the Today screen, if the user has a scheduled workout for today based on their active program (e.g., "Week 2 · Day 3: Pull B"), show a card above the HealthKit grid:
```
Today: Pull B  ·  Week 2 Day 3
6 exercises  ·  ~45–55 min estimated
[Start Workout]  [Preview]
```
Tapping "Preview" shows the exercise list with prescribed sets × reps × weight. Tapping "Start Workout" launches the `WorkoutLogger` pre-populated.

**Why it wins**: Fitbod's pre-workout preview card is consistently cited as reducing pre-session friction ("I know what I'm doing before I get to the gym"). Strong and Hevy require users to navigate to their routine list and manually start a session from scratch. Setframe's program model means you know what day it is — use that data to create a zero-navigation path from Today → active workout.

**Screens/model touched**: `TodayScreen` (new `ScheduledWorkoutCard` component) + `WorkoutLogger` (receives pre-populated exercise + prescription data). Data model: relies on `Program` → `ProgramWeek` → `ProgramDay` → `ProgramExercise` already in scope; needs a `currentProgramDayIndex` tracking field on the user's active `ProgramEnrollment` record, or derived from `WorkoutSession` history.

---

*Report complete. All five ideas are grounded in documented user behavior from competitive apps, scoped strictly to Setframe's existing feature surface, and mapped to concrete screens and data model touch points.*
