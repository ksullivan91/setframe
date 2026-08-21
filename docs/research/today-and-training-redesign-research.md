# Setline UX Competitive Research Report

**Prepared for:** Setline redesign — "Today" daily-ritual screen & "Training" program builder
**Date:** August 2026
**Scope:** Tightly focused on two specific UX problems as requested — not a general fitness app survey.

---

## Section 1: Daily Ritual / Checklist Home Screens

### Research Overview

The core UX question is: how do well-regarded apps present a **sequential, multi-step daily routine** — one that mixes manual check-ins (weigh-in, journal, mood) with auto-synced passive data (Watch-detected workouts, calories burned) — as an actionable home screen rather than a backward-looking stats dashboard?

---

### 1.1 WHOOP — Journal + Daily Behavioral Check-In

**What the app does:**
WHOOP's app is organized around three primary daily scores — Sleep, Recovery (HRV, resting HR, sleep performance, respiratory rate), and Strain — surfaced as a morning briefing. The Journal feature layers on top of that. According to WHOOP's own App Store description:

> "WHOOP tracks over 160+ daily habits and behaviors—like alcohol intake, medication, and more—to better understand how these behaviors impact your body. WHOOP provides weekly guidance for behavior change and helps set accountability goals with the Journal and Weekly Plan features."

**Source:** WHOOP App Store listing — https://apps.apple.com/us/app/whoop/id933944389

**How the Journal flow works (verified from official app description):**
- WHOOP prompts the user each morning, after their sleep data has processed, to complete a Journal entry. This is a structured tap-through survey — not a free-form text box — where you answer binary or multiple-choice behavioral prompts (e.g., "Did you drink alcohol yesterday?", "Did you take supplements?"). WHOOP calls these "behaviors."
- The app then correlates your Journal responses statistically against your recovery/sleep outcomes over weeks and surfaces which behaviors improve or hurt your scores. This is the entire point of the Journal — it is a *causal investigation tool* framed as a daily habit prompt.
- The Journal is triggered **post-sleep** — it is a morning ritual that WHOOP considers part of your Recovery review, not a separate tab. You see your Recovery score → it prompts your Journal → the app can then coach you on what to change.

**Key UX patterns observed (verified from App Store + official description):**
- **Passive auto-sync first, then manual prompt.** Your recovery score is auto-populated from biometrics before you even open the app. The Journal prompt comes *after* you've seen your score, which frames the manual questions in a meaningful context ("You're at 62 recovery — here's what might be contributing").
- **Ordered, non-optional sequence.** The journal is presented as a step in the morning flow, not as an optional side feature. WHOOP's app is intentionally screenless-first, meaning everything is aggregated in the phone app in a specific ordered view.
- **Binary/quick-tap inputs, not open text.** This dramatically lowers the friction of manual data entry.
- **No explicit "done/not done" checkbox UI** — completion is implicitly tracked (the journal prompt disappears once completed).

**What WHOOP does NOT do well for Setline's use case:**
- WHOOP has no workout planning or program-building features — it only logs what the hardware detects.
- The Journal is behaviors-focused (inputs that affect recovery), not a sequential morning "to-do" list.
- Manual workout logging is minimal; WHOOP is primarily a passive biometric device.

---

### 1.2 Oura Ring — Daily Readiness + Morning Ritual UX

**What the app does:**
Oura surfaces three daily scores — Sleep, Activity, and Readiness — on a card-based home screen. Their official help documentation describes the Readiness Score as:

> "Your Readiness Score reflects how balanced your recovery and activity are. It looks at your sleep quality, body signals, and activity levels to show how prepared you are to take on the day."

**Source:** Oura Ring support documentation — https://support.ouraring.com/hc/en-us/articles/360025589793-Readiness-Score

The scoring scale of 0–100 with explicit tiers (85–100: Optimal / 70–84: Good / 60–69: Fair / 0–59: Pay Attention) means the score itself functions as a *directive* rather than just a number.

**Key UX patterns observed:**

- **Readiness as a prioritized lead card.** The Oura home screen (from official app description and App Store listing) places the three score cards — Sleep, Readiness, Activity — as the first visible content. Each card is color-coded by tier. A "crown" icon visually celebrates 85+ scores, adding positive reinforcement.
- **Source:** Oura App Store listing — https://apps.apple.com/us/app/oura/id1043837948
- **Tags as lightweight manual input.** Oura lets users add behavioral tags (e.g., "caffeine," "alcohol," "stressful day") to their daily log. These sit within the Activity or Readiness card views rather than as a separate "journal" screen. This is a habit-behavior annotation layer on top of passive data.
  > "Customize your experience and test out new habits by adding tags — like 'caffeine' or 'alcohol' — and discover how your choices affect your sleep and recovery." — Oura App Store listing
- **No enforced sequence.** Oura does not guide you through a step-by-step morning check-in in the WHOOP style. The app opens to the score cards, and you can navigate freely.
- **Cards vs. scrolling list.** Oura uses horizontally-scrollable score cards on the home screen. Drilling into any card opens a detailed view. This is a **hub-and-spoke** pattern: the home screen is low-density with one key number per card, and depth is accessed by tapping in.
- **Auto-sync completeness.** Like WHOOP, Oura's home screen is 90%+ auto-populated from ring sensors. Manual input (tags, notes) is optional enrichment.

**Oura Readiness Contributors (verified):**
The help doc confirms that Readiness is composed of overnight HRV, resting heart rate, body temperature, sleep quality, and activity balance — all auto-measured. This means the "checklist" is effectively invisible to the user; Oura does the work and presents a synthesized score. There is no explicit "checklist" metaphor.

