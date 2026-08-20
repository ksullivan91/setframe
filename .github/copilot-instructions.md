# Copilot Instructions — Setline

## What this repo is

Setline is a multi-user fitness training + Apple Health sync platform. See
`github-copilot-fitness-app-master-prompt.md` (product/architecture spec)
and `setline-branding-figma-mcp-copilot-prompt.md` (design-system spec) for
the full requirements this repo implements. `docs/architecture.md`,
`docs/data-model.md`, `docs/api.md`, `docs/dependencies.md`, and
`docs/adr/*` are the living Phase 0 design record — keep them in sync with
implementation decisions as the project progresses through its phases.

## Git conventions

Conventional Commits style:
```
{type}: {description}
```
Valid types: `feat`, `fix`, `chore`, `docs`, `ci`, `refactor`, `style`, `test`

Always include the Copilot co-author trailer on commits made by an agent:
```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

## AI-assisted code review

Setline uses two review layers, both backed by GitHub Copilot (no external
AI service or token required):

1. **Pre-commit (local)** — `.githooks/pre-commit` runs the Copilot CLI's
   `/review` agent against the staged diff and blocks the commit on
   HIGH-severity findings only. Install once per clone with
   `scripts/setup-hooks.sh`. Bypass intentionally with `git commit
   --no-verify`. Transcripts are archived under `.copilot-reviews/`
   (gitignored).
2. **Pull request (GitHub-native)** — the repo ruleset "Automatic Copilot
   code review" automatically requests a Copilot review on every PR
   against `main` (including draft PRs and new pushes). This is Copilot's
   own agentic PR reviewer (`copilot-pull-request-reviewer[bot]`) — a
   second, independent pass distinct from the local CLI session. Its
   comments never block merge on their own; treat them like a human
   reviewer's comments.

See `docs/code-review-workflow.md` for the full design and how this maps
to the GitLab-Duo-based setup used in other repos.

## Interaction preferences

- Ask clarifying questions when scope is ambiguous — batch them, don't ask
  one at a time.
- Prefer brevity; skip preamble.
- Nothing beyond the currently active phase (per the master prompt's
  phased plan) should be implemented without explicit sign-off.
