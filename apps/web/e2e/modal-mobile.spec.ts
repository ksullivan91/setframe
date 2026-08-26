import { expect, test, type Page } from '@playwright/test';

/**
 * The mobile-web modal contract, on real WebKit at a phone viewport.
 *
 * Story 67. Not pixel assertions — this protects the behaviour a desktop
 * jsdom test cannot see: real viewport height, real scrolling, real overflow.
 * The defect that prompted this pack is one a Chromium desktop run would not
 * have reproduced.
 */

const HARNESS = '/e2e/harness.html';

async function open(page: Page, presentation: 'task' | 'compact' | 'actions') {
  await page.goto(HARNESS);
  await page.getByTestId(`open-${presentation}`).click();
  await expect(page.getByTestId('modal-surface')).toBeVisible();
}

for (const presentation of ['task', 'compact', 'actions'] as const) {
  test.describe(presentation, () => {
    test('renders exactly one dialog surface', async ({ page }) => {
      await open(page, presentation);
      // The reported defect looked like two sheets; this pins that one open
      // dialog is one surface.
      await expect(page.getByTestId('modal-surface')).toHaveCount(1);
      await expect(page.getByTestId('modal-backdrop')).toHaveCount(1);
    });

    test('does not make the document scroll horizontally', async ({ page }) => {
      await open(page, presentation);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflows).toBe(false);
    });

    test('locks the page behind it', async ({ page }) => {
      await open(page, presentation);
      /* `mouse.wheel` is unsupported in mobile WebKit, so the scroll is
         attempted the way the lock actually has to defeat it: programmatic
         scrolling against a position-fixed body. */
      const before = await page.evaluate(() => window.scrollY);
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(120);
      expect(await page.evaluate(() => window.scrollY)).toBe(before);
    });

    test('restores the page scroll position on dismissal', async ({ page }) => {
      await page.goto(HARNESS);
      const trigger = page.getByTestId(`open-${presentation}`);
      /* Read the position *after* the trigger is in view. Playwright scrolls
         a control into view before clicking it, so capturing scrollY earlier
         records a position the page has already left — which looked like a
         restore bug and was not one. */
      await trigger.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => window.scrollY);
      expect(before).toBeGreaterThan(0);

      await trigger.click();
      await expect(page.getByTestId('modal-surface')).toBeVisible();
      await page.getByRole('button', { name: 'Close dialog' }).click();
      await expect(page.getByTestId('modal-surface')).toHaveCount(0);

      // Dismissing must not dump the user back at the top of the page.
      expect(await page.evaluate(() => window.scrollY)).toBe(before);
    });
  });
}

test.describe('task presentation', () => {
  test('fills the viewport, leaving no application visible behind it', async ({ page }) => {
    await open(page, 'task');
    const box = (await page.getByTestId('modal-surface').boundingBox())!;
    const viewport = page.viewportSize()!;

    /* The whole defect in one assertion: a partial sheet leaves a strip of
       app above it, and two stacked light surfaces read as two sheets. */
    expect(box.width).toBeCloseTo(viewport.width, 0);
    expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1);
    expect(box.y).toBeLessThanOrEqual(1);
  });

  test('scrolls its content region, not the surface', async ({ page }) => {
    await open(page, 'task');

    const scrolled = await page.getByTestId('modal-content').evaluate((el) => {
      el.scrollTop = 300;
      return el.scrollTop;
    });
    expect(scrolled).toBeGreaterThan(0);

    // Exactly one scroll container: the surface itself must not scroll.
    const surfaceScrolls = await page
      .getByTestId('modal-surface')
      .evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(surfaceScrolls).toBe(false);
  });

  test('keeps the primary action reachable without scrolling to it', async ({ page }) => {
    await open(page, 'task');
    // A sticky footer means the action is on screen even with long content.
    await expect(page.getByTestId('task-primary')).toBeInViewport();
  });

  test('keeps the close control reachable while content scrolls', async ({ page }) => {
    await open(page, 'task');
    await page.getByTestId('modal-content').evaluate((el) => {
      el.scrollTop = 600;
    });
    await expect(page.getByRole('button', { name: 'Close dialog' })).toBeInViewport();
  });
});

test.describe('compact presentation', () => {
  test('stays a centred dialog rather than taking the whole screen', async ({ page }) => {
    await open(page, 'compact');
    const box = (await page.getByTestId('modal-surface').boundingBox())!;
    const viewport = page.viewportSize()!;

    /* A two-sentence confirmation filling an iPhone is as wrong as a form
       crammed into a drawer. */
    expect(box.height).toBeLessThan(viewport.height * 0.8);
    expect(box.y).toBeGreaterThan(1);
  });
});
