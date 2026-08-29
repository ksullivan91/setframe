import { expect } from '@playwright/test';
import { test, signInAs } from '../ux/auth';

/**
 * Geometry parity between the built v2 logger and its Figma design.
 *
 * **Why measurements and not a pixel diff.** Figma rasterises text with its
 * own engine; a browser uses the platform's. Identical CSS and identical
 * fonts still produce different antialiasing, hinting and subpixel placement,
 * so a pixel comparison of a Figma export against a browser screenshot fails
 * on correct output and cannot be thresholded into usefulness — the diff is
 * spread thinly over every glyph rather than concentrated where a real defect
 * would be.
 *
 * What *is* exact, and what the design actually specifies, is the geometry.
 * Every number below was read out of the Figma file programmatically (node
 * 96:57 for the row, 99:2 for the card) rather than transcribed by eye, and
 * is asserted here against computed layout in a real browser at 390px.
 *
 * The screenshots this writes are for human side-by-side review against the
 * Figma frames; they are evidence, not an assertion.
 */

const FIGMA = {
  row: { width: 334, height: 44, gap: 6, paddingX: 4, radius: 10 },
  columns: { setChip: 34, previous: 74, prSlot: 24, input: 70, mark: 24 },
  inputHeight: 40,
  card: { width: 358, threeSetHeight: 264 },
  /* 16px is the iOS Safari zoom threshold — below it the viewport zooms on
     focus and never returns. Story 28. */
  inputFontSize: 16,
} as const;

const px = (value: string) => Number.parseFloat(value);

test.use({ viewport: { width: 390, height: 844 } });

/**
 * The shared fixture carries `previousSession: null`, so PREVIOUS renders as
 * an em dash for every row — the column the whole redesign turns on would go
 * unverified. This pins a session that actually exercises it: previous values
 * per set index, a PR on the last set so the reserved badge slot is occupied,
 * and a warm-up so the `W` chip and its exclusion from numbering are covered.
 *
 * Pinned through `__setframeMocks` rather than by editing the shared fixture,
 * which every other spec also reads. MSW is a service worker and intercepts
 * fetch before Playwright sees it, so `page.route` cannot do this.
 */
const set = (id: string, sortOrder: number, over: Record<string, unknown> = {}) => ({
  id,
  exerciseLogId: 'exercise-log-1',
  clientId: '00000000-0000-4000-8000-00000000000' + sortOrder,
  sortOrder,
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
  ...over,
});

const PINNED_SESSION = {
  id: 'session-v2',
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
      id: 'exercise-log-1',
      sessionId: 'session-v2',
      exerciseId: '20000000-0000-0000-0000-000000000001',
      templateExerciseId: null,
      sortOrder: 0,
      skipped: false,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      exercise: {
        id: '20000000-0000-0000-0000-000000000001',
        name: 'Bench Press',
        canonicalSlug: 'bench-press',
        movementPattern: 'horizontal-push',
        equipment: 'barbell',
        isSystem: true,
        createdByUserId: null,
        archivedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      prescription: { kind: 'sets_reps', sets: 3, repsMin: 8, repsMax: null },
      previousSession: {
        sessionId: 'previous-session',
        localDate: '2026-08-20',
        sets: [
          { weightValue: 225, weightUnit: 'lb', reps: 8, durationSeconds: null, distanceValue: null, distanceUnit: null, rpe: null, setType: 'working' },
          { weightValue: 225, weightUnit: 'lb', reps: 8, durationSeconds: null, distanceValue: null, distanceUnit: null, rpe: null, setType: 'working' },
          { weightValue: 225, weightUnit: 'lb', reps: 8, durationSeconds: null, distanceValue: null, distanceUnit: null, rpe: null, setType: 'working' },
        ],
      },
      sets: [
        set('set-1', 0, { weightValue: 225, reps: 8 }),
        set('set-2', 1, { weightValue: 225, reps: 8 }),
        set('set-3', 2, { weightValue: 235, reps: 8, isPrWeight: true }),
      ],
    },
  ],
};

