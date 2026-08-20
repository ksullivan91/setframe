# ADR 0004: Hosting Topology (Cloudflare Pages + Railway + Neon)

Status: Proposed. Date: 2026-08-20.

## Context

Setline needs production hosting for a React SPA, a Fastify API, and a
PostgreSQL database, plus a path to iOS distribution, while explicitly
avoiding infrastructure complexity beyond what a single-service MVP needs
(master spec §34: no Kubernetes/microservices/etc.).

## Decision

- **Web**: Cloudflare Pages, connected to the GitHub repo, deploying the
  `apps/web` Vite build output on pushes to `main` (plus preview
  deployments for PRs).
- **API**: Railway, connected to the GitHub repo, running the `apps/api`
  Fastify service (listening on `process.env.PORT` and `0.0.0.0`).
- **Database**: Neon PostgreSQL — one Neon project, using **branch-per-
  environment** (dev/test/prod branches) rather than three separate Neon
  projects.
- **Auth**: Clerk (see ADR 0002).
- **Mobile builds/distribution**: Expo EAS, iOS via TestFlight/App Store
  when ready.
- **Object storage**: none for MVP; Cloudflare R2 only if a concrete need
  emerges later.

## Rationale for Neon branch-per-environment (vs. separate projects)

- Neon's branching model is designed for exactly this: cheap,
  copy-on-write branches from a parent, making it simple to spin up a
  fresh test DB or a PR-preview DB without provisioning a whole separate
  project/billing unit.
- Keeps connection-string/credential management simpler (one Neon project,
  one set of project-level settings) while still fully isolating dev/test
  data from production data via distinct branches with distinct
  connection strings.
- Local development can point at a dedicated Neon dev branch or a local
  Docker Postgres — both remain viable; the simplest repeatable option
  should be documented and chosen in `docs/local-development.md` (Phase 1).

## Rationale for Cloudflare Pages (web) + Railway (API) split

- Matches the master spec's explicit target stack.
- Cloudflare Pages is well-suited to a static Vite SPA build with global
  CDN distribution and trivial GitHub-integration deploys; it does not run
  the API, so no server-side secrets ever need to live there beyond public
  `VITE_*` config.
- Railway runs a persistent Node process (required for Fastify) with
  straightforward GitHub-integration deploys and environment variable
  management, without requiring a full container-orchestration platform.

## Consequences

- CORS must be explicitly configured on the API to allow the Cloudflare
  Pages origin(s) (production + preview domains).
- Migrations must run against the correct Neon branch before the
  corresponding API deploy goes live (expand/contract pattern for breaking
  changes, documented in `docs/deployment.md`).
- Preview deployments (Cloudflare Pages PR previews) must not receive
  production secrets/environment variables — enforce this explicitly in
  Cloudflare Pages environment variable scoping.

## Decided (2026-08-20)

- Neon topology confirmed: **one Neon project, branch-per-environment**
  (dev/test/prod branches), as proposed above.
- GitHub repository confirmed: `https://github.com/ksullivan91/setline`.
  This monorepo will be pushed there; Cloudflare Pages and Railway GitHub
  integrations should both point at this repo once Phase 1 scaffolding
  exists.

## Open question for user review

Confirm Neon project region and whether a custom domain is already owned
for `web`/`api` production hosts (needed for Phase 11 deployment docs).
