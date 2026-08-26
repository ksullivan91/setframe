import { test as base, type Page } from '@playwright/test';
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { readFileSync } from 'node:fs';

/**
 * Signing the UX reviewer in, unattended.
 *
 * This is the load-bearing piece of the whole review system: a reviewer that
 * cannot reach an authenticated route can only speculate from screenshots,
 * which is exactly what this system exists to stop doing.
 *
 * `docs/design/design-review-account.md` recorded this as unsolved — driving
 * Clerk's multi-step form over CDP set fields visually while the form still
 * considered them empty. The fix is not to drive the form at all. Clerk's own
 * client API is scriptable; the form was never the thing standing in the way.
 *
 * Two details make it work, and both were found by reading the failure rather
 * than guessing:
 *
 * 1. **Land on `/sign-in` first.** Every other route is wrapped in
 *    `<SignedOut><RedirectToSignIn/></SignedOut>`, which bounces to the hosted
 *    Clerk page before any script can run — so sign-in "succeeded" against a
 *    page that was no longer the app. `/sign-in` renders Clerk in-app.
 * 2. **Answer the second factor.** This development instance requires an
 *    email code, so a password alone leaves `signIn` at
 *    `needs_second_factor` with no session — succeeding quietly and doing
 *    nothing, which is why the earlier attempt looked like it had worked.
 *    Because every reviewer address contains `+clerk_test`, the code is the
 *    fixed `424242` and no mailbox is ever involved.
 *
 * Development instance only. These accounts exist on `pk_test`/`sk_test` and
 * have no bearing on production.
 */

/** Clerk's fixed verification code for `+clerk_test` addresses on a dev instance. */
const TEST_EMAIL_CODE = '424242';

export type PersonaKey = 'novice' | 'lifter' | 'analyst';

/**
 * Who the reviewer signs in as.
 *
 * One account per persona rather than one shared login. The premise of the
 * review is that a novice and a data-motivated lifter should meet *different*
 * products, and that only holds if their histories differ; a shared account
 * would make every seeded state fight the previous run's leftovers.
 *
 * Provisioned by `scripts/provision-ux-review-users.mjs`.
 */
export const personaAccounts: Record<PersonaKey, { email: string; label: string }> = {
  novice: {
    email: 'setframe+clerk_test+ux-novice@example.com',
    label: 'Novice fitness user',
  },
  lifter: {
    email: 'setframe+clerk_test+ux-lifter@example.com',
    label: 'Experienced lifter',
  },
  analyst: {
    email: 'setframe+clerk_test+ux-analyst@example.com',
    label: 'Data-motivated user',
  },
};

function envFrom(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) out[match[1]!] = match[2]!.replace(/^["']|["']$/g, '');
  }
  return out;
}

/**
 * Clerk's keys live in the apps' own gitignored `.env` files rather than in
 * the shell, so they are read from there rather than requiring every runner
 * to re-export them.
 */
export function loadClerkEnv(): { password: string } {
  const web = envFrom(new URL('../../.env', import.meta.url).pathname);
  const api = envFrom(new URL('../../../api/.env', import.meta.url).pathname);

  process.env.CLERK_PUBLISHABLE_KEY ??= web.VITE_CLERK_PUBLISHABLE_KEY ?? '';
  process.env.CLERK_SECRET_KEY ??= api.CLERK_SECRET_KEY ?? '';

  const password = process.env.UX_REVIEW_PASSWORD ?? web.UX_REVIEW_PASSWORD ?? '';
  if (!password) {
    throw new Error(
      'UX_REVIEW_PASSWORD is not set. Run scripts/provision-ux-review-users.mjs, which writes it to apps/web/.env.',
    );
  }
  if (!process.env.CLERK_SECRET_KEY?.startsWith('sk_test_')) {
    throw new Error('Refusing to run: CLERK_SECRET_KEY is not a development key.');
  }
  return { password };
}

/** Signs `page` in as one persona and leaves it on an authenticated route. */
export async function signInAs(page: Page, persona: PersonaKey, landOn = '/today'): Promise<void> {
  const { password } = loadClerkEnv();
  const account = personaAccounts[persona];

  await setupClerkTestingToken({ page });
  await page.goto('/sign-in');
  await page.waitForFunction(() => Boolean((window as never as { Clerk?: { loaded?: boolean } }).Clerk?.loaded), null, {
    timeout: 30_000,
  });

  const outcome = await page.evaluate(
    async ({ identifier, secret, code }) => {
      const clerk = (window as never as { Clerk: any }).Clerk;
      let attempt = await clerk.client.signIn.create({ strategy: 'password', identifier, password: secret });
      if (attempt.status === 'needs_second_factor') {
        attempt = await attempt.prepareSecondFactor({ strategy: 'email_code' });
        attempt = await attempt.attemptSecondFactor({ strategy: 'email_code', code });
      }
      if (attempt.status !== 'complete') return { ok: false as const, status: attempt.status };
      await clerk.setActive({ session: attempt.createdSessionId });
      return { ok: true as const, status: attempt.status };
    },
    { identifier: account.email, secret: password, code: TEST_EMAIL_CODE },
  );

  if (!outcome.ok) {
    // Naming the status matters: `needs_second_factor` and `needs_identifier`
    // are different instance settings with different fixes, and a bare
    // "sign-in failed" sent the last attempt down the wrong path entirely.
    throw new Error(`Clerk sign-in did not complete for ${persona} (status: ${outcome.status}).`);
  }

  await page.goto(landOn);
  await page.waitForLoadState('networkidle');
}

/** Playwright's `test`, with `clerkSetup` already run once per worker. */
export const test = base.extend<Record<string, never>>({});

test.beforeAll(async () => {
  loadClerkEnv();
  await clerkSetup();
});

export { expect } from '@playwright/test';
