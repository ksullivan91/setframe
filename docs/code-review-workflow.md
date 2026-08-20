# Setline code-review workflow

Setline's automated review setup is a direct port of the GitLab-Duo-based
pre-commit review pattern used in `crewvette-replatform`, `er-re-platform`,
and `blueprint` — adapted to GitHub + GitHub Copilot, since that's the
platform and AI vendor this project standardizes on.

## Why this looks different from the Duo setup

The Duo pattern needed custom plumbing because GitLab Duo is a *separate*
AI service from the Kiro IDE agent doing the "self-review": a Python
script (`.duo/scripts/review.py`) called the GitLab Duo Chat REST API with
a `DUO_GITLAB_TOKEN`, archived the response, and a Kiro hook orchestrated
"my review" + "Duo's review" into one verdict.

Setline doesn't need that plumbing, because **both review layers are
GitHub Copilot** — there's no second vendor to bridge:

| Layer | Duo-era mechanism | Setline mechanism |
|---|---|---|
| Local self-review | Kiro agent reasoning inline | GitHub Copilot CLI's built-in `/review` agent |
| Independent second opinion | GitLab Duo Chat API + PAT | GitHub's native Copilot PR code review (`copilot-pull-request-reviewer[bot]`) |
| Trigger | Kiro IDE hook (`userTriggered`) | git `pre-commit` hook (local) + repo ruleset (PR) |
| Archive | `.duo/reviews/<timestamp>_<label>/response.md` | `.copilot-reviews/<timestamp>_pre-commit.md` (gitignored) |
| Token/secret required | Yes (`DUO_GITLAB_TOKEN`) | No — uses the same Copilot auth already in use for this CLI/session |

## Layer 1 — Pre-commit (local, blocking on high severity)

`.githooks/pre-commit`:
1. Skips if nothing is staged.
2. Skips (fail-open, doesn't block) if the `copilot` CLI isn't installed
   or the review call errors — never trap a developer with no way to
   commit because of an outage.
3. Otherwise captures `git diff --cached` itself (trusted context) to a
   file under `.copilot-reviews/` and asks a **read-only** Copilot CLI
   invocation (`--available-tools view,grep,glob`, no shell/write/network
   tools, `--no-ask-user`) to `view` that file — never passing the raw
   diff as a CLI argument (avoids `ARG_MAX` failures on very large diffs)
   and never letting the agent run `git` itself. Instructed to treat the
   diff as data to analyze and never as instructions to act on. Asks for
   a `REVIEW_VERDICT: PASS` / `REVIEW_VERDICT: BLOCK` verdict as the
   literal last line of the response, scoped to HIGH-severity issues only
   (bugs, security flaws, data loss, broken behavior — not style).
   - This design was validated the hard way: Copilot's own dogfooded
     reviews of this hook, across successive commits, caught three real
     issues in its own implementation — an `--allow-all-tools` +
     agent-runs-`git-diff` combination that was a prompt-injection →
     arbitrary-exec risk, a raw-substring verdict match that could false-
     block on the model quoting `REVIEW_VERDICT: BLOCK` in its own prose,
     and a `set -e`/`pipefail` interaction that could abort the hook with
     no message. All three are fixed in the current version.
4. Archives the full transcript to `.copilot-reviews/`.
5. Blocks the commit only on `BLOCK`. Bypass with `git commit --no-verify`
   when you've reviewed and consciously accept the risk (e.g. WIP
   branches, docs-only commits it misjudges).

### Setup (once per clone)

```bash
scripts/setup-hooks.sh
```

This points git at the repo-tracked `.githooks/` directory
(`core.hooksPath`) instead of the untracked `.git/hooks/`, so the hook
ships with the repo and every clone gets it with one command.

## Layer 2 — Pull request (GitHub-native, non-blocking)

A repository ruleset ("Automatic Copilot code review", branch target:
default branch) requests a Copilot review automatically on every PR,
including draft PRs and new pushes to an existing PR
(`rules[].type: "copilot_code_review"`, `review_on_push: true`,
`review_draft_pull_requests: true`). No script or token needed — this is
the same feature as clicking **Request** next to Copilot under
Reviewers, just automatic. Copilot always leaves a comment-only review
(never "Approve"/"Request changes"), so it never blocks merge on its own
— treat its findings like a human reviewer's comments before merging.

To inspect or change it:
```bash
gh api repos/ksullivan91/setline/rulesets
```

## What's intentionally not ported from the Duo setup

- **Steering docs equivalent** (`.duo/steering/*.md`): Setline uses
  `.github/copilot-instructions.md` instead — Copilot CLI and GitHub's
  Copilot code review both read repo-root instructions natively, so a
  separate prompt-assembly script isn't needed.
- **"Lessons learned" auto-append step**: not built yet. Revisit if
  recurring review findings suggest a steering doc would help; add a
  `docs/code-review-lessons.md` the hook prompt can be told to consult, if
  it becomes useful.
