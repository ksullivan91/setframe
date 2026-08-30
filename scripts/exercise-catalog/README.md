# Exercise catalog tooling

Turns `yuhonas/free-exercise-db` into a **curation worklist** for expanding
Setframe's system exercise catalog beyond its current 33 entries.

```bash
node scripts/exercise-catalog/transform-source.mjs
```

No arguments, no network needed after the first run. Takes about a second.

## What it is not

It does not produce a seed file, and it never will. The source is a good
source of **muscle mappings** and a poor source of **names** — three
separate mechanical-import strategies were measured and all failed, which
is recorded in `docs/design/exercise-catalog-import.md` §3.2. The shape of
the work is:

```
author our catalog family by family
  → match into the source
  → inherit primaryMuscles / secondaryMuscles
  → hand-fill the misses
```

So this emits something a person rules on, not something that ships.

## Output

Written to `out/`, and committed — the worklist is the artifact under
review.

| File | What it is |
|---|---|
| `worklist.md` | The review document. Funnel, 72 multi-variant families, 333 singletons, the derived movement pattern for each record, and the 2 delt assignments still needed. |
| `candidates.json` | The same records as data, for whatever comes next. |
| `muscle-groups.ts` | The settled 20 muscle groups across 6 regions. **Not wired into anything** — moving it into `packages/database` is a deliberate step, not a side effect of running this. |

## Input

`.cache/free-exercise-db.json` is fetched on first run and gitignored —
about 1MB of someone else's data, reproducible from the URL in the script.
Delete it to re-fetch.

**Licence:** the dataset is Unlicense (public domain). Its **images** have
no separately stated licence, so nothing here touches them; see
`docs/design/exercise-examples-exploration.md` §4.3.

## Decisions this encodes

All from `docs/design/exercise-catalog-import.md`, and all settled:

- Keep `strength` and `powerlifting` categories only.
- Seven equipment tokens. **Smith machine and EZ-bar are excluded**, not
  folded into Machine and Barbell.
- `shoulders` splits into front / side / rear delts. The source cannot tell
  us which, so name rules assign it from the movement class — a press is
  front-delt dominant, a raise to the side is side-delt. **2 of 526** are
  left for a human, both Kettlebell Halo variants, where the bell circles
  the head and works all three in turn.
- **Rotator work is not a delt.** The source tags external and internal
  rotation as `shoulders`; assigning a head there would encode its error,
  so those map to a `rotator cuff` group instead.
- `movementPattern` is **derived**, not hand-mapped — the source's `force`
  plus the movement word in the name settles 523 of 526. The three
  remainders are two isometric neck exercises and the Halo.
- `canonicalSlug` is a pure function of the name, never hand-written.

Change a decision in the doc, change it here, re-run.

## A caveat on the family count

Movement families are a **clustering heuristic**, not a fact about the
data — they exist so a person can review related variants together. The
first version stripped too many qualifiers and collapsed 32 unrelated
records into one `press` family. It now keeps movement-defining words
(incline/decline, bench/floor, front/rear/side, overhead, leg) and strips
only equipment, grip width, laterality and stance.

If a family looks wrong, tune `QUALIFIERS` and re-run. It affects only
how the worklist is grouped, never what survives the filter.
