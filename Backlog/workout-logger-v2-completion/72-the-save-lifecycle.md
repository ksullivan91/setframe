# Story 72 — The Save Lifecycle

**Priority: P1.** The commit-on-blur rule works. The lifecycle around it —
coalescing, slow requests, offline — does not exist.

Spec: `docs/design/workout-logging-interactions.md` §7.

```
blur ──▶ optimistic ──▶ request ──▶ settle
```

The user should only ever notice the first two stages.

## 1. Debounce, 400ms per row

Writes for one row coalesce over 400ms, so weight → reps → out produces **one**
request, not two. Different rows never coalesce with each other.

This is the throughput concern ADR 0011 flagged when it accepted that write
volume would rise: every blur is a `PATCH /v1/workout-sets/:setId`, including
corrections, where v1's Save covered a whole set.

## 2. Pending ring after 1.5s

The mark already has a `pending` state and it currently paints immediately.
It should appear only after **1.5 seconds without a response** — a spinner on
a sub-second write is more disruptive than the write.

This is the stage the user should normally never see.

## 3. Offline

Rows queue and the header shows an offline chip. **Queued rows keep the
pending ring, not a check.**

> A save that has not happened must never look like one that has.

This is the single rule that makes silent autosave trustworthy enough to
justify removing the Save button. Getting it wrong undoes the whole model.

## 4. Failure is never a toast alone

Already built — the mark rolls back to error and keeps every value — but worth
pinning with a test. A toast about row 3 that appears while the user is
looking at row 5 is not error recovery.

## Concurrency note, not a task

`recalculateLogPrFlags` resolves the whole exercise log on every set mutation,
and neon-http has no interactive transactions, so two concurrent edits to one
exercise can leave a stale PR flag. It self-heals on the next mutation. Do not
try to fix this here; just do not make it worse by firing more writes than
necessary, which is what the debounce is for.

## Acceptance criteria

1. Typing weight then reps then blurring the row issues **one** request.
2. Editing two rows in quick succession issues **two** requests, not one.
3. A response under 1.5s never shows a pending ring.
4. A response over 1.5s shows one, and it clears on settle.
5. Offline: rows queue, the header says so, and no queued row shows a check.
6. Going back online flushes the queue in order.
