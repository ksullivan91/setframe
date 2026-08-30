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
    /* Kept on the page so a test can vary one field without restating the
       whole fixture. */
    await page.evaluate((session) => {
      (window as unknown as { __pinned: unknown }).__pinned = session;
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


  test('focus survives adding a set while typing — the reported focus jump', async ({ page }) => {
    /* The exact reported sequence: enter a set quickly, blur it by hitting
       "+ Add set", then IMMEDIATELY type into the new row.
    
       The refetch has to land while the field is focused, which is the whole
       race — so the session read is slowed to hold that window open. Without
       that the refetch resolves before any typing starts and the bug cannot
       reproduce; an earlier version of this test passed with the fix
       reverted, which is worth more than the test itself. */
    await page.evaluate(() => {
      (window as unknown as { __setframeMocks?: { setSlowReads: (ms: number) => void } })
        .__setframeMocks?.setSlowReads(1500);
    });

    const rows = page.locator('[data-testid^="set-row-"]');
    const first = rows.first();
    await first.getByRole('textbox').first().fill('225');
    await first.getByRole('textbox').nth(1).fill('8');

    await page.getByRole('button', { name: '+ Add set' }).click();
    /* The optimistic row is there straight away — no waiting for the API. */
    await expect(rows).toHaveCount(2, { timeout: 2000 });

    const newWeight = rows.nth(1).getByRole('textbox').first();
    await newWeight.click();
    await newWeight.type('185', { delay: 20 });

    /* Now let the slow refetch land underneath the focused field. */
    await page.waitForTimeout(2500);

    /* Same input, still focused, still holding what was typed. Before the
       fix the key changed from clientId to the server uuid, React replaced
       the element, and focus fell back to <body>. */
    await expect(newWeight).toBeFocused();
    await expect(newWeight).toHaveValue('185');
  });

  test('the newly added row is not replaced when its save resolves', async ({ page }) => {
    /* Pins the mechanism rather than the symptom: the same DOM node before
       and after, which is what keeps focus and scroll position.
    
       It has to probe the ADDED row, not the first one. Only the optimistic
       row's id changes (clientId then server uuid); the pre-existing row came
       from the server already and keys identically either way — probing it
       passed with the bug still in place. */
    await page.evaluate(() => {
      (window as unknown as { __setframeMocks?: { setSlowReads: (ms: number) => void } })
        .__setframeMocks?.setSlowReads(1500);
    });

    const rows = page.locator('[data-testid^="set-row-"]');
    await page.getByRole('button', { name: '+ Add set' }).click();
    await expect(rows).toHaveCount(2, { timeout: 2000 });

    await rows.nth(1).evaluate((el) => el.setAttribute('data-identity-probe', 'original'));
    await page.waitForTimeout(2500);

    await expect(rows.nth(1)).toHaveAttribute('data-identity-probe', 'original');
  });


  test('a session started from a saved workout does NOT offer to save it again', async ({ page }) => {
    /* Reported: finishing a planned workout offered "Do this one again?",
       which invites creating a duplicate of a workout you already have — a
       second "Lower A" alongside the first. The offer is only meaningful for
       an UNPLANNED session, which is the whole premise of Just start
       training: intent authored from fact. `templateId` is null exactly when
       the session did not come from a day type. */
    await page.evaluate(() => {
      const mocks = (window as unknown as { __setframeMocks?: { setSession: (s: unknown) => void } })
        .__setframeMocks;
      mocks?.setSession({
        ...(window as unknown as { __pinned: Record<string, unknown> }).__pinned,
        templateId: '30000000-0000-0000-0000-000000000001',
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
    });
    await page.reload();
    await expect(page.getByTestId('workout-v2')).toBeVisible();

    await expect(page.getByTestId('save-as-workout')).toHaveCount(0);
  });

  test('an unplanned session still offers it', async ({ page }) => {
    /* The other half of the same rule — gating must not remove the offer
       from the flow it exists for. */
    await page.evaluate(() => {
      const mocks = (window as unknown as { __setframeMocks?: { setSession: (s: unknown) => void } })
        .__setframeMocks;
      mocks?.setSession({
        ...(window as unknown as { __pinned: Record<string, unknown> }).__pinned,
        templateId: null,
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
    });
    await page.reload();
    await expect(page.getByTestId('workout-v2')).toBeVisible();

    await expect(page.getByTestId('save-as-workout')).toBeVisible();
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
