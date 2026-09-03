# ADR 0015: The API Image Installs Only What the API Needs

Status: Accepted. Date: 2026-09-03.

## Context

The Railway build for `apps/api` failed on 2026-09-03:

```
RUN npm install                                            4m 58s
Build Failed: build daemon returned an error
  < failed to solve: DeadlineExceeded: context deadline exceeded >
```

`railway.json` ran a bare `npm install` at the repo root. npm workspaces
resolve the *whole* tree from there, so the API's image was installing
`apps/mobile` — Expo, React Native, the Metro toolchain — and `apps/web`
alongside it. Locally that tree is **1.3 GB**.

None of it is reachable from the API. `apps/api` depends on four
workspaces: `@setframe/config`, `@setframe/database`, `@setframe/domain`
and `@setframe/schemas`.

The failure was a timeout rather than a compile error, which is why it
appeared without any change to the API's own code or config: the install
had been slowly approaching the deadline and this deploy crossed it. It
would have happened on the next deploy regardless of what that deploy
contained.

The `EBADENGINE` warnings in the same log are unrelated noise. Babel 8
asks for Node `^22.18.0 || >=24.11.0` and Railway runs 24.10; they are
warnings, and nothing in the API's path imports Babel at runtime.

## Decision

The build command installs the API and its four workspace dependencies,
with `--include-workspace-root` so the root's own dependencies and the npm
workspace links are still created:

```
npm install --include-workspace-root \
  --workspace=@setframe/api \
  --workspace=@setframe/config \
  --workspace=@setframe/database \
  --workspace=@setframe/domain \
  --workspace=@setframe/schemas
```

`--omit=dev` is deliberately **not** used. `apps/api`'s start command is
`tsx src/index.ts` — it runs TypeScript directly rather than a compiled
bundle, so `tsx` and the type packages it loads are needed at runtime even
though they are devDependencies. Omitting them produces an image that
installs faster and then cannot boot.

## Consequences

- Adding a workspace that the API imports means adding it here too.
  Forgetting produces a module-not-found at boot rather than at build,
  which is worse; the failure is loud but late.
- The mobile and web workspaces are never installed in the API image, so a
  dependency change in either cannot break an API deploy.
- This does not address the root cause of a 1.3 GB tree, only its reach.
  If the API's own install ever approaches the deadline, the next move is
  a compiled build (`tsc -b`, already defined) plus `--omit=dev`, which
  would need the start command to run the emitted JavaScript.

## Alternatives considered

**Raise the build timeout.** Railway's deadline is not configurable on
this plan, and the install would keep growing.

**Split the API into its own repository.** Rejected — the shared Zod
schemas and domain package are the reason this is a monorepo, and
duplicating them is exactly the drift they exist to prevent.
