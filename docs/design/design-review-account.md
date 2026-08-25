# Design-review test account

A disposable Clerk user that exists so web and mobile screens can be opened
and compared without a real sign-in.

## Why it exists

Every authenticated route on web sits behind Clerk's `<SignedIn>` gate, and
`dev:mock` replaces the API but not auth. Reaching `/training` or
`/progress` to compare them against their mobile counterparts meant signing
in as a real user through an emailed verification code — enough friction
that, in practice, the comparison did not happen. A mobile Training screen
that looked nothing like web shipped as a result (see
`mobile-web-training-parity.md`).

An auth **bypass** was tried first and deliberately removed: however tightly
guarded, that is not something to leave in a codebase. A real account with
a deterministic sign-in is the honest version of the same convenience.

## The account

- **Email:** `setframe+clerk_test@example.com`
- **Password:** in `apps/web/.env` and `apps/mobile/.env` as
  `DESIGN_REVIEW_PASSWORD` — both gitignored. It is **not** committed, and
  should not be.
- **User id:** `user_3IQY21mN5edx8jtqZ7qR0KkNnzO`
- Email is pre-verified, so no verification step is required at sign-in.

## Why `+clerk_test` matters

On a **development** instance, Clerk treats any address containing
`+clerk_test` as a test address: verification uses the fixed code
`424242` rather than sending real mail. So even if the instance later
requires an email code as a second factor — it currently does, which is
what `needs_second_factor` means here and is an *instance* setting, not
2FA on anyone's account — that step stays deterministic and scriptable.

This applies only to development instances (`pk_test`). It does nothing on
production, which is a separate Clerk instance.

## Scope and safety

- Development instance only. No bearing on production.
- Owns no meaningful data; safe to delete and recreate at any time.
- `publicMetadata.purpose` marks it as a design-review account so it is not
  mistaken for a real user.

Delete it with the already-installed `@clerk/backend` and the secret key
from `apps/api/.env`:

```js
const { createClerkClient } = require('@clerk/backend');
const c = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
await c.users.deleteUser('user_3IQY21mN5edx8jtqZ7qR0KkNnzO');
```

## Using it

Web, at a mobile viewport:

```bash
npm run dev:mock --workspace=@setframe/web   # MSW mocks, no backend needed
```

then sign in with the credentials above. Chrome can be driven over CDP with
no npm dependency — Node 22 exposes a global `WebSocket`, so
`--headless=new --remote-debugging-port=9222` plus
`Emulation.setDeviceMetricsOverride` at 390×844 and `Page.captureScreenshot`
is sufficient. Playwright is deliberately not a dependency of this repo
(see `Backlog/WAIT-automated-visual-and-e2e-testing.md`).

Mobile: the Simulator has no tap primitive, so reaching a screen other than
the default still requires temporarily repointing `app/index.tsx` and
reinstalling to clear expo-router's persisted navigation state. Revert any
such change before committing.
