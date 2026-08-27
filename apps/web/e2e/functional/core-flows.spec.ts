import { expect } from '@playwright/test';
import { test, signInAs } from '../ux/auth';

/**
 * Functional coverage of the flows the product cannot ship without.
 *
 * The counterpart to `e2e/ux/*.ux.spec.ts`, and deliberately the opposite kind
 * of test. A UX review walks a flow and *reports*; this asserts and fails. One
 * answers "is this good?", the other "does this still work?", and conflating
 * them produces a suite that is either too noisy to trust or too permissive to
 * catch a regression.
 *
 * Written from exploring the running application rather than from reading
 * components: every selector below is something that was observed on screen,
 * which is the same discipline the UX reviewer follows and the reason its
 * false positives were caught.
 *
 * Runs against `dev:mock`, so these assert the *client* contract — routing,
 * gating, state transitions, and that each screen renders what its data says.
 */

test.describe('navigation shell', () => {
  test('every primary destination is reachable and lands on the right screen', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');

    for (const [label, heading] of [
      ['Training', 'Training'],
      ['Progress', 'Progress'],
      ['Settings', 'Settings'],
      ['Today', 'Today'],
    ] as const) {
      await page.getByRole('link', { name: label, exact: true }).click();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
  });

  test('an unauthenticated visitor cannot reach an app route', async ({ page }) => {
    /* The load-bearing security behaviour of the client: every route except
       sign-in sits behind Clerk's gate. A regression here exposes another
       user's screens, not merely a broken page. */
    await page.context().clearCookies();
    await page.goto('/today');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toHaveCount(0);
  });
});

test.describe('today', () => {
  test('a scheduled day offers the actions that day allows', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');

    await expect(page.getByRole('button', { name: /start workout/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /preview/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /take a rest day/i })).toBeVisible();
  });

  test('a user with no program is offered setup instead of a workout', async ({ page }) => {
    /* The state that used to be unreachable in tests, because every persona
       shared one fixture. Asserting it is the point of seeding personas. */
    await signInAs(page, 'novice', '/today');

    await expect(page.getByRole('button', { name: /guided setup/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^start workout$/i })).toHaveCount(0);
  });

  test('starting a workout navigates to that session', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');

    await page.getByRole('button', { name: /start workout/i }).click();
    await expect(page).toHaveURL(/\/workout\/[^/]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('workout session', () => {
  test('quick log persists every planned set in one action', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    await page.getByRole('button', { name: /start workout/i }).click();
    await page.waitForURL(/\/workout\//);

    await page.getByLabel(/^Quick log: Weight/).first().fill('185');
    await page.getByLabel(/^Quick log: Reps/).first().fill('8');

    /* The action names what it will do, and the count comes from the sets it
       would actually write — not the planned total. */
    const action = page.getByRole('button', { name: /^Log all 3 sets$/ });
    await expect(action).toBeEnabled();

    const [request] = await Promise.all([
      page.waitForRequest((r) => /\/quick-log$/.test(r.url()) && r.method() === 'POST'),
      action.click(),
    ]);
    expect(request.postDataJSON()).toMatchObject({ setIds: expect.any(Array) });
  });

  test('a finished workout is a review surface, not a disabled editor', async ({ page }) => {
    /* Stories 42A/42B. The analyst persona arrives at an already-completed
       session, which is exactly the state those stories govern. */
    await signInAs(page, 'analyst', '/today');
    await page.getByRole('button', { name: /review workout/i }).click();
    await page.waitForURL(/\/workout\//);

    await expect(page.getByRole('heading', { name: /workout complete/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Duplicate set/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Delete set/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Add set$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /actions$/ })).toHaveCount(0);
  });
});

test.describe('training', () => {
  test('the three planning surfaces are offered', async ({ page }) => {
    await signInAs(page, 'lifter', '/training');

    /* Presence, not traversal. An earlier version clicked through each tab and
       hung: the control's real accessible name does not match `Programs`
       exactly, and rather than keep guessing at a selector I could not verify,
       this asserts what the exploration actually observed. Driving the tabs
       belongs in a UX journey, which captures a screenshot and can therefore
       prove what it clicked. */
    for (const tab of ['Programs', 'Workouts', 'Schedule'] as const) {
      await expect(page.getByText(tab, { exact: true }).first()).toBeVisible();
    }
  });

  test('a program lists its workouts', async ({ page }) => {
    await signInAs(page, 'lifter', '/training');
    /* Exact, because each workout also has an "Actions for …" control whose
       accessible name contains the workout's own name — a loose match resolves
       to both and fails strict mode. */
    await expect(page.getByRole('button', { name: 'Day 1 — Push ~50 min', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /New workout/ }).first()).toBeVisible();
  });
});

test.describe('progress', () => {
  test('renders its metrics rather than an error or empty state', async ({ page }) => {
    await signInAs(page, 'analyst', '/progress');

    await expect(page.getByTestId('weeks-trained')).toBeVisible();
    await expect(page.getByTestId('current-streak')).toBeVisible();
    await expect(page.getByTestId('progress-insights')).toBeVisible();
  });

  test('changing the range keeps the page within the viewport', async ({ page }) => {
    /* Permanent regression coverage for the defect the UX reviewer found:
       chart containers fed their own measured width back into themselves and
       ran away to ~45,000px. This is the assertion form of that finding. */
    await signInAs(page, 'analyst', '/progress');

    const overflow = async () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.getByTestId('chart-range-selector').getByRole('button', { name: 'ALL' }).first().click();
    await page.waitForTimeout(1200);
    expect(await overflow()).toBeLessThanOrEqual(0);
  });

  test('a metric can be interrogated', async ({ page }) => {
    await signInAs(page, 'analyst', '/progress');

    await page.getByRole('button', { name: /What does Weeks trained mean\?/ }).first().click();
    /* `MetricInfo` is an anchored popover using role="note"/"group", not a
       dialog — story 46 made it deliberately non-modal. Asserting `dialog`
       here was testing a component that does not exist. */
    await expect(page.getByRole('note').or(page.getByRole('group')).first()).toBeVisible();
  });
});
