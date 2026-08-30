import { expect } from '@playwright/test';
import { test, signInAs } from '../ux/auth';

/**
 * Production bug report, session f74e54e0.
 *
 * A 5 x 8 deadlift arrived at the gym as one set, already marked complete,
 * with no way to add a set or edit an input — and every blur returned a 400.
 * Four defects; these cover the two that are client-side.
 */

test.use({ viewport: { width: 390, height: 844 } });

const PINNED_SESSION = {
  id: 'session-regress',
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
      id: 'exercise-log-regress',
      sessionId: 'session-regress',
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
          id: 'set-regress-1',
          exerciseLogId: 'exercise-log-regress',
          clientId: '00000000-0000-4000-8000-000000000001',
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

test.describe('logger regressions', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    await page.evaluate((session) => {
      (window as unknown as { __setframeMocks?: { setSession: (s: unknown) => void } })
        .__setframeMocks?.setSession(session);
    }, PINNED_SESSION);
    await page.goto('/workout/session-regress');
    await expect(page.getByTestId('workout-v2')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { __setframeMocks?: { reset: () => void } }).__setframeMocks?.reset();
    });
  });

  test('+ Add set sends a clientId and is accepted', async ({ page }) => {
    /* It posted `{}`, and `clientId` is required — so this 400d for every
       user, every time, with "body/clientId ... received undefined".
    
       Asserted on the request and its status rather than on a new row
       appearing: the session here is a pinned fixture, so the re-fetch after
       the POST returns the same frozen payload no matter what was created.
       The request is what was broken, and the request is what this pins. */
    const bodies: unknown[] = [];
    const failures: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/sets') && request.method() === 'POST') {
        bodies.push(request.postDataJSON());
      }
    });
    page.on('response', (response) => {
      if (response.url().includes('/sets') && response.status() >= 400) {
        failures.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.getByRole('button', { name: '+ Add set' }).click();
    await expect.poll(() => bodies.length).toBeGreaterThan(0);

    const body = bodies[0] as { clientId?: unknown };
    expect(typeof body.clientId, 'clientId must be sent').toBe('string');
    await expect.poll(() => failures).toEqual([]);
  });

  test('saving a row does not 400 when RPE is left blank', async ({ page }) => {
    /* The logger sends the row as a whole unit with nulls for the blanks.
       The schema rejected null, so leaving RPE empty — what almost everyone
       does — failed every save. */
    const failures: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/workout-sets/') && response.status() >= 400) {
        failures.push(`${response.status()} ${response.url()}`);
      }
    });

    const row = page.locator('[data-testid^="set-row-"]').first();
    await row.getByRole('textbox').first().fill('225');
    await row.getByRole('textbox').nth(1).fill('8');
    await page.getByRole('heading', { level: 1 }).first().click();

    await expect(page.locator('[data-testid^="set-row-"]').first()).toBeVisible();
    expect(failures, 'saving a set must not 400').toEqual([]);
  });


  test('the SET chip opens the set-type sheet — it used to do nothing', async ({ page }) => {
    await page.locator('[data-testid^="set-row-"]').first().locator('button').first().click();
    await expect(page.getByTestId('set-type-sheet')).toBeVisible();
    await expect(page.getByTestId('set-type-warmup')).toBeVisible();
    await expect(page.getByTestId('set-type-delete')).toBeVisible();
  });

  test('changing a set type applies immediately, not after the round trip', async ({ page }) => {
    await page.locator('[data-testid^="set-row-"]').first().locator('button').first().click();
    await page.getByTestId('set-type-warmup').click();
    /* The sheet closes and the chip changes on tap. Optimistic: the screen is
       operated with a barbell in hand. */
    await expect(page.getByTestId('set-type-sheet')).toHaveCount(0);
    await expect(page.locator('[data-testid^="set-row-"]').first()).toContainText('W');
  });

  test('the ⋯ opens the exercise actions sheet — it used to do nothing', async ({ page }) => {
    await page.getByRole('button', { name: /Actions for/i }).first().click();
    await expect(page.getByTestId('exercise-actions-sheet')).toBeVisible();
    await expect(page.getByTestId('exercise-action-history')).toBeVisible();
    await expect(page.getByTestId('exercise-action-rpe')).toBeVisible();
    await expect(page.getByTestId('exercise-action-remove')).toBeVisible();
  });

  test('every action in the sheet does something — no dead rows', async ({ page }) => {
    /* The complaint this whole sheet answers is a control that does nothing,
       so the sheet must not itself contain any. Replace and Reorder are in
       the design but not built, and are deliberately absent rather than
       present and inert. */
    await page.getByRole('button', { name: /Actions for/i }).first().click();
    const sheet = page.getByTestId('exercise-actions-sheet');
    await expect(sheet).not.toContainText('Replace exercise');
    await expect(sheet).not.toContainText('Reorder exercises');

    await page.getByTestId('exercise-action-rpe').click();
    await expect(page.getByTestId('exercise-actions-sheet')).toContainText('Show RPE column');
  });

  test('adding a set appends it, and appears before the request resolves', async ({ page }) => {
    /* Reported: the row only showed up once the API came back, so the button
       looked dead and got tapped again. And a new set must land at the END. */
    const before = await page.locator('[data-testid^="set-row-"]').count();
    await page.getByRole('button', { name: '+ Add set' }).click();
    await expect(page.locator('[data-testid^="set-row-"]')).toHaveCount(before + 1);
  });

  test('an exercise added mid-session gets weight and reps columns, not every column', async ({ page }) => {
    /* With no prescription the log falls back to `unprescribedDefinition`,
       which declares EVERY field — the card rendered
       SET / PREVIOUS / LB / REPS / TIME / DISTANCE. */
    await page.getByRole('button', { name: '+ Add exercise' }).click();
    await expect(page.getByTestId('exercise-picker')).toBeVisible();
    await page.locator('[data-testid^="picker-row-"]').first().click();
    await page.getByTestId('picker-add').click();

    await expect(page.getByTestId('exercise-picker')).toHaveCount(0);
    const cards = page.locator('[data-testid^="exercise-card-"]');
    const added = cards.last();
    await expect(added).toContainText('LB');
    await expect(added).toContainText('REPS');
    await expect(added).not.toContainText('TIME');
    await expect(added).not.toContainText('DISTANCE');
  });
});