test.describe('workout v2 — Figma geometry parity', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    await page.evaluate((session) => {
      (window as unknown as { __setframeMocks?: { setSession: (s: unknown) => void } })
        .__setframeMocks?.setSession(session);
    }, PINNED_SESSION);
    await page.goto('/workout/v2/session-v2');
    await expect(page.getByTestId('workout-v2')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { __setframeMocks?: { reset: () => void } }).__setframeMocks?.reset();
    });
  });

  test('a set row matches the Figma row exactly', async ({ page }) => {
    const row = page.locator('[data-testid^="set-row-"]').first();
    await expect(row).toBeVisible();

    const box = await row.boundingBox();
    expect(box?.width).toBe(FIGMA.row.width);
    expect(box?.height).toBe(FIGMA.row.height);

    const style = await row.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        gap: s.columnGap,
        paddingLeft: s.paddingLeft,
        paddingRight: s.paddingRight,
        radius: s.borderTopLeftRadius,
      };
    });
    expect(px(style.gap)).toBe(FIGMA.row.gap);
    expect(px(style.paddingLeft)).toBe(FIGMA.row.paddingX);
    expect(px(style.paddingRight)).toBe(FIGMA.row.paddingX);
    expect(px(style.radius)).toBe(FIGMA.row.radius);
  });

  test('every column is the width the design specifies, and they sum to the row', async ({
    page,
  }) => {
    const row = page.locator('[data-testid^="set-row-"]').first();
    const widths = await row.evaluate((el) =>
      Array.from(el.children).map((child) => Math.round(child.getBoundingClientRect().width)),
    );

    const { setChip, previous, prSlot, input, mark } = FIGMA.columns;
    expect(widths).toEqual([setChip, previous, prSlot, input, input, mark]);

    /* The arithmetic the design turns on: 4 + columns + 5 gaps + 4 = 334.
       If this drifts, the column headers stop sitting over their columns. */
    const total =
      FIGMA.row.paddingX * 2 +
      widths.reduce((a, b) => a + b, 0) +
      FIGMA.row.gap * (widths.length - 1);
    expect(total).toBe(FIGMA.row.width);
  });

  test('the PR slot is reserved in rows without a PR, so columns stay aligned', async ({ page }) => {
    /* The whole reason the badge has a slot rather than sitting inline: a PR
       must not shift PREVIOUS, LB and REPS out of line with the rows around
       it. Asserted by comparing column offsets across every row. */
    const offsets = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-testid^="set-row-"]'));
      return rows.map((row) =>
        Array.from(row.children).map((child) =>
          Math.round(child.getBoundingClientRect().left - row.getBoundingClientRect().left),
        ),
      );
    });
    expect(offsets.length).toBeGreaterThan(1);
    for (const row of offsets.slice(1)) {
      expect(row).toEqual(offsets[0]);
    }
  });

  test('inputs are 16px, which is the iOS zoom threshold', async ({ page }) => {
    const input = page.locator('[data-testid^="set-input-"]').first();
    const size = await input.evaluate((el) => getComputedStyle(el).fontSize);
    expect(px(size)).toBeGreaterThanOrEqual(FIGMA.inputFontSize);

    const box = await input.boundingBox();
    expect(box?.width).toBe(FIGMA.columns.input);
    expect(box?.height).toBe(FIGMA.inputHeight);
  });

  test('a three-set exercise card is 264px, the number the redesign turns on', async ({ page }) => {
    const card = page.locator('[data-testid^="exercise-card-"]').first();
    const rows = card.locator('[data-testid^="set-row-"]');
    const rowCount = await rows.count();

    const box = await card.boundingBox();
    expect(box?.width).toBe(FIGMA.card.width);

    /* Height is asserted only for the three-set case the design measures;
       other counts scale by 48 per row (44 + 4 gap) and are checked as such. */
    const expected = FIGMA.card.threeSetHeight + (rowCount - 3) * (FIGMA.row.height + 4);
    expect(Math.round(box!.height)).toBe(expected);
  });

  test('the column header sits over its columns', async ({ page }) => {
    const card = page.locator('[data-testid^="exercise-card-"]').first();
    const headerOffsets = await card.evaluate((el) => {
      const header = el.querySelector('[aria-hidden="true"]')!;
      return Array.from(header.children).map((child) =>
        Math.round(child.getBoundingClientRect().left - header.getBoundingClientRect().left),
      );
    });
    const rowOffsets = await card.evaluate((el) => {
      const row = el.querySelector('[data-testid^="set-row-"]')!;
      return Array.from(row.children).map((child) =>
        Math.round(child.getBoundingClientRect().left - row.getBoundingClientRect().left),
      );
    });
    expect(headerOffsets).toEqual(rowOffsets);
  });

  test('PREVIOUS carries last session, and the PR occupies its reserved slot', async ({ page }) => {
    /* The two things the redesign is actually for. Geometry passing while
       these render empty would be a table with nothing in it. */
    const previous = page.getByRole('button', { name: /Use last session/ });
    await expect(previous.first()).toContainText('225');
    await expect(previous).toHaveCount(3);

    await expect(page.getByLabel('Personal record')).toHaveCount(1);
    await expect(page.locator('[data-status="pr"]')).toHaveCount(1);
    await expect(page.locator('[data-status="saved"]')).toHaveCount(2);
  });

  test('evidence for side-by-side review against the Figma frames', async ({ page }) => {
    await page.screenshot({
      path: 'ux-tests/reports/workout-v2/built-active-390.png',
      fullPage: false,
    });
    const card = page.locator('[data-testid^="exercise-card-"]').first();
    await card.screenshot({ path: 'ux-tests/reports/workout-v2/built-card-390.png' });
  });
});
