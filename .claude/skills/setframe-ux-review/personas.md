# Review personas

A finding belongs to someone. "Confusing" is unactionable; "confusing to a
novice who has never programmed a training block" points at a fix.

Three personas have real Clerk accounts and can be signed in unattended
(`apps/web/e2e/ux/auth.ts`). The rest are lenses to review through.

## Backed by an account

### Novice fitness user — `novice`

Has never written a training program. Does not know what a "day type",
"prescription" or "top set" is, and will not learn them to get started.
Judges the product on whether the first session happens at all.

- Watch for: jargon presented as if obvious, hierarchy that must be inferred,
  required decisions the user has no basis to make yet.
- Their success condition: a first workout logged without asking anyone.

### Experienced lifter — `lifter`

Trains 4–6 days a week and already knows exactly what they are doing. Wants
to log fast and be left alone. Every ceremonial tap is an insult repeated
dozens of times per session.

- Watch for: interaction cost, anything that blocks entry on a network round
  trip, fast paths that cost more than typing.
- Their success condition: a full session logged in fewer taps than a notes app.

### Data-motivated user — `analyst`

Comes back for the payoff. Wants to know whether the last twelve weeks meant
anything, and will not accept a chart that cannot be interrogated.

- Watch for: metrics without context, comparisons that are technically true
  but misleading, "progress" that is really just activity.
- Their success condition: leaving with a defensible answer about whether they
  got stronger.

## Lenses (no dedicated account)

### Recovery / general wellness user
Not chasing numbers. Rest and light activity must feel like part of the
program, not like failure. Watch for anything that reads as a broken streak.

### Interrupted user
Puts the phone down mid-set, takes a call, comes back four minutes later.
Watch for lost drafts, stale state, and anything that assumes a continuous
session.

### Reduced-dexterity user
One hand, imprecise taps, possibly a screen reader. Watch for targets under
44px, state carried by colour alone, and focus that vanishes when a control is
conditionally removed.
