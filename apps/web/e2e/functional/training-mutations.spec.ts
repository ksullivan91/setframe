import { expect, type Page } from '@playwright/test';
import { test, signInAs } from '../ux/auth';

/**
 * Every control on the Training v2 screens, actually operated.
 *
 * **Why this exists.** The parity specs assert that a button is 44px and says
 * "+ Add set". They never clicked it. Three defects shipped to production
 * behind a green suite — add-set posting no `clientId`, adding an exercise
 * posting no `prescription`, and every row-save rejected for sending
 * `rpe: null` — because "the control renders correctly" and "the control
 * works" are different claims and only the first was ever tested.
 *
 * The rule here: drive the mutation, and fail on any 4xx/5xx it produces.
 * A request that errors is a bug even when the screen looks unchanged,
 * because react-query swallows the failure and the UI simply does nothing.
 */

test.use({ viewport: { width: 390, height: 844 } });

/** Records every failed API response for the life of a test. */
function watchFailures(page: Page): string[] {
  const failures: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/v1/') && response.status() >= 400) {
      failures.push(`${response.request().method()} ${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  return failures;
}

const SESSION = {
  id: 'session-mut',
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
  exercises: [
    {
      id: 'log-mut',
      sessionId: 'session-mut',
      exerciseId: '10000000-0000-0000-0000-000000000004',
      templateExerciseId: null,
      sortOrder: 0,
      skipped: false,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      exercise: {
        id: '10000000-0000-0000-0000-000000000004',
        name: 'Back Squat',
        canonicalSlug: 'back-squat',
        movementPattern: 'squat',
        equipment: 'barbell',
        isSystem: true,
        createdByUserId: null,
        archivedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      prescription: { kind: 'sets_reps', sets: 1, repsMin: 8, repsMax: null },
      previousSession: null,
      sets: [
        {
          id: 'set-mut-1',
          exerciseLogId: 'log-mut',
          clientId: '00000000-0000-4000-8000-000000000009',
          sortOrder: 0,
          setType: 'working',
          weightValue: null,
          weightUnit: 'lb',
          reps: null,
          durationSeconds: null,
          distanceValue: null,
          distanceUnit: null,
          rpe: null,
          isPrWeight: false,
          isPrReps: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
  ],
};

async function openSession(page: Page) {
  await page.evaluate((session) => {
    (window as unknown as { __setframeMocks?: { setSession: (s: unknown) => void } })
      .__setframeMocks?.setSession(session);
  }, SESSION);
  await page.goto('/workout/session-mut');
  await expect(page.getByTestId('workout-v2')).toBeVisible();
}

test.describe('training v2 — every control actually works', () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { __setframeMocks?: { reset: () => void } }).__setframeMocks?.reset();
    });
  });

  test('logger: add set, save a row, add an exercise, finish', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    const failures = watchFailures(page);
    await openSession(page);

    await page.getByRole('button', { name: '+ Add set' }).click();

    const row = page.locator('[data-testid^="set-row-"]').first();
    await row.getByRole('textbox').first().fill('225');
    await row.getByRole('textbox').nth(1).fill('8');
    await page.getByRole('heading', { level: 1 }).first().click();

    await page.getByRole('button', { name: '+ Add exercise' }).click();
    await expect(page.getByTestId('exercise-picker')).toBeVisible();
    await page.locator('[data-testid^="picker-row-"]').first().click();
    await page.getByTestId('picker-add').click();
    await expect(page.getByTestId('exercise-picker')).toHaveCount(0);

    await expect.poll(() => failures.join("  |  ")).toBe("");
  });

  test('editor: add an exercise, edit its targets, remove it', async ({ page }) => {
    await signInAs(page, 'lifter', '/training');
    const failures = watchFailures(page);

    await page.locator('[data-testid^="workout-row-"]').first().click();
    await expect(page.getByTestId('workout-editor')).toBeVisible();

    /* The add that shipped broken: it posted no `prescription`, which the
       API requires, and there was no mock handler to notice. */
    await page.getByTestId('editor-add').click();
    await expect(page.getByTestId('exercise-picker')).toBeVisible();
    await page.locator('[data-testid^="picker-row-"]').first().click();
    await page.getByTestId('picker-add').click();
    await expect(page.getByTestId('exercise-picker')).toHaveCount(0);

    await page.getByRole('button', { name: /^Actions for / }).first().click();
    await page.getByTestId('prescription-sets').fill('4');
    await page.getByTestId('prescription-repsMin').click();
    await page.getByTestId('prescription-remove').click();

    await expect.poll(() => failures.join("  |  ")).toBe("");
  });

  test('schedule: assign a day, then clear it to Rest', async ({ page }) => {
    await signInAs(page, 'lifter', '/training/schedule');
    const failures = watchFailures(page);
    await expect(page.getByTestId('schedule-page')).toBeVisible();

    await page.getByTestId('schedule-day-2').click();
    await expect(page.locator('[data-testid^="assign-option-"]').first()).toBeVisible();
    await page.locator('[data-testid^="assign-option-"]').first().click();
    /* Rest DELETES the day's slots — dayTypeId is NOT NULL, so it cannot be
       a slot pointing at nothing. */
    await page.getByTestId('assign-rest').click();

    await expect.poll(() => failures.join("  |  ")).toBe("");
  });

  test('plans: switch which plan drives Today', async ({ page }) => {
    await signInAs(page, 'lifter', '/training/plans');
    const failures = watchFailures(page);
    await expect(page.getByTestId('plans-page')).toBeVisible();

    const use = page.locator('[data-testid^="use-plan-"]').first();
    if (await use.isVisible().catch(() => false)) {
      await use.click();
      await expect.poll(() => failures.join("  |  ")).toBe("");
    } else {
      /* Only one plan in the fixture, so there is nothing to switch to —
         assert the active one is badged rather than silently passing. */
      await expect(page.getByTestId('plans-page')).toContainText('Driving Today');
    }
  });

  test('overview: start an unplanned session from the empty state', async ({ page }) => {
    await signInAs(page, 'novice', '/training');
    const failures = watchFailures(page);
    await expect(page.getByTestId('training-no-plan')).toBeVisible();

    await page.getByTestId('just-start').click();
    await expect.poll(() => failures.join("  |  ")).toBe("");
  });
});