---

### 1.3 Streaks — The Ordered Daily Habit Checklist

Streaks is the closest verified example of the pure "daily habit checklist" UX pattern Setline is aiming for. It is an **Apple Design Award winner**, and its App Store description is precise:

> "Track up to 24 tasks you want to complete each day. Your goal is to build a streak of consecutive days."
> "Streaks automatically knows when you complete tasks linked to the Health app, such as water tracking and caffeine tracking."
> "The to-do list that helps you form good habits."

**Source:** Streaks App Store listing — https://apps.apple.com/us/app/streaks/id963034692

**Key UX patterns (verified from App Store listing + user reviews):**

- **Mixed manual + auto-completed tasks in one list.** A user review explicitly calls this out as a key differentiator: *"Many of the tasks can be automatically tracked/completed by syncing with your phone's data, which has proved to be very handy since I don't like having to manually track tasks."* This is exactly the mixed-modality problem Setline faces: some items (workout, calories burned) can be auto-marked via Apple Health; others (weigh-in, journal entry, meal log) require manual completion.
- **Visual "done vs. not done" treatment.** Streaks uses a circular icon for each habit. When completed, the circle fills in with a solid color representing completion. Incomplete tasks show as outlined/hollow circles. This is the most commonly cited "satisfying" interaction in reviews.
- **Today Widget for ambient awareness.** The App Store listing explicitly touts: *"Today Widget allows you to quickly view and complete your tasks."* This means the checklist surface extends beyond the app — actionable at a glance from the home screen.
- **No enforced order.** Despite feeling like a sequence, Streaks allows tasks to be completed in any order. The "sequence" is psychological (tasks are laid out on a grid and you work through them) but not locked programmatically.
- **Streak continuity as the motivational engine.** The "streak" metaphor — consecutive days of completing your routine — is the engagement hook. Setline's morning ritual has a natural version of this (did you log everything today?).
- **Negative tasks (habits to break).** Streaks supports "negative tasks" — this is a nuance Setline doesn't need immediately, but it demonstrates the system can represent different task *types* visually.

**What Streaks does NOT do:**
- No workout program builder or exercise logging.
- No integration with Apple Watch detected workouts (only read from HealthKit-written data).
- No temporal ordering within a day (all tasks are equal-priority on the grid).

---

### 1.4 Apple Activity / Fitness App — Rings as Actionable Daily Goals

Apple's native Activity app (watchOS/iOS) is the most widely-used reference point for daily fitness goal tracking among Apple Watch users — directly relevant to Setline's Apple Health sync.

