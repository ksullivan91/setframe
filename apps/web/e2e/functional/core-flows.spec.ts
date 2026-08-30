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
  /**
   * SKIPPED, and it marks an open product question rather than a broken test.
   *
   * Quick Log (stories 58/59) applied one set of values to every planned set
   * in a single action. The v2 table logger has no equivalent — the design
   * never accounted for it — so this asserts a feature the canonical page no
   * longer has.
   *
   * v2 addresses part of the same need differently: tapping PREVIOUS copies
   * last session's numbers into a row. But that is per row, and Quick Log's
   * whole point was one action for the whole exercise.
   *
   * Decide before v1 is deleted: bring Quick Log forward to v2, accept the
   * regression, or conclude that per-row copy plus autosave makes it
   * unnecessary. Do not simply delete this test.
   */
  test.skip('quick log persists every planned set in one action', async ({ page }) => {
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
    /* Stories 42A/42B, carried forward to the v2 table logger (ADR 0011).
       The intent is unchanged — completed must not mean read-only — but v2
       satisfies it differently and more completely: there is no disabled
       state to check for, because every row stays editable under the same
       blur rule and corrections cost one tap. */
    await signInAs(page, 'analyst', '/today');
    await page.getByRole('button', { name: /review workout/i }).click();
    await page.waitForURL(/\/workout\//);

    await expect(page.getByRole('heading', { name: /workout complete/i })).toBeVisible();
    await expect(page.getByTestId('completion-banner')).toBeVisible();

    /* Editable, not frozen: the inputs are live and adding a set is offered.
       v1 removed Add set on completion; v2 keeps it, because logging a set
       you forgot is the most common correction there is. */
    await expect(page.getByRole('button', { name: /^\+ Add set$/ })).not.toHaveCount(0);
    const firstInput = page.locator('[data-testid^="set-input-"]').first();
    await expect(firstInput).toBeEditable();

    /* v1's per-set controls are gone entirely rather than disabled. */
    await expect(page.getByRole('button', { name: /^Duplicate set/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Delete set/ })).toHaveCount(0);
  });
});

test.describe('training', () => {
  test('the three planning questions are answered on one page, without tabs', async ({ page }) => {
    await signInAs(page, 'lifter', '/training');

    /* Training v2 (story 76) deletes the Programs / Workouts / Schedule tabs.
       They were named after tables — training_program, day_type and
       program_schedule_slot — so the user had to choose which part of our
       data model they wanted before they could act. The page now answers the
       three questions in the order people ask them, all visible at once. */
    await expect(page.getByTestId('active-program-card')).toBeVisible();
    await expect(page.getByTestId('this-week-card')).toBeVisible();
    await expect(page.getByTestId('workouts-card')).toBeVisible();

    /* The tabs themselves must be gone, not merely unused. */
    await expect(page.getByRole('tab')).toHaveCount(0);
  });

  test('a program lists its workouts, each row tappable as a whole', async ({ page }) => {
    await signInAs(page, 'lifter', '/training');

    /* The whole row is the target, not just the chevron — the interaction
       spec calls this out because the page it replaces made only the chevron
       hittable. */
    const row = page.getByTestId(/^workout-row-/).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('Day 1 — Push');
    await expect(row).toContainText('6 exercises');
    await expect(page.getByRole('button', { name: '+ New' })).toBeVisible();
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
