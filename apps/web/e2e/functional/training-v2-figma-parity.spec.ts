import { expect } from '@playwright/test';
import { test, signInAs } from '../ux/auth';

/**
 * Geometry parity between the built Training overview and its Figma design.
 *
 * Measurements, not a pixel diff, for the reason set out at length in
 * `workout-v2-figma-parity.spec.ts`: Figma and the browser rasterise text
 * with different engines, so a pixel comparison fails on correct output while
 * a geometry assertion fails only on a real defect.
 *
 * Every number here was read out of Figma node `146:709`
 * (`Explore/Mobile/Training 7 · Set up, and training`) programmatically.
 */

const FIGMA = {
  card: { width: 358, padding: 14, radius: 16, innerWidth: 330, gap: 12 },
  weekStrip: { dayWidth: 42, dayGap: 6, chipSize: 42, chipRadius: 8 },
  workoutRow: { height: 55 },
  header: { titleSize: 28, subtitleSize: 13 },
  progressTrack: { height: 6 },
} as const;

const px = (value: string) => Number.parseFloat(value);

test.use({ viewport: { width: 390, height: 844 } });

test.describe('training v2 — Figma geometry parity', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'lifter', '/training');
    await expect(page.getByTestId('workouts-card')).toBeVisible();
  });

  test('the three cards are the design width, and stack at the design gap', async ({ page }) => {
    const cards = [
      page.getByTestId('active-program-card'),
      page.getByTestId('this-week-card'),
      page.getByTestId('workouts-card'),
    ];
    const boxes = [];
    for (const card of cards) {
      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      boxes.push(box!);
      expect(Math.round(box!.width)).toBe(FIGMA.card.width);
      const styles = await card.evaluate((el) => {
        const s = getComputedStyle(el);
        return { padding: s.paddingLeft, radius: s.borderTopLeftRadius };
      });
      expect(px(styles.padding)).toBe(FIGMA.card.padding);
      expect(px(styles.radius)).toBe(FIGMA.card.radius);
    }

    /* Cards are 358 inside a 390 viewport, so the 16px screen padding is
       applied exactly once. A card at 326 means the page added its own on
       top of AppShell's — the defect the logger hit. */
    expect(Math.round(boxes[0]!.x)).toBe(16);

    for (let i = 1; i < boxes.length; i += 1) {
      const gap = boxes[i]!.y - (boxes[i - 1]!.y + boxes[i - 1]!.height);
      expect(Math.round(gap)).toBe(FIGMA.card.gap);
    }
  });

  test('the week strip spans the card inner width exactly', async ({ page }) => {
    const days = page.locator('[data-testid^="week-day-"]');
    await expect(days).toHaveCount(7);

    const boxes = [];
    for (let i = 0; i < 7; i += 1) {
      const box = await days.nth(i).boundingBox();
      expect(box).not.toBeNull();
      boxes.push(box!);
      expect(Math.round(box!.width)).toBe(FIGMA.weekStrip.dayWidth);
    }

    /* 7 * 42 + 6 * 6 = 330, which is the card's inner width. This is the
       assertion that catches a strip that has been centred or padded. */
    const span = boxes[6]!.x + boxes[6]!.width - boxes[0]!.x;
    expect(Math.round(span)).toBe(FIGMA.card.innerWidth);

    const gap = boxes[1]!.x - (boxes[0]!.x + boxes[0]!.width);
    expect(Math.round(gap)).toBe(FIGMA.weekStrip.dayGap);
  });

  test('the week runs Sunday-first, matching the product week', async ({ page }) => {
    /* WEEK_START_DAY is 0. A Monday-first strip under "This week" would show
       two days from a different week than the one streaks count. */
    const letters = await page.locator('[data-testid^="week-day-"] span').first().evaluate(() => {
      return Array.from(document.querySelectorAll('[data-testid^="week-day-"]')).map(
        (el) => el.querySelector('span')?.textContent ?? '',
      );
    });
    expect(letters).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });

  test('exactly one day is today, and it is the accent chip', async ({ page }) => {
    const today = page.locator('[data-testid^="week-day-"][data-state="today"]');
    await expect(today).toHaveCount(1);
    await expect(today).toHaveAttribute('aria-current', 'date');
  });

  test('every day names itself accessibly, because one letter is ambiguous', async ({ page }) => {
    /* Two chips read "T". The letter alone cannot be the accessible name. */
    const labels = await page
      .locator('[data-testid^="week-day-"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
    expect(labels[0]).toMatch(/^Sunday, /);
    expect(labels[2]).toMatch(/^Tuesday, /);
    expect(labels[4]).toMatch(/^Thursday, /);
    expect(new Set(labels).size).toBe(7);
  });

  test('a workout row is the design height and the whole row is the target', async ({ page }) => {
    const row = page.locator('[data-testid^="workout-row-"]').first();
    const box = await row.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.height)).toBe(FIGMA.workoutRow.height);
    /* The row fills the card's inner width — the chevron is decoration, not
       the hit area. */
    expect(Math.round(box!.width)).toBe(FIGMA.card.innerWidth);
    await expect(row).toHaveJSProperty('tagName', 'BUTTON');
  });

  test('the block progress bar renders only when there is a block to fill', async ({ page }) => {
    /* The mock program has cycleLengthWeeks: 5, so the bar is present and
       its label names the week. Perpetual plans render no bar at all. */
    const bar = page.getByTestId('block-progress');
    await expect(bar).toBeVisible();
    expect(px(await bar.evaluate((el) => getComputedStyle(el).height))).toBe(
      FIGMA.progressTrack.height,
    );
    await expect(bar).toHaveAttribute('aria-label', /Week \d+ of 5/);
  });

  test('the page never scrolls sideways at 390px', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('evidence for side-by-side review against Figma 146:709', async ({ page }) => {
    await page.screenshot({
      path: 'test-results/training-v2-overview.png',
      fullPage: true,
    });
  });
});
