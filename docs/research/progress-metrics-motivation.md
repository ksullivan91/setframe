# Research Report: Which Progress Metrics Motivate, and How to Frame Them

**Prepared for: Setframe product team.** Commissioned while designing the Progress
redesign (backlog stories 11–16). Drives the metric shortlist, tooltip copy and
colour-valence rules implemented in `packages/domain/src/progress-metrics.ts`.

## 0. The single most important framing: process vs. outcome, and SDT

The organizing principle for the whole screen is **Self-Determination Theory (SDT)**: durable motivation comes from supporting three needs — **autonomy** (volition), **competence** (effective mastery), and **relatedness** — not from external pressure. Conditions that support these "foster the most volitional and high quality forms of motivation... enhanced performance, persistence, and creativity," while thwarting them has "a robust detrimental impact." (Verified: https://selfdeterminationtheory.org/theory/) **[Strong]**

- **Teixeira et al. (2012), "Exercise, physical activity, and self-determination theory: a systematic review," Int. J. Behavioral Nutrition and Physical Activity** — the definitive SDT-and-exercise review. Finding: **autonomous/intrinsic motivation and identified regulation predict long-term exercise adherence; controlled/introjected motivation (guilt, "should," external pressure) predicts short-term effort but not maintenance.** https://ijbnpa.biomedcentral.com/articles/10.1186/1479-5868-9-78 (PMC3441783) **[Strong]**

**Design implication that should govern every metric decision:** favour **process metrics the user directly controls** (did I show up, did I do the work) and **self-referenced competence signals** (I'm getting stronger than *my* past self). Treat **outcome metrics the user does not fully control** (body weight, absolute load, a noisy 1RM estimate) as secondary and carefully framed, because presenting an uncontrollable outcome as a performance verdict is a competence/autonomy threat when it moves the "wrong" way.

- **Locke & Latham goal-setting theory** (2002, *American Psychologist*, "Building a practically useful theory of goal setting and task motivation," https://doi.org/10.1037/0003-066X.57.9.705): specific, moderately difficult, *self-relevant* goals with **feedback on progress** drive performance — but feedback must be tied to something the person can act on. **[Strong]**
- **Bandura's self-efficacy theory** (1977, *Psychological Review*; 1997): the strongest source of self-efficacy is **mastery experience** — visible evidence of one's own past success. A Progress screen's core job is to manufacture repeated, honest mastery experiences. https://doi.org/10.1037/0033-295X.84.2.191 **[Strong]**

---

## 1. Metric inventory: evidence and classification

Legend: **P** = process (user controls), **O** = outcome (partially uncontrolled).

| Metric | Type | Evidence on motivation | Verdict |
|---|---|---|---|
| Sessions this week / frequency | **P** | Best-aligned with adherence; behaviour the user owns | **Keep, promote** |
| Consistency (completed vs planned) | **P** | Strong process signal; supports competence | **Keep** (reframe, see §3) |
| Weekly streak | **P** | Powerful *and* risky — see §2.1 | **Keep, redesign** |
| Training volume / tonnage (load×reps) | **O-ish** | Weak proxy; many failure modes — see §2.2 | **Demote** |
| Estimated 1RM trend | **O** | Motivating *as a trend*; dishonest as a noisy headline — §2.3 | **Keep as trend, not headline** |
| Top set / heaviest set | **P/O** | Concrete mastery signal, self-referenced, robust | **Promote** |
| Total reps / duration / distance | **P** | Good process volume for non-load prescriptions | **Keep, contextual** |
| Personal records / PR count | **O (event)** | High-value competence spikes; celebrate — but sparse | **Keep, celebrate** |
| Body weight & trend | **O** | Goal-dependent; valence trap — §3.2 | **Keep, neutralize** |
| RPE / effort trend | **P (subjective)** | Weak as displayed metric; noisy, hard to interpret for lay users | **Do not feature** |
| Time under tension | derived | Niche, low comprehension for ordinary users | **Drop** |
| Pace/speed (cardio) | **O** | Valid for distance/duration prescriptions, self-referenced | **Keep, contextual** |
| Composite "scores" (readiness, fitness score, training load/ACWR) | derived | Opaque; ACWR scientifically contested — §2.6 | **Do not build** |

### Notes on individual metrics

**Session frequency / "sessions this week" [Strong].** This is a process behaviour the user fully controls — exactly what SDT and goal-setting say to feed back on. It maps cleanly onto habit-formation, which is context-cued repetition (Lally et al. 2010, "How are habits formed: Modelling habit formation in the real world," *Eur. J. Social Psychology*, https://doi.org/10.1002/ejsp.674). Keep and promote.

**Top set / heaviest working set [Design judgement, well-grounded].** Underrated. It's a concrete, legible mastery experience ("I moved 185 lb today"), it's self-referenced, and unlike tonnage it *doesn't punish good training decisions* (heavy low-rep days look strong, not weak). Better competence signal than weekly tonnage for most lifters.

**PRs [Strong on principle].** PRs are pure mastery-experience spikes (Bandura). Their weakness is sparsity — they slow down over time, so a screen that leans on PRs will feel like failure to an intermediate. Solution: broaden PR *types* (weight PR, rep-at-weight PR, volume-at-exercise PR, longest plank, furthest distance) so there's almost always *some* honest win, but never manufacture fake ones.

**RPE trend [Weak — recommend against featuring].** RPE is valuable *input* data but a poor *displayed* metric: it's subjective, noisy, and its "good" direction is ambiguous (lower RPE at same load = progress; but higher RPE just means a hard day, not failure). Lay users will misread it. Keep collecting; don't chart it as progress.

**Time under tension / composite scores [Weak/contested].** Low comprehension, high false-precision risk. See §2.6.

---

## 2. Where the evidence contradicts common product intuition

### 2.1 Streaks: genuinely double-edged, not a free win **[Strong for the downside mechanism]**

Streaks work through two mechanisms: early on, visible momentum (competence/progress); later, **loss aversion** (Kahneman & Tversky, prospect theory, 1979, *Econometrica*, https://doi.org/10.2307/1914185). Duolingo's own engineering team states this explicitly — early streaks motivate via accomplishment, long streaks via *fear of losing* hard-won progress — and openly concedes the failure mode: *"If you lose a day and break your streak, it can... actually feel quite demotivating. And the fear of losing a streak could prevent learners from even attempting one."* (Verified, industry source: https://blog.duolingo.com/how-duolingo-streak-builds-habit/). Mark this source **industry, lower confidence** for effect sizes, but it corroborates the mechanism.

The behavioural-science backing for the downside is stronger than product blogs:

- **Abstinence-Violation Effect (AVE)** — Marlatt & Gordon's *Relapse Prevention* framework: after breaking a self-imposed rule, people experience guilt and a loss-of-control attribution that makes **full relapse more likely than a simple lapse would predict.** (Marlatt & Gordon, 1985; see review: Larimer, Palmer & Marlatt, "Relapse Prevention," *Alcohol Research & Health*, https://pmc.ncbi.nlm.nih.gov/articles/PMC6760427/). **[Strong]**
- **"What-the-hell effect"** — Polivy & Herman's counter-regulation research: once dieters believe they've broken their diet, they *increase* consumption ("I've blown it, might as well"). (Herman & Polivy, boundary model of eating; Polivy, Herman & Deo, 2010, "Getting a bigger slice of the pie," *Appetite*, https://doi.org/10.1016/j.appet.2010.04.009). **[Strong]** A broken 200-day streak is a textbook trigger for this.
- **Habit formation tolerates lapses** — Lally et al. (2010): missing a single opportunity did **not** materially impair automaticity gains. Empirically, **one missed day does not break a habit** — yet a streak counter tells the user it does. This is the core dishonesty of a naive streak. https://doi.org/10.1002/ejsp.674 **[Strong]**

**Does streak insurance/freezes help?** Plausibly yes as harm-reduction (it directly counters AVE by preventing the "I've blown it" rupture), but the evidence is **industry-only and confounded** (Duolingo reports positive retention but hasn't published a clean causal test). **[Weak]** Treat freezes as a reasonable mitigation, not a proven intervention.

**Recommendation:** If you keep a streak, (a) count **weeks, not days** (matches training reality and tolerates rest days); (b) never render a broken streak as failure — show "best streak" as a persistent, un-losable trophy and reframe the reset as "new streak started"; (c) consider replacing the fragile single streak with a **"weeks trained in the last N"** count (e.g., "10 of last 12 weeks"), which captures consistency **without the cliff edge**. This is a design judgement grounded in AVE/habit evidence. **[Design judgement]**

### 2.2 Volume / tonnage: a poor motivational headline **[Strong on the failure modes]**

Total tonnage (Σ load×reps) is intuitive to engineers but a weak progress proxy, and it's one of your *currently featured* metrics — I'd lead with dropping it from the headline:

- **It rewards junk volume.** More sets of easy weight inflate tonnage without adaptation. This directly conflicts with competence-based feedback.
- **It punishes correct training decisions.** Deloads, heavy low-rep strength blocks, and technique-focused sessions all *reduce* tonnage while representing good training. A user who trains *better* sees the number go *down* — a competence-threatening false negative.
- **It isn't comparable across prescription types.** `timed`, `duration`, `distance`, `distanceDuration`, and `bodyweight_reps` have no meaningful "lb" tonnage, so a global weekly-lb number silently excludes much of what Setframe tracks — misleading for a plank/carry/cardio user.
- **Bodyweight load is invisible.** Push-ups, pull-ups, planks carry real load that tonnage-by-external-weight ignores, so bodyweight-focused users appear to do "nothing."

There's no strong *motivational* literature endorsing tonnage; it survives in products because it's easy to compute. **Recommendation: demote weekly tonnage** to a per-exercise, opt-in detail; do **not** show it as a cross-modal weekly headline. **[Design judgement, grounded in construct-validity problems]**

### 2.3 Estimated 1RM: fine as a trend, dishonest as a headline number **[Strong]**

Rep-max equations (Epley: `1RM = w·(1 + reps/30)`; Brzycki: `1RM = w·36/(37−reps)`) are **regression estimates, most accurate at low reps and degrading badly above ~10 reps.**

- **LeSuer et al. (1997), "The accuracy of prediction equations for estimating 1-RM performance...," J. Strength & Conditioning Research** — different formulas diverge and systematically mis-estimate, especially at higher reps. https://journals.lww.com/nsca-jscr/abstract/1997/11000/the_accuracy_of_prediction_equations_for.1.aspx **[Strong]**
- Consensus in the strength literature: predictions from sets beyond ~5–10 reps carry meaningful error (often several %), and the estimate is sensitive to rep count, RPE/proximity to failure, and exercise.

**Honesty problem:** showing a single estimated-1RM value to two-decimal precision as a *headline* implies a measurement Setframe never took. This is a **false-precision** violation of numeracy/plain-language guidance (see §4). **Recommendation:** show estimated 1RM **only as a trend line labelled "estimated,"** round hard (nearest 5 lb), suppress it when the set used >10 reps, and never as the hero number. Its motivational value is the *slope* (self-referenced competence over time), not the point value. **[Design judgement + Strong on the accuracy limits.]**

### 2.4 Leaderboards / social comparison: conditional, and risky for your user base **[Mixed]**

- **Festinger's social comparison theory (1954)** and downstream work: **upward comparison** (seeing stronger others) can inspire *or* demoralize depending on perceived attainability and self-esteem. https://doi.org/10.1177/001872675400700202 **[Strong theory]**
- Gamification field studies show leaderboards help *already-engaged, higher-performing* users and **disproportionately discourage lower-ranked users**, who are the exact retention risk. (See Koivisto & Hamari 2019 review, below; and Hanus & Fox, 2015, *Computers & Education*, found leaderboard/badge conditions **decreased** intrinsic motivation and performance over a semester, https://doi.org/10.1016/j.compedu.2014.08.019.) **[Mixed→Strong for the harm-to-losers pattern]**

**Recommendation for Setframe (ordinary gym-goers, mixed goals):** **do not build a global normative leaderboard.** It structurally guarantees that most users are below median and is directly contraindicated for a heterogeneous, non-competitive audience. If any social layer, make it opt-in and self-referenced/cooperative (shared goals), not ranked.

### 2.5 Badges / points / extrinsic rewards: overjustification risk **[Mixed, real]**

The core hazard is the **overjustification effect**: expected extrinsic rewards for an already-intrinsically-motivated activity can *reduce* intrinsic motivation via a shift in perceived locus of causality; when the reward stops, interest can drop below baseline. (Verified: https://en.wikipedia.org/wiki/Overjustification_effect.) The canonical evidence:

- **Deci, Koestner & Ryan (1999), "A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation," Psychological Bulletin** — tangible, expected, performance-contingent rewards **undermine** intrinsic motivation; positive verbal feedback (competence-supporting) does not. https://doi.org/10.1037/0033-2909.125.6.627 **[Strong]**

For fitness/gamification specifically the picture is **mixed, mostly short-term and low-quality evidence**:
- **Koivisto & Hamari (2019), "The rise of motivational information systems: A review of gamification research," Int. J. Information Management** — effects are generally positive but **highly context-dependent and often measured short-term**; results are mixed and moderated by user and context. https://doi.org/10.1016/j.ijinfomgt.2018.10.013 **[Mixed]**
- **Johnson et al. (2016), "Gamification for health and wellbeing: A systematic review of the literature," Internet Interventions** — majority of studies show positive or mixed effects, but **study quality is low and long-term evidence is scarce.** https://doi.org/10.1016/j.invent.2016.10.002 (PMC5883238) **[Mixed/Weak]**
- **Etkin (2016), "The Hidden Cost of Personal Quantification," J. Consumer Research** — directly relevant: **making an enjoyable activity measurable can increase output but reduce enjoyment and subsequent intrinsic motivation.** A caution for *any* metric-heavy screen, not just badges. https://doi.org/10.1093/jcr/ucw049 **[Strong, and pointed]**

**Recommendation:** avoid points/badge economies as primary drivers. If you reward, reward **competence-relevant milestones with informational (not controlling) framing** ("You hit a new best on Squat"), which Deci/Koestner/Ryan show is the *non-undermining* kind of feedback. **[Design judgement, grounded]**

### 2.6 Composite scores (readiness / fitness score / training load / ACWR): don't build **[Strong on ACWR; Design judgement otherwise]**

- **Acute:Chronic Workload Ratio (ACWR)** is scientifically **contested**: Impellizzeri et al. and others have shown methodological and statistical artefacts (mathematical coupling, discretization) that undermine the "sweet spot" claims. (Impellizzeri et al., 2020, "Acute:Chronic Workload Ratio: conceptual issues and fundamental pitfalls," *Int. J. Sports Physiology & Performance*, https://doi.org/10.1123/ijspp.2019-0864.) **[Strong]** Presenting ACWR/injury-risk to lay users would be both opaque and scientifically indefensible.
- Opaque composite "scores" also fail the **explainability/trust** bar (§4) and invite false precision. **Recommendation: do not build readiness/fitness/training-load scores.**

---

## 3. Framing, copy, and comparison design

### 3.1 Self-referenced beats normative **[Strong]**

For a heterogeneous, non-athlete base, **self-referenced ("you vs. your past self") comparison** is favoured: it supports competence and autonomy for *everyone* (there's always a personal baseline), whereas normative comparison mathematically demoralizes the below-median majority (§2.4). This is the safe default. Goal-setting theory adds: pair it with the user's own recent baseline as the reference point.

### 3.2 Colour, valence, and the bulking problem **[Strong on accessibility; Design judgement on palette]**

Red/green deltas encode **moral valence** ("green=good"), which breaks in two ways:

1. **Goal-dependence.** A user intentionally **bulking** *wants* body weight up; painting +1.2 lb red tells them their success is failure. Setframe doesn't even ask for a goal, so the app cannot know which direction is "good" for weight — meaning **valenced colour on body weight is guaranteed to be wrong for some users.**
2. **Accessibility.** Red/green is the worst possible pairing for **deuteranopia/protanopia** (~8% of men). **WCAG 1.4.1 Use of Color (Level A)** requires colour not be the *only* means of conveying information: https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html **[Strong]**

**Recommendations [Design judgement, standards-grounded]:**
- For **direction-neutral / goal-ambiguous** metrics (body weight, and arguably all deltas until a goal is known): use a **neutral palette** + **directional arrow + explicit number** ("▲ 1.2 lb this week"), never red/green as the sole signal.
- Reserve any valenced colour for **process metrics with an unambiguous good direction** (sessions completed, consistency), and even then pair colour with text/icon.
- Where a goal exists, switch to **"vs. goal"** framing ("+1.2 lb — on track for your bulk") rather than intrinsic good/bad.

### 3.3 "No progress," sparse data, and bad weeks **[Strong]**

- **Habit literature says a bad week is not failure.** Lally et al. (2010): lapses don't derail habit formation. So a down week should be framed as **normal variation**, not regression. Copy: *"Lighter week — that's normal. You've trained 9 of the last 12 weeks."* (redirect attention to the stable process metric). **[Strong]**
- **Avoid loss-framed guilt.** SDT/Teixeira: guilt/introjected pressure predicts drop-out, not maintenance. Don't use "You missed 2 workouts" as a headline.
- **Sparse-data states:** never show a metric that needs more data as "0" or a flat/empty chart implying failure. Show a **neutral onboarding state**: *"Log 3 sessions to see your consistency trend."* This preserves competence ("you're on the way") rather than signalling deficit. **[Design judgement, grounded]**
- **Gain- vs loss-framing:** the health-communication meta-analytic evidence (O'Keefe & Jensen, 2007/2009, *J. Health Communication* / *J. Communication*) finds **framing effects are generally small and context-dependent**; gain-framing has a slight edge for **prevention/maintenance behaviours** like exercise. https://doi.org/10.1080/10810730701615198 **[Mixed→lean gain-framing for adherence]** Net: prefer **gain/approach framing** ("Keep your momentum") over loss/avoidance ("Don't lose your streak") for a maintenance behaviour — which, note, is the *opposite* of the loss-aversion lever Duolingo leans on. This tension is real; my judgement is that for a health/adherence product with vulnerable-to-dropout users, the AVE risk of loss-framing outweighs its short-term engagement bump.

---

## 4. Explanatory tooltips / "what does this mean?" affordances

### 4.1 Does explaining a metric help? **[Mixed→positive, moderate confidence]**

- Transparency/explanation generally **improves trust and appropriate reliance** in data and algorithmic systems; the "explainability→trust" link is well documented, though effects vary and over-explaining can reduce use. (General XAI/HCI literature; e.g., transparency improves trust calibration.) **[Mixed]**
- The **Etkin (2016)** caution applies: over-emphasizing numbers can reduce enjoyment. So explanations should **build understanding of a metric the user already cares about**, not add cognitive load. **[Strong caution]**
- **Numeracy research** strongly supports plain-language explanation: many adults have low numeracy and misinterpret ratios, percentages, and precision (Reyna, Nelson, Han & Dieckmann, 2009, "How numeracy influences risk comprehension and medical decision making," *Psychological Bulletin*, https://doi.org/10.1037/a0017327; Peters et al. on numeracy and affect). Fuzzy-trace theory: people reason best with **gist** ("you're getting stronger"), not verbatim numbers. **[Strong]**

### 4.2 Disclosure/data-viz best practice **[Strong on principle]**

- **Progressive disclosure** (Nielsen Norman Group): show the essential number by default, reveal calculation/limitations on demand. https://www.nngroup.com/articles/progressive-disclosure/ **[Strong, though industry/expert source]**
- A good metric explanation should state, in plain language: **(1) what it is**, **(2) how it's calculated**, **(3) its limitation/uncertainty**, **(4) what to do with it.** This mirrors ODPHP **Health Literacy Online** guidance to write for people with limited health/digital literacy and limited time (verified: https://odphp.health.gov/healthliteracyonline) and **plainlanguage.gov / Plain Writing Act** principles (verified: https://digital.gov/guides/plain-language). **[Strong]**

### 4.3 Accessibility & mobile: hover tooltips are not acceptable alone **[Strong — this is standards-backed]**

- **Hover doesn't exist on touch**, and even on desktop, hover/focus tooltips must meet **WCAG 2.1 SC 1.4.13 Content on Hover or Focus (Level AA)**, which requires the revealed content be **Dismissible** (e.g., Esc, without moving pointer/focus), **Hoverable** (you can move onto it), and **Persistent** (stays until dismissed/invalid). (Verified in full: https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus.html) The page explicitly notes native `title`-attribute tooltips are out of scope but are a poor pattern. **[Strong]**
- **Accepted accessible pattern for mobile metric explanations:** a **tappable info affordance** (an "ⓘ" button with ≥44×44 px target — WCAG 2.5.5/2.5.8 Target Size, https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) that opens a **disclosure/expander or bottom sheet**, not a hover tooltip. Wire it with **`aria-describedby`** or an accessible dialog with proper **focus management** and an explicit close. This is a real button/disclosure, which sidesteps 1.4.13's fragile hover requirements entirely. **[Strong / Design judgement on the specific pattern]**
- Also satisfy **WCAG 1.4.1 Use of Color** (don't rely on red/green alone — see §3.2) and provide text alternatives for any trend sparkline.

### 4.4 How much precision / how to express uncertainty **[Strong]**

- **Round aggressively.** Body weight to 0.1 lb is fine (that's the scale's precision); estimated 1RM to nearest 5 lb; volume to significant figures, not exact lb. False precision erodes trust and misleads low-numeracy users (Reyna et al. 2009). **[Strong]**
- **Express uncertainty in gist + a plain hedge**, not confidence intervals: *"This is an estimate from your reps, so treat it as a ballpark."* Avoid statistical language. **[Strong, grounded in numeracy/plain-language guidance]**
- Good real-world examples to emulate (industry, verify before quoting): **Apple Health**'s per-metric "About" sheets and **Withings/Oura**'s plain-language metric explainers that state calculation + limitation. Mark these **industry/lower confidence** as exemplars of pattern, not evidence.

---

## 5. Concrete recommendations for Setframe

### 5.1 Ranked shortlist — show, demote, drop

**Promote / keep (process + self-referenced competence):**
1. **Weeks trained in last 12** (replace or supplement the fragile streak) — process, cliff-free.
2. **Sessions this week** — process, high control.
3. **Consistency (completed vs planned)** — process; reframe positively.
4. **Top set / best set per featured exercise** (trend) — robust competence signal.
5. **PRs (broadened types), celebrated as events** — mastery spikes.
6. **Estimated 1RM as a labelled *trend* only** — self-referenced slope.
7. **Body weight trend (neutral, goal-aware)** — outcome, carefully framed.
8. **Per-modality process totals** (total reps / duration / distance / best pace) for non-load prescriptions.

**Demote (opt-in detail, per-exercise, not headline):**
- **Weekly tonnage (lb)** — construct-invalid across prescription types; punishes good training (§2.2). *This is currently featured; I recommend removing it from the headline.*

**Drop / don't build:**
- **RPE trend chart**, **time under tension**, **global normative leaderboard**, **badge/points economy**, **composite readiness/fitness/training-load/ACWR scores** (§2.4–2.6).

### 5.2 Per-metric spec (tooltip copy, unit/precision, min data, valid prescriptions)

| Metric | One-sentence tooltip (plain language) | Unit / precision | Min data before meaningful | Valid prescription types |
|---|---|---|---|---|
| Weeks trained (last 12) | "How many of the last 12 weeks you did at least one workout — a steady habit matters more than any single week." | integer "N of 12" | 3–4 wks history | all |
| Sessions this week | "Workouts you've completed since Monday." | integer | immediate | all |
| Consistency | "Share of your planned workouts you actually completed — showing up is the goal." | % (no decimals) | ≥1 planned week | all |
| Best set (per exercise) | "Your heaviest working set for this exercise — a simple sign you're getting stronger." | weight, round 5 lb | ≥2 sessions w/ that exercise | `sets_reps`,`top_set_backoff`,`per_side`,`bodyweight_reps` |
| PRs | "A new personal best — heavier, more reps, longer, or farther than before." | event badge | on event | all (type-specific) |
| Est. 1RM (trend) | "An *estimate* of your one-rep max from the reps you logged — a ballpark, most accurate under ~10 reps. Watch the trend, not the exact number." | weight, round 5 lb, label "est." | ≥3 data points, reps ≤10 | load-based only |
| Body weight trend | "Your morning weight over time — up or down is only good or bad relative to *your* goal." | 0.1 lb, 7-day avg | ≥5 check-ins | n/a (check-in) |
| Total reps/duration/distance | "How much work you did in this style of training this week." | native unit | ≥1 session | `bodyweight_reps`/`timed`/`duration` / `distance`,`distanceDuration` |
| Best pace (cardio) | "Your best pace for this distance — compared with your own past efforts." | min/mi or min/km | ≥2 efforts | `distance`,`distanceDuration` |

Precision/uncertainty rules from §4.4 apply throughout; every "est." metric carries a plain hedge.

### 5.3 The intentional-bulking / no-declared-goal problem **[Design judgement, strongly grounded]**

The app **cannot correctly valence body-weight (or even bodyweight-strength) change without knowing intent.** Two-step fix:

1. **Ask, once, lightly (autonomy-supportive):** an optional, skippable "What are you working toward right now? — Gain weight / Lose weight / Maintain / Just training / Prefer not to say," changeable anytime. Framing it as *supportive*, not required, keeps it SDT-consistent (autonomy). This single field unlocks correct valence and "vs. goal" copy.
2. **Until a goal is set (or if skipped): default to non-valenced presentation** — neutral palette, directional arrow + number, no red/green, no good/bad language on weight. This is the safe default that is never wrong for the bulking user (§3.2). Never infer a weight-loss goal by default.

### 5.4 What NOT to build, and why

- **Naive daily streak with a hard reset** — triggers AVE/"what-the-hell" (§2.1); at minimum use weeks + un-losable "best" + "new streak started" reframing. **[Strong]**
- **Weekly cross-modal tonnage headline** — construct-invalid, punishes good training, ignores bodyweight/cardio (§2.2). **[Strong]**
- **Estimated-1RM as a hero number with decimals** — false precision / dishonest (§2.3). **[Strong]**
- **Normative leaderboards** — demoralize the below-median majority you most need to retain (§2.4). **[Mixed→Strong]**
- **Points/badge economy as primary motivator** — overjustification risk; if any, use informational milestone feedback only (§2.5). **[Mixed, real]**
- **Readiness/fitness/training-load/ACWR composite scores** — opaque, false-precision, and ACWR is scientifically contested (§2.6). **[Strong]**

---

## 6. Evidence-strength summary

- **Strong:** SDT/autonomy predicts adherence (Teixeira 2012); mastery→self-efficacy (Bandura); goal-setting needs actionable feedback (Locke & Latham); overjustification (Deci/Koestner/Ryan 1999); AVE & what-the-hell (Marlatt/Gordon; Polivy/Herman); habits survive lapses (Lally 2010); quantification can reduce enjoyment (Etkin 2016); 1RM formula error at high reps (LeSuer 1997); ACWR is contested (Impellizzeri 2020); WCAG 1.4.13 / 1.4.1 / 2.5.x requirements; numeracy/plain-language guidance.
- **Mixed/Weak:** gamification effect sizes and durability (Koivisto & Hamari 2019; Johnson 2016 — low study quality, short-term); leaderboard effects (conditional); gain/loss framing (small, context-dependent); streak-freeze efficacy (industry-only).
- **Design judgement (grounded, not proven):** weeks-not-days streak, drop tonnage headline, neutral valence defaults, optional goal field, info-button/bottom-sheet disclosure pattern.

**Gaps / follow-ups I could not fully close:** (1) no clean *causal, long-term* published trial isolating streak-freeze effects — the Duolingo claim is industry and confounded; (2) direct A/B evidence on *fitness-app* tooltip explanations improving retention is thin — I relied on adjacent numeracy/trust literature; (3) I could not retrieve a working Wikipedia AVE page (404) but grounded AVE via Marlatt/Gordon and the PMC relapse-prevention review; (4) real-product tooltip exemplars (Apple Health, Oura, Withings) are cited as *pattern* references only — verify current copy before quoting. A useful next search would be systematic reviews of *self-monitoring feedback design* in mHealth adherence trials (e.g., Michie's Behaviour Change Techniques taxonomy applied to digital feedback).