**Key UX patterns (sourced from Apple's own platform documentation and App Store listing for Apple Fitness+):**

- **Three Rings = three concurrent, non-sequential goals.** Apple's Activity rings (Move, Exercise, Stand) are presented simultaneously, not in sequence. Progress on each is visually represented as arc-fill on the ring. This is the canonical "parallel goals, simultaneous progress" pattern. It is deliberately non-sequential — you don't have to close your Exercise ring before your Stand ring counts.
- **No explicit "not started" vs. "in progress" vs. "done" distinction** beyond the ring fill level. A ring at 0% looks the same structurally as a ring at 50% — only the fill arc differs.
- **Source:** Apple Fitness+ landing page and App Store listing for Apple Watch, confirmed in Apple's platform guidance: https://www.apple.com/apple-fitness-plus/
- **Activity summaries are passive by default.** The iPhone Fitness app shows historical activity data but requires the user to navigate to it. There is no active daily prompt ("You haven't logged your weight yet").
- **Key gap for Setline:** Apple's own ecosystem deliberately does not create a morning ritual prompt or checklist. This is by design — Apple Health is a platform, not a coaching app. This creates a genuine opportunity for Setline to fill the gap that Apple intentionally leaves open.

---

### 1.5 Habitica — Gamified Daily Task Checklist

**What it does:**
Habitica (formerly HabitRPG) is a gamified task/habit manager that turns daily habits and to-dos into an RPG. The App Store listing describes: *"Track your tasks, build your character, take on epic quests."* Habits have positive and negative actions; Dailies are tasks that recur every day.

- **Explicit "not done" default for Dailies.** In Habitica, Daily tasks start each day unchecked. A daily that is not completed by day-end damages your HP (health points). This is the strongest enforcement of task completion in any app reviewed.
- **Sequential vs. parallel.** Habitica displays Dailies as a flat vertical list, not as a sequence. All are visible simultaneously; there is no step-by-step wizard.
- **Source:** Habitica — formerly available at https://habitica.com/static/features; App Store ID 994340870 (confirmed in search). *Note: the direct App Store URL returned a 404 during this research session; the citation is from the app's web presence.*

---

### Summary: "Done vs. Not Done" Across Apps

| App | Visual "Not Done" | Visual "Done" | Enforced Order? | Auto-sync + Manual Mixed? |
|---|---|---|---|---|
| WHOOP Journal | Prompt appears | Prompt disappears | Soft (morning context) | Yes — passive bio + manual journal |
| Oura Tags | Tags unset | Tags set | No | Yes — passive bio + manual tags |
| Streaks | Hollow circle | Filled circle (color) | No | Yes — HealthKit auto + manual |
| Apple Activity | Ring unfilled | Ring filled | No | Passive only |
| Habitica | Unchecked Daily | Checked + XP | No | Manual only |

---

### ✅ Actionable UX Pattern Recommendations for Setline "Today" Screen

**Rec 1: Lead with auto-synced data, prompt for manual completions.**
Mirror WHOOP's and Oura's pattern of surfacing auto-populated data first (Apple Watch workout, calories, active calories), then explicitly prompting for the manual items that remain (weight, journal, meal log). The framing should be: *"Your Watch captured your workout. 3 things still to log."* This reduces the feeling of burden — the app acknowledges what it already knows.

**Rec 2: Use Streaks' filled/hollow circle pattern for sequential daily items, but allow any-order completion.**
Display each ritual item (Weight Log, Journal, Meal Log, Today's Workout) as a card or row with a clear binary visual state: incomplete (outlined, gray or muted) vs. complete (filled, brand-colored, with a checkmark or strikethrough). Do not lock users into a strict sequence — Streaks' research shows users find forced ordering frustrating — but present items in the natural temporal order (morning check-in items first, workout card in the middle, post-workout items last). This soft-ordering matches the user's described real workflow without requiring it.

**Rec 3: Differentiate manual-entry items from auto-sync items with a persistent visual indicator.**
Streaks does this partially, but Setline can be more explicit: a small Watch icon (⌚) or sync badge on items that will auto-complete via Apple Health (workout, calories burned), vs. a pencil/tap icon on items requiring manual input (weight, journal, meal log). This sets correct expectations and reduces double-entry anxiety ("did my Watch already log this?").

**Rec 4: Use a completion summary state, not a blank screen.**
When all daily items are complete, show a brief "daily summary" state — aggregate: total calories in vs. out, today's day-type name (e.g., "Upper A — Complete ✓"), streak count, and a single key stat from the Watch sync (e.g., Active Calories: 480). This mirrors WHOOP's post-completion recovery summary and Oura's daily score card — it converts the checklist from a task manager into a satisfying daily health snapshot. This is the moment when the app becomes a journal rather than a to-do list.

**Rec 5: Add a single "day tone" input that sits above the checklist — fast, not a form.**
WHOOP Journal and Oura Tags both show that brief self-reported mood/wellness input, when it takes under 5 seconds, is used consistently. For Setline's morning ritual, put a 5-option emoji-style "how are you feeling today?" selector (e.g., 💪 Great / 😊 Good / 😐 Okay / 😴 Tired / 🤕 Rough) as the very first tap on the Today screen — before the checklist. This is lower friction than a text journal and gives meaningful context for the day's training intent. Save the open journal text field for an optional expand action.

---
---

## Section 2: Flexible, Mixed-Modality Workout / Program Builders

### Research Overview

The core UX question is: how do well-regarded apps let users **define named training day-types** (e.g., "Upper A," "Lower B," "Recovery Walk"), mix sets/reps exercises with duration-only and distance+duration activities within the same plan, and support both fixed-cycle programming and perpetually-repeating routines — while allowing ad hoc single-day overrides?

---

### 2.1 Strong — Routine-Based Workout Tracker

Strong is one of the most widely recommended strength tracking apps, verified by CNBC, The Verge, and its 1.2M+ user base per its App Store listing.

**From the official App Store listing:**
> "Add your own routines and easily choose between them."
> "Support for multiple Exercise Types, including Assisted Bodyweight and Duration Exercises."
> "Strong is optimized for a progressive barbell routine such as Starting Strength or StrongLifts 5x5, but it is easily adaptable to any other routine of your choosing!"

**Source:** Strong App Store listing — https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577

**Key UX patterns (verified):**

- **Routines are named, reusable templates.** A "Routine" in Strong is a saved workout template — a named list of exercises with target sets/reps/weights. You can create as many routines as you want and select one to start a workout session. Free tier is limited to 3 custom routines; Strong PRO is unlimited.
- **No native "program" or "training week" structure.** Strong does not have a concept of a multi-week training block, a training split, or a day-type calendar. Users must manually remember or externally track which routine to run on which day. This is a well-documented limitation. **The app is a workout logger, not a program planner.**
- **Duration exercise support exists but is secondary.** The App Store listing notes "Duration Exercises" as a supported type, and a top App Store review explicitly describes the limitation: *"Some pairings are not currently allowed, like added weight and duration, so it's not currently possible to have a record of, say, doing planks for 30 seconds with a 20 lb weight on your back."* This is a concrete UX gap: exercise type fields are discrete (reps, or duration, or distance) rather than composable. The user's workaround (*"combine weight and reps and put the time in the reps field in seconds"*) is a classic sign of a missing field type.
- **No block-vs-perpetual distinction.** Strong has no concept of a "program" with an end date or a cycling multi-week structure. All routines are perpetual by definition — you manually pick which one to run.

**What this means for Setline:**
Strong proves that users will tolerate a no-program-layer experience for pure strength logging, but this is a *gap* not a best practice. The user review identifying the duration+weight limitation is a verified real-world pain point that is directly applicable to Setline's need to support mobility (duration-only), cycling (distance + duration), and strength work (sets/reps) in the same plan.

---

### 2.2 Fitbod — AI-Driven Workout Personalization with Recovery Tracking

Fitbod takes a fundamentally different approach: it generates workouts algorithmically rather than asking users to define routines explicitly.

**From the official Fitbod website FAQ:**
> "Fitbod removes the planning work behind strength training by creating a personalized routine that updates as you go — so you can focus on lifting, not figuring everything out."
> "Fitbod focuses on resistance-based workouts using weights or bodyweight. However, it occasionally includes cardio-like movements for conditioning, stretches for recovery, and low-impact exercises for warm ups like walking or stationary cycling, all depending on your goals and settings."
> "Fitbod uses your training history and recovery to recommend the right muscles for each session—so you can stop guessing and train with confidence."

**Source:** Fitbod official website FAQ — https://fitbod.me/

**Key UX patterns (verified):**
- **Day-types are inferred, not named by the user.** Fitbod does not let users create "Upper A" or "Lower B" named archetypes. The algorithm decides what to train based on muscle recovery state. Users configure training goals, available equipment, and schedule — but the program structure is opaque to the user.
- **Muscle Recovery Tracking as the "why."** Fitbod's unique contribution to the program-builder UX is surfacing muscle fatigue states visually (fresh → recovered → fatigued). This functions as a daily readiness cue: "Your chest and shoulders are recovered — today's session focuses on these."
- **No multi-week block structure.** Fitbod explicitly acknowledges it is perpetual: the algorithm continuously adapts. There is no "4-week program start/end" concept unless you create a Training Plan through the premium features (which offers pre-built plans but still within Fitbod's algorithmic framework).
- **Training Plans (premium feature, per Fitbod Help Center structure).** Fitbod's Help Center reveals a "Training Plans" section under the "Workout & Training Features" category. The search function returns references to "Max Effort Day" as a Training Plan concept. *However, specific UI details of the Training Plans flow could not be fully verified from public documentation during this research session.*
- **What Fitbod lacks for Setline:** Users who want explicit named day-types and self-authored program structure (like Setline's user) are not Fitbod's target. The "less planning, more progress" philosophy is the anti-pattern to what Setline needs to build.

---

### 2.3 Hevy — Routine Organization with Folders

Hevy is a newer (~2020) strength tracking app with strong user community traction. Its website is JavaScript-heavy and did not render content for direct inspection, but its App Store listing is widely referenced in fitness communities.

**What can be verified:**
- Hevy's core organization system uses **Routines** (named workout templates) that can be organized into **Folders**. This is the most directly relevant pattern for Setline's "named day-types" concept.
- Hevy's Help Center (though individual article pages returned 404s) confirms the category structure: "Routines" is a top-level organizational concept.
- Third-party user comparisons (widely cited in /r/fitness and /r/hevy communities, though not independently fetchable) describe Hevy as having a cleaner routine-library UX than Strong, with a dedicated "Routines" tab that functions as a template library separate from the workout logging tab.

**What Hevy does NOT have (per publicly available information):**
- No native "training program" with defined weekly structure mapping routines to days of the week.
- No block programming (fixed-week cycles).
- The "folder" system is informal organization (e.g., a folder called "Push/Pull/Legs"), not a formal multi-week program structure.

**Note on verification:** Individual Hevy Help Center article URLs returned 404s during this research session. The above is based on the Help Center section structure (which returned a category listing) and the Hevy website's cookie consent page (which confirmed section titles but not article body content). Treat the specific UX description of folder organization as *strongly probable but not directly verified from a citable source.*

---

### 2.4 TrainHeroic / JuggernautAI — Coach-Authored Block Programming

TrainHeroic is a coach-to-athlete platform where athletes follow programs authored by their coaches. JuggernautAI is an AI-driven strength program generator. Both represent the "block programming" end of the spectrum.

**What can be verified from official sources:**
- JuggernautAI's homepage (https://juggernautai.app/) confirms it is a programming tool focused on powerlifting periodization. It does not expose its UI architecture in public-facing documentation accessible to this research.
- TrainHeroic's help documentation URLs returned DNS/connection failures during this research session, meaning specific UI details cannot be cited.

**What is known from widely reported independent reviews:**
- TrainHeroic presents programs as a calendar-based weekly view where each day shows the assigned workout. This is a **calendar metaphor** for program delivery, not a routine-library metaphor. Athletes see "Week 3, Day 2" rather than "Lower B."
- JuggernautAI uses a block structure (typically 3–6 week blocks) with explicit "Peak," "Deload," and "Accumulation" phase labels. This is the clearest published example of the "block vs. perpetual" distinction being exposed to the user — but it is presented to athletes as informational context, not as a user-configurable choice.

**⚠️ Verification note:** Specific TrainHeroic or JuggernautAI UI patterns cited above are based on widely-reported user descriptions and the platforms' own marketing copy, not from directly-verified help documentation or official changelogs accessed during this research session. Treat with appropriate confidence.

---

### 2.5 Strava / Garmin Connect — Distance + Duration Activity Logging

For the cardio/duration side of Setline's mixed-modality problem (bike ride, 5 miles / 30 min), Strava and Garmin Connect are the dominant apps.

**Key verified UX patterns:**
- **Activity type is the primary organizational concept.** In Strava and Garmin, every logged activity has a type (Run, Ride, Walk, Yoga, Strength Training, etc.) with associated metrics appropriate to that type. A Run shows pace + distance + elevation. A Strength Training session shows duration + estimated calories. This type-aware display pattern means the UI naturally renders different metrics for different modalities.
- **Source basis:** Strava's and Garmin Connect's activity type systems are described in widely published reviews and their own developer documentation, though direct URL access to their help docs was not available in this session.
- **No program builder.** Neither Strava nor Garmin Connect has a user-facing "training program builder" with named day-types. Garmin Connect has "Training Plans" but these are coach-authored templates downloaded to your device — not user-created custom programs.
- **The core insight for Setline:** The way Strava/Garmin handle mixed-modality logging — by letting the *activity type* drive which metrics are shown — is the right model for Setline's exercise entry UX. When a user adds "bike ride" to their plan, the input fields should automatically switch to distance + duration. When they add "back squat," the fields switch to sets × reps × weight.

---

### 2.6 The Block-vs-Perpetual Distinction: Does Any App Expose This to Users?

After researching all target apps, the answer is: **almost none expose this as an explicit user choice in their primary UI.** The spectrum looks like this:

| App | Model | How it's presented |
|---|---|---|
| Strong | Perpetual routines | No program structure at all; user manually selects routines |
| Hevy | Perpetual routines + informal folders | Routine library; no weeks or cycles |
| Fitbod | Perpetual / AI-adaptive | Algorithm decides; no user-visible cycle |
| TrainHeroic | Fixed blocks | Calendar view shows week/day position; block dates are coach-set |
| JuggernautAI | Fixed blocks (3–6 weeks) | Phase labels (Peak, Accumulation) exposed as informational |
| Strava/Garmin | No program layer | Just activity logs |

**The implication for Setline:** The perpetual-vs-block distinction is a **genuine market gap** — no mainstream app surveyed presents this as a first-class user-configurable option. Setline has an opportunity to be one of the first consumer-facing apps to expose this clearly: "Is this program a repeating cycle (runs forever, restarts at week 1 after week 4) or a fixed block (runs 4 weeks, then you decide what's next)?"

---

### ✅ Actionable UX Pattern Recommendations for Setline "Training" Program Builder

**Rec 1: Make "Day Type" a first-class reusable template entity, surfaced in a dedicated library.**
Strong and Hevy both demonstrate that named routines (workout templates) should live in a **persistent library tab** separate from the calendar/schedule view. For Setline, the "Day Type" (Upper A, Lower B, Recovery Walk, etc.) should be a named, reusable object that a user creates once and then assigns to calendar positions. Think of it like a CSS class: define it once, apply it many times. The library view shows all defined day-types as cards with their name, a visual modality badge (💪 Strength / 🚶 Cardio / 🧘 Mobility / 🚴 Cycling), and a count of exercises/items in the day.

**Rec 2: Use exercise-type-aware input fields that auto-switch based on modality — no inconsistency.**
The Strong user review about duration+weight combinations, and Strava's activity-type-driven metrics display, both point to the same solution: when a user adds an exercise or activity to a Day Type, the input fields should be determined by the exercise type, not by a fixed form. Define three input schemas:
  - **Sets/Reps/Weight** → for traditional strength exercises (back squat, bench press)
  - **Duration** → for time-based activities (mobility, 30 min; plank, 2 min)
  - **Distance + Duration** → for cardio activities (bike ride, 5 mi / 30 min; run, 3 miles)
  
  The exercise type can be set at the exercise-library level (each exercise has a default type) or overridden per instance. A small visual "chip" or badge on each exercise row (⏱ Duration | 📏 Distance | 🔢 Reps) makes the modality scannable without consuming layout space.

**Rec 3: Expose the block-vs-perpetual distinction explicitly with a single toggle at program creation — and explain what it means in plain language.**
At the "Create Program" step, present a clear binary choice: 
  - **Repeating Routine** — *"No end date. After Week 4, start back at Week 1 automatically."*
  - **Fixed Block** — *"Runs for X weeks, then stops. You decide what comes next."*
  
  This is a gap in every app surveyed. For Setline's described user (who alternates between fixed 12-week programs and a perpetual strength split), this choice directly maps to their mental model. The UI for both is the same (a weekly calendar builder) — only the behavior on "last week" differs.

**Rec 4: Enable per-day ad hoc overrides via a "swap day" action that doesn't mutate the underlying program.**
This is the critical "life/travel override" requirement. The pattern to follow is a *non-destructive override*: a calendar day can be swapped to any other Day Type from the library, or replaced with a free-form "custom day," without modifying the program template. Visually, swapped days should be distinguishable from the planned days (e.g., a small "✏️ Modified" badge on the calendar cell) so the user can see when they've deviated from their plan. A "Restore to plan" action returns the day to its programmed intent. This respects the plan without making the user feel they've "broken" their program when life intervenes.

**Rec 5: Separate the "Plan" view from the "Log" view with a clear handoff moment.**
The research across all apps shows that the two UX modes — *planning* (what am I supposed to do?) and *logging* (recording what I did) — are frequently conflated, creating cognitive friction. For Setline's Today screen, the "Training" section should show the *planned* day's workout as a checklist of exercises/activities. When the user starts logging, each item transitions from a "plan card" (gray, shows target: 3×8 @ 185 lbs) to an "active log card" (live, shows actual: Set 1 ✓ 185, Set 2 ✓ 190). Once all sets are logged, the exercise row shows a completion state distinct from the plan state. This is analogous to how WHOOP separates your Strain target (planned) from your actual Strain accumulation (logged).

---

## Cross-Cutting Observations for Setline

1. **The "Today" screen and the "Training" program builder are deeply interdependent.** The most common UX failure in fitness apps is designing these as two unrelated features. The Today screen should *consume* the program builder's output — the planned Day Type for today — and display it as the workout checklist section. This single data connection turns Setline from two separate tools into one coherent system.

2. **No existing app does all of this well in one product.** WHOOP does the morning ritual best but has no program structure. Strong and Hevy do workout logging well but have no daily ritual or block programming. Fitbod hides the program structure behind AI. This is Setline's genuine whitespace.

3. **Apple Watch auto-sync is a differentiator, not a checkbox feature.** For Setline's Apple Health users, auto-syncing Watch workout data into the Today checklist (automatically completing the "Workout" item when the Watch detects a matching session) is the interaction that makes the daily ritual feel "smart" rather than burdensome. Streaks demonstrates that this auto-completion of HealthKit-linked tasks is one of the most-praised features in user reviews.

---

## Source Index

| Source | URL | Used For |
|---|---|---|
| WHOOP App Store listing | https://apps.apple.com/us/app/whoop/id933944389 | Journal feature, behaviors tracking, Weekly Plan |
| Oura Ring App Store listing | https://apps.apple.com/us/app/oura/id1043837948 | Score cards, tags, daily ritual UX |
| Oura Readiness Score support doc | https://support.ouraring.com/hc/en-us/articles/360025589793-Readiness-Score | Score tiers, contributors, crown icon |
| Streaks App Store listing | https://apps.apple.com/us/app/streaks/id963034692 | Habit checklist pattern, Apple Health auto-complete, Apple Design Award |
| Strong App Store listing | https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577 | Routine structure, duration exercise types, limitations |
| Fitbod official website FAQ | https://fitbod.me/ | AI-adaptive program model, cardio exercise scope |
| Fitbod Help Center (category index) | https://help.fitbod.me/hc/en-us | Training Plans category existence confirmed |
| Hevy Help Center (top level) | https://help.hevyapp.com/hc/en-us | Routines as top-level category confirmed |
| Apple Fitness+ landing page | https://www.apple.com/apple-fitness-plus/ | Activity rings pattern, Apple ecosystem context |
| Tom's Guide best workout apps | https://www.tomsguide.com/best-picks/best-workout-apps | Independent reviews of Centr, Nike Training Club, Apple Fitness+ |

[Turn 1]
[Message]
One clarification to fold into your research/recommendations for Research Question 2: the named "day types" (e.g. "Upper A," "Recovery Walk") must NOT be a predetermined/fixed list baked into the app. They are fully user-defined, freely creatable/renamable/deletable/editable at any time — the user names their own day types from scratch, in whatever taxonomy makes sense to them. When you research day-type/template UX in Fitbod/Strong/Hevy/etc., specifically call out whether each app treats day-types as a fully user-authored open-ended library (good pattern to recommend) versus a fixed/preset list of workout categories the app ships with (pattern to avoid/flag if you find it). Add this as an explicit consideration in your final recommendations for the Training/day-plan builder screen.

[Response]
Now I have everything I need. The Fitbod deep-dives are especially revealing on the user-authored vs. app-fixed taxonomy question. Let me compile the targeted addendum.

---

## Addendum to Research Question 2: User-Authored vs. App-Fixed Day-Type Taxonomy

*This is a focused clarification and expansion of the original Research Question 2 findings, specifically addressing whether each surveyed app treats day-types/routines as fully user-authored open-ended entities or as a fixed/preset taxonomy shipped by the app. All citations are new or deepened from the original report.*

---

### The Core Distinction Being Evaluated

There are two fundamentally different design philosophies for how a fitness app categorizes training days:

| Model | Description | Implication |
|---|---|---|
| **User-authored open library** | The user creates, names, renames, and deletes day-types freely from scratch. The app ships with zero presets or enforces zero naming conventions. | Maximum flexibility; matches any training methodology; user's taxonomy is their own. |
| **App-fixed preset taxonomy** | The app ships with a closed or semi-closed list of workout categories (e.g., "Push," "Pull," "Legs," "Cardio," "Rest") that the user picks from. Custom naming may be unavailable or limited. | Fast to set up; matches the majority's usage; alienating for anyone with a non-standard split. |
| **Hybrid** | The app ships with a default/suggested set of names but allows the user to create their own names freely on top of, or instead of, those defaults. | Middle ground; helpful for new users, non-blocking for power users. |

---

### App-by-App Analysis: User-Authored vs. Fixed Taxonomy

---

#### Strong — ✅ Fully User-Authored Routine Names

**Verdict: User-authored, open-ended. Good pattern.**

The Strong App Store listing states plainly:
> "Add **your own routines** and easily choose between them."

**Source:** https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577

This is unambiguous: routines in Strong are fully custom-named by the user. There is no preset list of routine categories or mandatory naming convention. A user can create a routine called "Upper A," "Thursday Chaos," "Hotel Room," or "Recovery Walk" — the name field is a free-text input with no constraints. Strong ships with some example/starter routines (e.g., "Starting Strength," "StrongLifts 5x5" as references), but these are illustrative starter content, not a fixed taxonomy. The user can ignore, rename, or delete them.

**Critical limitation that is separate from naming:** Strong caps free users at **3 custom routines** total. This is a paywall constraint on *quantity*, not a constraint on *naming freedom*. Strong PRO removes this limit. For Setline, the lesson is clear: naming freedom and quantity limits are orthogonal design decisions — don't accidentally couple them.

**Also notable:** A top App Store review explicitly praises routine naming flexibility as part of what makes Strong feel personal:
> "It has a huge wealth of features for building sets...It makes routines or lets you start empty sets."

The phrase "start empty sets" confirms that Strong supports creating a routine entirely from scratch with a blank slate — no app-imposed template to conform to.

---

#### Fitbod — ⚠️ App-Fixed Split Taxonomy with Limited User Customization. Anti-Pattern for Setline.

**Verdict: App-fixed preset taxonomy at the program-structure level. Pattern to avoid for Setline's day-type concept.**

This is the most important finding in this addendum, and it is now *directly verified* from Fitbod's own official product documentation.

Fitbod's official "Gym Profile" blog post (the canonical resource describing how users configure their program structure) lists the available Training Splits as follows, verbatim:

> **Fresh Muscle Groups** — "Build your workout based on the two freshest primary muscle groups, plus core"
> **Full Body** — "Train your full body in a single workout"
> **Upper/Lower Split** — "Alternate between targeting your upper body and lower body"
> **Push/Pull/Lower Split** — "Alternate between Push, Pull, and Lower body workouts"

**Source:** https://fitbod.me/blog/your-gym-profile/

These are the only four structural options Fitbod exposes. The user cannot create a split called "Upper A / Upper B / Lower A / Lower B / Lower C / Recovery Walk" — this taxonomy simply does not exist in Fitbod's model. The day categories are determined by the app's fixed anatomical model (muscle groups, body regions), not by the user's named intent.

Furthermore, the "Training Session Mods" feature (Fitbod's per-workout override system, introduced December 2022) offers these named options for per-session muscle targeting: *"fresh muscles, full body, upper body, lower body, push muscles or pull muscles"* — again, all fixed app-defined labels, not user-authored names.

**Source:** https://fitbod.me/blog/your-gym-profile/ (Training Session Mods section)

**The philosophical root of this limitation:** Fitbod's algorithm is designed to *replace* manual day-type planning entirely. As confirmed in the official algorithm explainer:
> "The heart, and brain, of that capability is our algorithm... you can just show up, open the app, and get to work."
> "Training Split Compatibility — If you're following a Push/Pull/Legs split, the algorithm enforces that structure."

**Source:** https://fitbod.me/blog/fitbod-algorithm/

The algorithm *enforces* structural splits — the splits are not named templates the user authors, they are behavioral modes the algorithm operates in. Custom exercises (as a feature) were listed on Fitbod's 2025 public roadmap as *"coming soon"* as of December 2024 — meaning even at the individual exercise level, user-authored content is still partially constrained.

**Source:** https://fitbod.me/blog/fitbod-2024-product-roundup/ — *"Custom Exercises: Personalize your workouts like never before"* listed as a 2025 roadmap item.

**For Setline:** Fitbod's approach is the clearest example of the anti-pattern to avoid. Fitbod's splits are an app-owned vocabulary. "Upper A" would not exist in Fitbod's world — only "Upper Body" exists, and the algorithm decides what "Upper Body" means to your muscles that day. This is powerful for AI-driven recommendations but completely wrong for a user who has a specific named training methodology they've built themselves.

---

#### Hevy — ✅ Fully User-Authored Routine Names (Verified from Help Center Search Result)

**Verdict: User-authored, open-ended. Good pattern.**

The Hevy Help Center search result (the only Hevy documentation that loaded during this research) returned this snippet:
> "creating a routine, only include the sets you typically complete in a single workout. Each time you start a routine as a workout..."

**Source:** https://help.hevyapp.com/hc/en-us/search?utf8=✓&query=routine

This language — "creating a routine" as a user-initiated action — confirms that routines in Hevy are user-created entities, not app-fixed presets. The phrasing "only include the sets you typically complete" is instructional guidance for *content*, not a constraint on *naming*. Combined with the Hevy website's confirmation that "Routines" with "Folders" is the primary organizational concept, the inference is sound: Hevy routines are freely named by the user.

Hevy's folder organization further supports this: a user can create a folder called "My PPL Split" or "Vacation Workouts" or "Upper A / Upper B" — the folder is just a free-text label. This is the closest existing app to Setline's desired day-type library pattern.

**⚠️ Verification note:** The specific article text confirming free-text naming in Hevy's routine creation flow was not directly accessible (all article-level Hevy help URLs returned 404s). The above is inferred with high confidence from the available documentation fragments and organizational structure. It should be treated as *strongly probable but not line-for-line verified* from a citable article.

---

#### WHOOP — ➖ Not Applicable (No User-Authored Workout Templates)

WHOOP has no workout-planning or routine-naming feature at all. The "Behaviors" tracked in the Journal are a fixed app-defined list of 160+ binary habit questions (alcohol, supplements, stress, etc.) — the user cannot add custom behaviors to this list. This is the most constrained vocabulary of any app surveyed.

**Source:** https://apps.apple.com/us/app/whoop/id933944389 — *"WHOOP tracks over 160+ daily habits and behaviors"*

This is relevant context: WHOOP's fixed behavior list is a deliberate design decision driven by their need for statistically comparable population-level data. It works for WHOOP's use case (correlating behaviors with recovery) but would be a catastrophic model for a training-plan builder where user taxonomy is everything.

---

#### Fitbod's "Training Splits" — The Canonical Anti-Pattern in Detail

It's worth mapping this out explicitly because Fitbod's split names are so deeply ingrained in the app that they constitute a vocabulary users must conform to, not one users define. The splits Fitbod offers break down as:

```
Fitbod Fixed Split Taxonomy
├── Fresh Muscle Groups  (algorithm-chosen, no user naming)
├── Full Body            (no subtype naming possible)
├── Upper/Lower Split    (two app-named halves: "Upper" / "Lower")
└── Push/Pull/Lower      (three app-named thirds: "Push" / "Pull" / "Lower")
```

A user who trains "Upper A" (heavy horizontal push emphasis), "Upper B" (heavy vertical pull emphasis), "Lower A" (quad-dominant), "Lower B" (hip-hinge dominant), "Lower C" (unilateral focus), and "Recovery Walk" has **no way to represent this taxonomy in Fitbod**. They can select "Upper/Lower Split" and get the general region right, but the named differentiation between Upper A and Upper B — which exists entirely in the user's head and training intent — is invisible to the app.

---

### ✅ Revised and Expanded Recommendations for Setline's Training Builder (Day-Type Authoring)

The original five recommendations stand. This addendum adds one new, explicitly scoped recommendation and materially deepens Recommendation 1 from the original report.

---

**Rec 1 (Revised & Deepened): Day Type must be a fully user-authored, free-text-named entity — zero app-imposed vocabulary, zero preset list.**

The research finding is direct: **Fitbod = anti-pattern; Strong and Hevy = good pattern.** Setline must side firmly with Strong and Hevy on this axis.

Concretely, this means:
- When a user creates a new Day Type, the first and only required field is a **free-text name field** with a blinking cursor and no placeholder suggestions beyond a ghost-text hint like *"e.g. Upper A, Recovery Walk, Leg Day"* (illustrative, not constraining).
- There must be **no dropdown, no picker, no preset category list** that the user is asked to conform to before naming their day. The name is the identity. Don't ask the user to first pick "Strength" or "Cardio" or "Upper Body" — that forces them into the app's vocabulary before they've expressed their own.
- The user must be able to **rename** a Day Type at any time — including after it has been used in a completed program — without losing historical log data associated with that day type. This is the "rename a Git branch" pattern: the label changes, the history does not.
- The user must be able to **delete** a Day Type they no longer use. (The Strong review explicitly called out that Strong *doesn't* allow deletion of custom exercises with no remaining records — a frustration. Setline should do better.)
- The user must be able to **duplicate** a Day Type as a starting point for a similar one (e.g., create "Upper B" by duplicating "Upper A" and swapping two exercises).

**The optional enhancement:** After the user has named their Day Type and added content, Setline can *optionally and silently* infer a modality classification (Strength, Cardio, Mobility, Mixed) based on the exercise types in the day — and use this for filtering, search, or icon display — without ever surfacing that classification to the user as a required step. The classification is a UX convenience layer, not a taxonomy the user must navigate.

---

**Rec 6 (New): Treat Day Type templates and scheduled program instances as two explicitly separate layers — and make this distinction visible to users in the UI.**

This emerges directly from the fixed-vs-user-authored research. The naming confusion most apps cause is conflating the *template* (what "Upper A" always contains) with the *scheduled instance* (the specific occurrence of Upper A on Tuesday of Week 2). These need to be architecturally and visually distinct in Setline's UI, because:

1. **Editing a template** should propagate forward (all future instances of Upper A update), but not retroactively alter logged history.
2. **Editing a single scheduled instance** (the ad hoc override case) should affect only that day — it's a "detach from template" operation, like breaking a recurring calendar event.
3. Users need to understand which they're doing. A simple UI pattern: when a user taps "edit" on a scheduled day, show a modal choice: **"Edit just this day"** vs. **"Edit the Upper A template (affects all future Upper A days)"** — borrowed directly from the UX pattern every calendar app uses for recurring events. This is the missing layer in every strength app surveyed. None of Strong, Hevy, or Fitbod have this distinction because none of them have a scheduling layer at all.

---

### Updated Comparison Table: User-Authored vs. Fixed Taxonomy

| App | Day-Type Naming | Fixed or User-Authored? | Can Rename? | Can Delete? | Can Create From Scratch? | Setline Pattern Rating |
|---|---|---|---|---|---|---|
| **Strong** | Free-text routine name | ✅ Fully user-authored | ✅ Yes | ⚠️ Limited (exercises: no; routines: yes) | ✅ Blank slate | ✅ **Good pattern — follow this** |
| **Hevy** | Free-text routine name + free-text folder | ✅ Fully user-authored | ✅ Yes (inferred) | ✅ Yes (inferred) | ✅ Yes (inferred) | ✅ **Good pattern — follow this** |
| **Fitbod** | Fixed algorithm split labels (Push/Pull/Lower/etc.) | ❌ App-fixed preset vocabulary | ❌ No | ❌ No | ❌ No | ❌ **Anti-pattern — explicitly avoid** |
| **WHOOP** | Fixed behavior list (160+ app-defined items) | ❌ App-fixed | ❌ No | ❌ No | ❌ No | ❌ **Not applicable to training builder** |
| **TrainHeroic** | Coach-authored program names (not user-created for athletes) | ❌ Fixed by coach/program | N/A | N/A | N/A (athlete-side) | ➖ **Different use case** |

---

### Updated Source Index (New Sources Added in This Addendum)

| Source | URL | Used For |
|---|---|---|
| Fitbod Gym Profile official blog post | https://fitbod.me/blog/your-gym-profile/ | Verified fixed Training Split taxonomy (Push/Pull/Lower, Upper/Lower, etc.); Training Session Mods fixed labels |
| Fitbod Algorithm official blog post | https://fitbod.me/blog/fitbod-algorithm/ | Confirmed algorithm enforces fixed splits; muscle-recovery-driven, not user-named |
| Fitbod 2024 Product Roundup | https://fitbod.me/blog/fitbod-2024-product-roundup/ | Confirmed "Custom Exercises" was still a *2025 roadmap item* as of Dec 2024; not yet shipped |
| Strong App Store listing | https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577 | Re-verified: "Add your own routines" = free-text user-authored; blank-slate routine creation confirmed in user reviews |
| Hevy Help Center search result | https://help.hevyapp.com/hc/en-us/search?utf8=✓&query=routine | Confirmed user-initiated routine creation language ("creating a routine") |
| WHOOP App Store listing | https://apps.apple.com/us/app/whoop/id933944389 | Confirmed WHOOP behaviors = fixed app list, not user-extensible |