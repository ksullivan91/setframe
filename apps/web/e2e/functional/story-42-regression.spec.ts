import { expect } from '@playwright/test';
import { test, signInAs } from '../ux/auth';

/**
 * Story 42.7 — the regression matrix.
 *
 * Story 42 has regressed every time one of its pieces changed, because each
 * fix was verified against the one representation the shared fixture happened
 * to use. These scenarios pin the domain rules across representations and
 * across the network conditions a gym actually has.
 *
 * Fixtures are stubbed per test at the route level rather than by editing the
 * shared MSW handlers. Two reasons: a scenario can choose its own
 * representation without every other test inheriting it, and latency and
 * failure become things the test controls rather than things it hopes for.
 *
 * These assert *state*, not screenshots — the pack is explicit that a green
 * pixel is not evidence a set was persisted.
 */

const SESSION_ID = 'session-42';

type Prescription = Record<string, unknown>;

function sessionFixture(options: {
  prescription: Prescription;
  sets: Array<Record<string, unknown>>;
  status?: 'in_progress' | 'completed';
  name?: string;
}) {
  const now = new Date().toISOString();
  return {
    id: SESSION_ID,
    userId: '00000000-0000-0000-0000-000000000001',
    templateId: 'day-1',
    localDate: now.slice(0, 10),
    timezone: 'America/Chicago',
    status: options.status ?? 'in_progress',
    startedAt: now,
    completedAt: options.status === 'completed' ? now : null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    exercises: [
      {
        id: 'log-1',
        sessionId: SESSION_ID,
        exerciseId: 'ex-1',
        templateExerciseId: null,
        sortOrder: 0,
        skipped: false,
        notes: null,
        createdAt: now,
        updatedAt: now,
        exercise: {
          id: 'ex-1',
          name: options.name ?? 'Barbell Bench Press',
          isCustom: false,
          ownerUserId: null,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        prescription: options.prescription,
        previousSession: null,
        sets: options.sets.map((set, index) => ({
          id: `set-${index + 1}`,
          exerciseLogId: 'log-1',
          clientId: `1111111${index}-1111-4111-8111-111111111111`,
          sortOrder: index,
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
          createdAt: now,
          updatedAt: now,
          ...set,
        })),
      },
    ],
  };
}

/**
 * Opens the detail panel only if it is not already open.
 *
 * A session whose only exercise is complete still seeds that exercise as the
 * active one, so it arrives expanded. Clicking the disclosure unconditionally
 * *collapsed* it, and the assertions that followed were looking for set rows
 * that had just been hidden.
 */
async function ensureExpanded(page: Parameters<typeof signInAs>[0]) {
  const expand = page.getByRole('button', { name: /^Expand / }).first();
  if (await expand.count()) await expand.click();
}

/** Structure-only sets, exactly as session start now creates them (42.1). */
const emptySets = (count: number) => Array.from({ length: count }, () => ({}));

/**
 * Pins the session shape and the save's behaviour.
 *
 * Driven through the mock layer, not `page.route`. MSW runs as a service
 * worker and intercepts `fetch` before the browser's network layer, so
 * Playwright's routing never sees these requests — the first version of this
 * file stubbed nothing and every scenario ran against the shared fixture.
 */
async function stubSession(
  page: Parameters<typeof signInAs>[0],
  fixture: ReturnType<typeof sessionFixture>,
  options: { quickLog?: { delayMs?: number; fail?: boolean } } = {},
) {
  await page.evaluate(
    ({ session, quickLog }) => {
      const control = (window as unknown as { __setframeMocks?: {
        setSession: (s: unknown) => void;
        setQuickLog: (b: unknown) => void;
      } }).__setframeMocks;
      if (!control) throw new Error('Mock control is not exposed — is the app running with VITE_USE_MOCKS?');
      control.setSession(session);
      control.setQuickLog(quickLog);
    },
    { session: fixture, quickLog: options.quickLog ?? undefined },
  );
}

/**
 * v1 ONLY. Skipped since the canonical /workout/:sessionId route began
 * rendering the v2 table logger (ADR 0011).
 *
 * Every assertion here is against v1's accordion UI — "0 of 3 sets complete",
 * the per-set Save control, the quick-log panel — none of which exist in v2
 * by design. Kept rather than deleted because v1 is still in the tree pending
 * approval of v2; delete this spec with the v1 page, and cover the same
 * behaviours for v2 in workout-v2-figma-parity.spec.ts.
 */
test.describe.skip('story 42 regression matrix', () => {
  test.afterEach(async ({ page }) => {
    await page
      .evaluate(() => {
        (window as unknown as { __setframeMocks?: { reset: () => void } }).__setframeMocks?.reset();
      })
      .catch(() => {
        /* The page may already be closed; a failed reset must not mask the
           test's own result. */
      });
  });

  test('A — a fully prescribed workout starts with nothing logged', async ({ page }) => {
    /* The P0. Five of eight representations used to complete on start, so this
       walks several rather than the one the shared fixture happens to use: a
       test covering only sets_reps passed throughout the bug's entire life. */
    const cases = [
      { prescription: { kind: 'sets_reps', sets: 3, repsMin: 8 }, sets: 3, label: 'sets_reps' },
      { prescription: { kind: 'bodyweight_reps', sets: 3, repsMin: 10 }, sets: 3, label: 'bodyweight_reps' },
      { prescription: { kind: 'timed', sets: 2, durationSeconds: 45 }, sets: 2, label: 'timed' },
      { prescription: { kind: 'duration', durationMinutes: 20 }, sets: 1, label: 'duration' },
      { prescription: { kind: 'distanceDuration', distanceMiles: 3, durationMinutes: 30 }, sets: 1, label: 'distanceDuration' },
    ];

    await signInAs(page, 'lifter', '/today');
    for (const testCase of cases) {
      await stubSession(page, sessionFixture({ prescription: testCase.prescription, sets: emptySets(testCase.sets) }));
      await page.goto(`/workout/${SESSION_ID}`);
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByText(`0 of ${testCase.sets} sets complete`),
        `${testCase.label} started already complete`,
      ).toBeVisible();
      await expect(page.getByText(/sets? completed$/)).toHaveCount(0);
    }
  });

  test('B — one commit logs every planned set', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    await stubSession(
      page,
      sessionFixture({ prescription: { kind: 'sets_reps', sets: 3, repsMin: 8 }, sets: emptySets(3) }),
    );
    await page.goto(`/workout/${SESSION_ID}`);

    await page.getByLabel(/^Quick log: Weight/).fill('185');
    await expect(page.getByLabel(/^Quick log: Reps/)).toHaveValue('8'); // seeded from the plan

    /* State, not pixels: one request carrying all three set ids. */
    const [request] = await Promise.all([
      page.waitForRequest((r) => /\/quick-log$/.test(r.url()) && r.method() === 'POST'),
      page.getByRole('button', { name: 'Log all 3 sets' }).click(),
    ]);
    expect((request.postDataJSON() as { setIds: string[] }).setIds).toHaveLength(3);
  });

  test('D — bodyweight completes on reps alone, with no weight field', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    await stubSession(
      page,
      sessionFixture({ prescription: { kind: 'bodyweight_reps', sets: 2, repsMin: 12 }, sets: emptySets(2) }),
    );
    await page.goto(`/workout/${SESSION_ID}`);

    /* No fake 0 lb: weight is not a field this representation has. */
    await expect(page.getByLabel(/^Quick log: Weight/)).toHaveCount(0);
    await expect(page.getByLabel(/^Quick log: Reps/)).toHaveValue('12');
    await expect(page.getByRole('button', { name: /^Log all 2 sets$/ })).toBeEnabled();
  });

  test('E — a planned duration is incomplete until an actual is committed', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    await stubSession(
      page,
      sessionFixture({ prescription: { kind: 'duration', durationMinutes: 60 }, sets: emptySets(1), name: 'Outdoor Walk' }),
    );
    await page.goto(`/workout/${SESSION_ID}`);

    await expect(page.getByText('0 of 1 sets complete')).toBeVisible();
    // Seeded from the plan, which is a draft and not a logged actual.
    await expect(page.getByLabel(/^Quick log: Duration/)).toHaveValue('60');
  });

  test('G — a slow save does not block the rest of the workout', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    await stubSession(
      page,
      sessionFixture({ prescription: { kind: 'sets_reps', sets: 2, repsMin: 8 }, sets: emptySets(2) }),
      { quickLog: { delayMs: 4000 } },
    );
    await page.goto(`/workout/${SESSION_ID}`);

    await page.getByLabel(/^Quick log: Weight/).fill('185');
    await page.getByRole('button', { name: 'Log all 2 sets' }).click();

    /* Optimistic: the card acknowledges before the request settles, so the
       user is never left watching a spinner between sets. */
    await expect(page.getByText('2 sets completed')).toBeVisible({ timeout: 3000 });
  });

  test('H — a failed save keeps the values and does not claim completion', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    await stubSession(
      page,
      sessionFixture({ prescription: { kind: 'sets_reps', sets: 2, repsMin: 8 }, sets: emptySets(2) }),
      { quickLog: { delayMs: 60, fail: true } },
    );
    await page.goto(`/workout/${SESSION_ID}`);

    await page.getByLabel(/^Quick log: Weight/).fill('185');
    await page.getByRole('button', { name: 'Log all 2 sets' }).click();

    // Rolled back: completion never outlives the request that justified it.
    await expect(page.getByText('0 of 2 sets complete')).toBeVisible();
    // The typing survives, so the retry costs nothing.
    await expect(page.getByLabel(/^Quick log: Weight/)).toHaveValue('185');
    // And the card is reopened rather than left collapsed over a failure.
    await expect(page.getByTestId('set-row')).toHaveCount(2);
  });

  test('C — a manual exception survives, and quick log will not overwrite it', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    await stubSession(
      page,
      sessionFixture({
        prescription: { kind: 'sets_reps', sets: 3, repsMin: 8 },
        /* Sets 1 and 2 already logged; set 3 corrected by hand to 6 reps.
           This is the shape that matters: quick log must treat the exception
           as done work, not as something to flatten back to the common
           value. */
        sets: [
          { weightValue: 185, reps: 8 },
          { weightValue: 185, reps: 8 },
          { weightValue: 185, reps: 6 },
        ],
      }),
    );
    await page.goto(`/workout/${SESSION_ID}`);

    /* Every set already counts as logged, so quick log has nothing left to
       write and does not offer to. `quickLogTargets` skipping logged sets is
       what stops a re-run silently overwriting the correction. */
    await expect(page.getByRole('button', { name: /^Log/ })).toHaveCount(0);
    await expect(page.getByText('3 sets completed')).toBeVisible();

    // And the exception is still the value the user typed.
    await ensureExpanded(page);
    const repInputs = page.getByLabel(/^Reps/);
    await expect(repInputs.nth(2)).toHaveValue('6');
    await expect(repInputs.nth(0)).toHaveValue('8');
  });

  test('F — distance and duration complete together and derive a pace', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    await stubSession(
      page,
      sessionFixture({
        prescription: { kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 },
        sets: [{ distanceValue: 5, distanceUnit: 'mi', durationSeconds: 1800 }],
        name: 'Outdoor Run',
      }),
    );
    await page.goto(`/workout/${SESSION_ID}`);

    await expect(page.getByText('1 set completed')).toBeVisible();
    /* Representation-aware summary: distance, duration and a pace derived
       from them — never weight × reps, and never a 0 lb volume. */
    const metrics = page.getByTestId('completed-exercise-log-1-metrics');
    await expect(metrics).toContainText('Distance');
    await expect(metrics).toContainText('Pace');
    await expect(metrics).toContainText('6:00 /mi');
    await expect(metrics).not.toContainText('lb');
  });

  test('I — a completed exercise reopens and recalculates when edited', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    await stubSession(
      page,
      sessionFixture({
        prescription: { kind: 'sets_reps', sets: 2, repsMin: 8 },
        sets: [
          { weightValue: 185, reps: 8 },
          { weightValue: 185, reps: 8 },
        ],
      }),
    );
    await page.goto(`/workout/${SESSION_ID}`);

    await expect(page.getByText('2 sets completed')).toBeVisible();
    /* Derived metrics, so the summary must already reflect the logged work:
       2 × 185 × 8 = 2,960. */
    await expect(page.getByTestId('completed-exercise-log-1-metrics')).toContainText('2,960 lb');

    /* Completion is not a one-way door during an active workout. */
    await ensureExpanded(page);
    await expect(page.getByTestId('set-row')).toHaveCount(2);

    const weight = page.getByLabel(/^Weight/).first();
    await weight.fill('205');
    /* The edit is offered for saving rather than silently applied — an
       optimistic screen must not claim a correction the server has not
       accepted. */
    await expect(page.getByRole('button', { name: 'Save' }).first()).toBeEnabled();
  });

  test('J — a finished workout is a review surface, not a disabled editor', async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    await stubSession(
      page,
      sessionFixture({
        prescription: { kind: 'sets_reps', sets: 2, repsMin: 8 },
        sets: [
          { weightValue: 185, reps: 8 },
          { weightValue: 185, reps: 8 },
        ],
        status: 'completed',
      }),
    );
    await page.goto(`/workout/${SESSION_ID}`);

    await expect(page.getByRole('heading', { name: /workout complete/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Duplicate set/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Delete set/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Add set$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /actions$/ })).toHaveCount(0);
    /* Story 23/42B — still correctable, so no Save until something is edited. */
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  });
});
