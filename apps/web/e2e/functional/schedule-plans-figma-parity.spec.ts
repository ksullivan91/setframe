import { expect } from '@playwright/test';
import { test, signInAs } from '../ux/auth';

/**
 * Geometry and behaviour parity for the schedule, the assign-day sheet and
 * the plans list.
 *
 * Numbers read out of Figma `150:708`, `156:708` and `151:708`
 * programmatically.
 */

test.use({ viewport: { width: 390, height: 844 } });

test.describe('schedule and plans — Figma parity', () => {
  test('Edit schedule reaches the schedule, not the old tabbed editor', async ({ page }) => {
    await signInAs(page, 'lifter', '/training');
    await page.getByRole('button', { name: 'Edit schedule' }).click();
    await expect(page).toHaveURL(/\/training\/schedule$/);
    await expect(page.getByTestId('schedule-page')).toBeVisible();
  });

  test('the repeat mode is surfaced at all — it never has been', async ({ page }) => {
    /* cycle_length_weeks has always been in the schema and nothing in the
       product has ever shown it. */
    await signInAs(page, 'lifter', '/training/schedule');
    await expect(page.getByTestId('repeat-mode-card')).toBeVisible();
    await expect(page.getByTestId('mode-perpetual')).toBeVisible();
    await expect(page.getByTestId('mode-block')).toBeVisible();
  });

  test('seven day rows, Sunday-first, matching the product week', async ({ page }) => {
    await signInAs(page, 'lifter', '/training/schedule');
    const rows = page.locator('[data-testid^="schedule-day-"]');
    await expect(rows).toHaveCount(7);
    await expect(rows.first()).toContainText('Sunday');
    await expect(rows.nth(1)).toContainText('Monday');
    expect(Math.round((await rows.first().boundingBox())!.height)).toBe(43);
  });

  test('an unassigned day reads Rest without needing a rest row', async ({ page }) => {
    /* dayTypeId is NOT NULL — Rest is the absence of a slot. */
    await signInAs(page, 'lifter', '/training/schedule');
    await expect(page.getByTestId('schedule-day-0')).toContainText('Rest');
  });

  test('a day row opens a MULTI-select sheet, because two-a-days are legal', async ({ page }) => {
    /* program_schedule_slot has no unique constraint on (version, dayIndex)
       and carries a sortOrder. Single-select would rule that out. */
    await signInAs(page, 'lifter', '/training/schedule');
    await page.getByTestId('schedule-day-1').click();
    await expect(page.getByTestId('assign-day-sheet')).toBeVisible();

    /* Options arrive with the day-types query, so wait for one rather than
       counting whatever has rendered so far — that race made this flaky
       under parallel load while passing in isolation. */
    const options = page.locator('[data-testid^="assign-option-"]');
    await expect(options.first()).toBeVisible();
    const count = await options.count();
    expect(count).toBeGreaterThan(1);

    /* Monday already has a workout, and the sheet pre-selects it — so click
       whatever is currently UNselected rather than assuming a blank day.
       Selecting two and having both stick is the property under test. */
    const unselected: number[] = [];
    for (let i = 0; i < count; i += 1) {
      if ((await options.nth(i).getAttribute('aria-pressed')) === 'false') unselected.push(i);
    }
    expect(unselected.length).toBeGreaterThan(0);

    const first = unselected[0]!;
    await options.nth(first).click();
    await expect(options.nth(first)).toHaveAttribute('aria-pressed', 'true');

    const alreadySelected = (await options.nth(0).getAttribute('aria-pressed')) === 'true';
    if (alreadySelected && first !== 0) {
      /* Two are now on at once, which single-select would have made
         impossible — that is the whole point of the sheet. */
      await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'true');
    } else if (unselected.length > 1) {
      await options.nth(unselected[1]!).click();
      await expect(options.nth(unselected[1]!)).toHaveAttribute('aria-pressed', 'true');
      await expect(options.nth(first)).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('Rest sits below a divider and is a different kind of action', async ({ page }) => {
    await signInAs(page, 'lifter', '/training/schedule');
    await page.getByTestId('schedule-day-1').click();
    await expect(page.locator('[data-testid^="assign-option-"]').first()).toBeVisible();
    const rest = page.getByTestId('assign-rest');
    await expect(rest).toBeVisible();
    await expect(rest).toContainText('Clears whatever is on this day');
  });

  test('the sheet has no Save button — it is a picker, not a form', async ({ page }) => {
    await signInAs(page, 'lifter', '/training/schedule');
    await page.getByTestId('schedule-day-1').click();
    await expect(
      page.getByTestId('assign-day-sheet').getByRole('button', { name: /^Save/ }),
    ).toHaveCount(0);
  });

  test('the sheet says the change is to the weekday, not one date', async ({ page }) => {
    /* Confusing the two is the mistake this screen most invites. */
    await signInAs(page, 'lifter', '/training/schedule');
    await page.getByTestId('schedule-day-1').click();
    await expect(page.getByTestId('assign-day-sheet')).toContainText('Changes every Monday');
  });

  test('Change reaches the plans list, with the active one badged by what it does', async ({ page }) => {
    await signInAs(page, 'lifter', '/training');
    await page.getByTestId('change-program').click();
    await expect(page).toHaveURL(/\/training\/plans$/);
    await expect(page.getByTestId('plans-page')).toContainText('Active');
    /* Never the word Active. */
    await expect(page.getByTestId('plans-page')).not.toContainText('Active');
  });

  test('the plans list answers the fear before the button is pressed', async ({ page }) => {
    await signInAs(page, 'lifter', '/training/plans');
    /* Wait for the page itself before asserting its copy — under parallel
       load the assertion could otherwise time out against a page that had
       not mounted yet. */
    await expect(page.getByTestId('plans-page')).toBeVisible();
    await expect(page.getByTestId('plans-page')).toContainText('Switching keeps everything');
  });

  test('neither page scrolls sideways at 390px', async ({ page }) => {
    /* Sign in once and navigate, rather than signing in per path — a second
       full sign-in inside one test made this the slowest in the file and the
       first to time out under load. */
    await signInAs(page, 'lifter', '/training/schedule');
    await expect(page.getByTestId('schedule-page')).toBeVisible();

    for (const [path, testId] of [
      ['/training/schedule', 'schedule-page'],
      ['/training/plans', 'plans-page'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByTestId(testId)).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test('evidence for side-by-side review against Figma 150:708, 156:708, 151:708', async ({ page }) => {
    await signInAs(page, 'lifter', '/training/schedule');
    await page.screenshot({ path: 'test-results/schedule-390.png', fullPage: true });
    await page.getByTestId('schedule-day-1').click();
    await page.screenshot({ path: 'test-results/assign-day-390.png' });
    await signInAs(page, 'lifter', '/training/plans');
    await page.screenshot({ path: 'test-results/plans-390.png', fullPage: true });
  });
});
