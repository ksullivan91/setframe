import { expect } from '@playwright/test';
import { test, signInAs } from '../ux/auth';

/**
 * Loading states across the Training v2 surfaces.
 *
 * The bug these pin, reported from production: opening a workout for the
 * first time showed "Nothing in here yet" for a second or two before the
 * exercises appeared. An empty state is a **claim about the data** — showing
 * one while the query is in flight reads as data loss, not as loading.
 *
 * The same defect was present on the week strip (every day briefly "Rest"),
 * the schedule, the plans list and the exercise picker.
 *
 * Each test slows the mock reads so the loading frame is observable at all.
 * **`page.route` cannot do this**: MSW runs as a service worker and
 * intercepts fetch before Playwright sees it, so a route stub silently does
 * nothing — the same trap that `mock-control.ts` was written to work around.
 */

test.use({ viewport: { width: 390, height: 844 } });

/** Holds the mock reads open long enough for a loading frame to be seen. */
async function slowReads(page: import('@playwright/test').Page, ms = 1500) {
  await page.evaluate((delay) => {
    (window as unknown as { __setframeMocks?: { setSlowReads: (ms: number) => void } })
      .__setframeMocks?.setSlowReads(delay);
  }, ms);
}

/** An in-progress session with nothing in it, so `+ Add exercise` is present. */
const EMPTY_SESSION = {
  id: 'session-loading',
  userId: '10000000-0000-0000-0000-000000000001',
  templateId: null,
  localDate: new Date().toISOString().slice(0, 10),
  timezone: 'America/Chicago',
  status: 'in_progress',
  startedAt: new Date().toISOString(),
  completedAt: null,
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  exercises: [],
};

test.describe('training loading states', () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { __setframeMocks?: { reset: () => void } }).__setframeMocks?.reset();
    });
  });

  test('a workout never claims to be empty while it is still loading', async ({ page }) => {
    await signInAs(page, 'lifter', '/training');
    await expect(page.locator('[data-testid^="workout-row-"]').first()).toBeVisible();
    await slowReads(page);

    await page.locator('[data-testid^="workout-row-"]').first().click();

    /* The skeleton is up and the empty-state copy is nowhere on screen. */
    await expect(page.getByTestId('editor-rows-skeleton')).toBeVisible();
    await expect(page.getByTestId('workout-editor')).not.toContainText('Nothing in here yet');

    /* And it resolves into real rows rather than into the empty state. */
    await expect(page.locator('[data-testid^="editor-row-"]').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('editor-rows-skeleton')).toHaveCount(0);
  });

  test('the week strip does not claim a full week is all rest while loading', async ({ page }) => {
    /* Worse than empty: it briefly asserts something false about a week the
       user has actually scheduled. */
    await signInAs(page, 'lifter', '/training');
    await slowReads(page);
    await page.reload();

    await expect(page.getByTestId('week-strip-skeleton')).toBeVisible();
    await expect(page.getByTestId('this-week-card')).not.toContainText('Rest');

    await expect(page.locator('[data-testid^="week-day-"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('the workouts card does not claim an empty plan while loading', async ({ page }) => {
    await signInAs(page, 'lifter', '/training');
    await slowReads(page);
    await page.reload();

    await expect(page.getByTestId('list-rows-skeleton')).toBeVisible();
    await expect(page.getByTestId('workouts-card')).not.toContainText('Nothing in this plan yet');
  });

  test('the schedule does not read as seven rest days while loading', async ({ page }) => {
    await signInAs(page, 'lifter', '/training/schedule');
    await slowReads(page);
    await page.reload();

    await expect(page.getByTestId('schedule-days-skeleton')).toBeVisible();
    await expect(page.getByTestId('weekly-template-card')).not.toContainText('Rest');
  });

  test('the picker does not say nothing matches while the catalogue loads', async ({ page }) => {
    /* Driven from the logger rather than the editor: the editor fetches the
       catalogue on mount, so by the time its picker opens the data is already
       cached and there is correctly nothing to load. The logger's query is
       `enabled: pickerOpen`, which is where a real first-open wait exists. */
    await signInAs(page, 'lifter', '/today');
    await page.evaluate((session) => {
      const mocks = (window as unknown as {
        __setframeMocks?: { setSession: (s: unknown) => void; setSlowReads: (ms: number) => void };
      }).__setframeMocks;
      mocks?.setSession(session);
      mocks?.setSlowReads(1500);
    }, EMPTY_SESSION);

    await page.goto('/workout/session-loading');
    await expect(page.getByTestId('workout-v2-loading')).toBeVisible();

    await page.getByRole('button', { name: '+ Add exercise' }).click();
    await expect(page.getByTestId('picker-rows-skeleton')).toBeVisible();
    await expect(page.getByTestId('exercise-picker')).not.toContainText('Nothing matches');
  });

  test('the logger shows content-shaped loading, not a bare word', async ({ page }) => {
    /* It previously rendered a lone "Loading…" title with no back affordance
       and no body — inconsistent with every other loading state in the app. */
    await signInAs(page, 'lifter', '/today');
    await page.evaluate((session) => {
      const mocks = (window as unknown as {
        __setframeMocks?: { setSession: (s: unknown) => void; setSlowReads: (ms: number) => void };
      }).__setframeMocks;
      mocks?.setSession(session);
      mocks?.setSlowReads(1500);
    }, EMPTY_SESSION);

    await page.goto('/workout/session-loading');
    await expect(page.getByTestId('exercise-cards-skeleton')).toBeVisible();
    /* The header is chrome, not data, so a back affordance exists throughout. */
    await expect(page.getByRole('button', { name: 'Back to Today' })).toBeVisible();
  });

  test('skeletons do not shift the layout when they resolve', async ({ page }) => {
    /* The point of a skeleton is that content lands where the placeholder
       was. A skeleton of the wrong height makes the page jump at the moment
       the user starts reading it. */
    await signInAs(page, 'lifter', '/training');
    await page.locator('[data-testid^="workout-row-"]').first().click();
    await expect(page.locator('[data-testid^="editor-row-"]').first()).toBeVisible();

    const realHeight = await page
      .locator('[data-testid^="editor-row-"]')
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(Math.round(realHeight)).toBe(64);
  });
});
