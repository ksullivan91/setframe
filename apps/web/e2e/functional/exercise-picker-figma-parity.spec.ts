import { expect } from '@playwright/test';
import { test, signInAs } from '../ux/auth';

/**
 * Geometry and behaviour parity for the shared exercise picker.
 *
 * Numbers read out of Figma node `163:708`
 * (`Explore/Mobile/Build 5 · Search and pick exercises`) programmatically.
 * Measurements rather than a pixel diff, for the reason set out in
 * `workout-v2-figma-parity.spec.ts`.
 *
 * Reached through the v2 logger's `+ Add exercise`, which was a dead control
 * until this story — so these also prove the button now does something.
 */

const FIGMA = {
  row: { height: 64, paddingX: 16, gap: 12 },
  tile: 44,
  badge: 26,
  search: { height: 38, radius: 8 },
  filter: { height: 27, gap: 6 },
  cta: { height: 48, radius: 8 },
} as const;

const px = (value: string) => Number.parseFloat(value);

test.use({ viewport: { width: 390, height: 844 } });

const PINNED_SESSION = {
  id: 'session-picker',
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
  /* No exercises: the empty session is exactly the state the picker exists
     to resolve, and it keeps the page short enough that the bottom bar is
     on screen without scrolling. */
  exercises: [],
};

test.describe('exercise picker — Figma geometry parity', () => {
  /* A pinned in-progress session, so the logger renders deterministically and
     `+ Add exercise` is present. Set through `__setframeMocks` rather than by
     clicking through Today: MSW is a service worker and intercepts fetch
     before Playwright sees it, so `page.route` cannot do this, and driving
     the UI to reach a session made the setup depend on Today's own state. */
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'lifter', '/today');
    await page.evaluate((session) => {
      (window as unknown as { __setframeMocks?: { setSession: (s: unknown) => void } })
        .__setframeMocks?.setSession(session);
    }, PINNED_SESSION);
    await page.goto('/workout/session-picker');
    await expect(page.getByTestId('workout-v2')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { __setframeMocks?: { reset: () => void } }).__setframeMocks?.reset();
    });
  });

  test('the add-exercise control opens the picker — it used to do nothing', async ({ page }) => {
    await openPicker(page);
    await expect(page.getByTestId('exercise-picker')).toBeVisible();
  });

  test('a row is the design height, full-bleed, with the tile and badge sized', async ({ page }) => {
    await openPicker(page);
    const row = page.locator('[data-testid^="picker-row-"]').first();
    const box = await row.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.height)).toBe(FIGMA.row.height);
    /* Full-bleed: the picker is a screen, not a card on one, so the row
       spans the viewport and carries its own 16px padding. */
    expect(Math.round(box!.width)).toBe(390);
    expect(px(await row.evaluate((el) => getComputedStyle(el).paddingLeft))).toBe(
      FIGMA.row.paddingX,
    );

    const tile = row.locator('span').first();
    expect(Math.round((await tile.boundingBox())!.height)).toBe(FIGMA.tile);
  });

  test('selecting shows pick ORDER, not a checkmark', async ({ page }) => {
    await openPicker(page);
    const rows = page.locator('[data-testid^="picker-row-"]');
    const first = rows.nth(0);
    const second = rows.nth(1);
    const firstId = (await first.getAttribute('data-testid'))!.replace('picker-row-', '');
    const secondId = (await second.getAttribute('data-testid'))!.replace('picker-row-', '');

    await second.click();
    await first.click();

    /* Picked second first, so it is 1. The footer promises they are added in
       the order picked — a checkmark would make that unverifiable. */
    await expect(page.getByTestId(`picker-badge-${secondId}`)).toHaveText('1');
    await expect(page.getByTestId(`picker-badge-${firstId}`)).toHaveText('2');
    await expect(page.getByTestId('picker-add')).toHaveText('Add 2 exercises');
  });

  test('deselecting renumbers, leaving no gap', async ({ page }) => {
    await openPicker(page);
    const rows = page.locator('[data-testid^="picker-row-"]');
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      ids.push((await rows.nth(i).getAttribute('data-testid'))!.replace('picker-row-', ''));
      await rows.nth(i).click();
    }
    await rows.nth(0).click(); // remove the first pick

    await expect(page.getByTestId(`picker-badge-${ids[1]}`)).toHaveText('1');
    await expect(page.getByTestId(`picker-badge-${ids[2]}`)).toHaveText('2');
    await expect(page.getByTestId('picker-add')).toHaveText('Add 2 exercises');
  });

  test('the add button is inert until something is picked', async ({ page }) => {
    await openPicker(page);
    await expect(page.getByTestId('picker-add')).toBeDisabled();
    await expect(page.getByTestId('picker-add')).toHaveText('Add exercises');
    await page.locator('[data-testid^="picker-row-"]').first().click();
    await expect(page.getByTestId('picker-add')).toBeEnabled();
    await expect(page.getByTestId('picker-add')).toHaveText('Add 1 exercise');
  });

  test('search matches anywhere in the name, not just the start', async ({ page }) => {
    await openPicker(page);
    const before = await page.locator('[data-testid^="picker-row-"]').count();
    await page.getByTestId('picker-search').fill('press');
    const after = await page.locator('[data-testid^="picker-row-"]').count();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(before);
    for (const name of await page.locator('[data-testid^="picker-row-"]').allTextContents()) {
      expect(name.toLowerCase()).toContain('press');
    }
  });

  test('the search input is 16px, the iOS zoom threshold', async ({ page }) => {
    /* Below 16px iOS Safari zooms the viewport on focus and never returns
       (story 28). The design says 15; this is the one place it loses. */
    await openPicker(page);
    const size = await page
      .getByTestId('picker-search')
      .evaluate((el) => getComputedStyle(el).fontSize);
    expect(px(size)).toBeGreaterThanOrEqual(16);
    expect(px(await page.getByTestId('picker-search').evaluate((el) => getComputedStyle(el).height)))
      .toBe(FIGMA.search.height);
  });

  test('filters are chips at the design height, led by All', async ({ page }) => {
    await openPicker(page);
    const chips = page.locator('[data-testid^="picker-filter-"]');
    expect(await chips.count()).toBeGreaterThan(1);
    await expect(chips.first()).toHaveText('All');
    expect(Math.round((await chips.first().boundingBox())!.height)).toBe(FIGMA.filter.height);
  });

  test('the footer CTA is the design size', async ({ page }) => {
    await openPicker(page);
    const cta = page.getByTestId('picker-add');
    const box = await cta.boundingBox();
    expect(Math.round(box!.height)).toBe(FIGMA.cta.height);
    expect(px(await cta.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))).toBe(
      FIGMA.cta.radius,
    );
  });

  test('the picker never scrolls the page sideways at 390px', async ({ page }) => {
    await openPicker(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('evidence for side-by-side review against Figma 163:708', async ({ page }) => {
    await openPicker(page);
    await page.locator('[data-testid^="picker-row-"]').nth(1).click();
    await page.locator('[data-testid^="picker-row-"]').nth(0).click();
    await page.screenshot({ path: 'test-results/exercise-picker-390.png' });
  });
});

async function openPicker(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '+ Add exercise' }).click();
  await expect(page.getByTestId('exercise-picker')).toBeVisible();
  await expect(page.locator('[data-testid^="picker-row-"]').first()).toBeVisible();
}
