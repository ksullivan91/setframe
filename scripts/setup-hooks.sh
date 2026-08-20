#!/usr/bin/env bash
# Installs Setline's git hooks (currently: Copilot pre-commit code review).
#
# Run once per clone:
#   scripts/setup-hooks.sh
#
# This just points git at the repo-tracked .githooks/ directory instead of
# the untracked, per-clone .git/hooks/ directory, and ensures the hook is
# executable. Safe to re-run.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

chmod +x .githooks/pre-commit
git config core.hooksPath .githooks

echo "Git hooks installed (core.hooksPath = .githooks)."
echo "Pre-commit Copilot code review is now active. Bypass with: git commit --no-verify"
