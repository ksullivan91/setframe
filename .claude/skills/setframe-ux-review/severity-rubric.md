# Severity rubric

Rank by **what it costs the user**, not by how hard it is to fix. Effort
belongs in the plan, not in the severity.

## P0 — the user cannot complete the task

Data loss, a workflow with no path forward, or a state the user cannot escape.
A workout that cannot be finished, a set that silently fails to save, a
customisation that writes back to the program template.

Fix before anything else ships.

## P1 — the task completes, but wrongly or only by luck

The user gets there by guessing, by hunting, or by tolerating something
misleading. A confident wrong answer ("0 of 5 steps complete" while still
loading) is P1, not P2: it is worse than showing nothing.

Fix in the same story that surfaced it.

## P2 — the task completes, but the experience is poor

Avoidable interaction cost, weak hierarchy, dead controls, inconsistent
language, a completed state that communicates nothing. Real, and worth a
story of its own.

## P3 — polish

Spacing, wording, motion, a nicer empty state. Genuine but not urgent.

## Not a finding

- Anything you have not seen in a browser.
- Data oddities that come from the mock fixtures rather than the product.
- Personal preference with no articulated user impact — put it in Notes.
- Correct behaviour in a state you mis-identified. Check the state first.
