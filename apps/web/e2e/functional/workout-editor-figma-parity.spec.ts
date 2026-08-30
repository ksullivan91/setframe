import { expect } from '@playwright/test';
import { test, signInAs } from '../ux/auth';

/**
 * Geometry and behaviour parity for the pushed workout editor and its
 * prescription sheet.
 *
 * Numbers read out of Figma `147:708` (`Training 3 · Build a workout`) and
 * `152:708` (`Training 4 · Set an exercise's targets`) programmatically.
 */

const FIGMA = {
  row: { width: 334, height: 64, tile: 36 },
  card: { width: 358, paddingX: 12, radius: 16 },
  addButton: { height: 46, radius: 8 },
  sheet: { fieldWidth: 104, inputHeight: 44, actionHeight: 50 },
} as const;

const px = (value: string) => Number.parseFloat(value);

test.use({ viewport: { width: 390, height: 844 } });

test.describe('workout editor — Figma geometry parity', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'lifter', '/training');
    await page.getByTestId('workouts-card').waitFor();
  });

  test('a workout row PUSHES the editor rather than appending it', async ({ page }) => {
    /* The page this replaces appended the editor below the list, so on a
       phone you scrolled past the list you had just used. */
    await page.locator('[data-testid^="workout-row-"]').first().click();
    await expect(page).toHaveURL(/\/training\/workouts\//);
    await expect(page.getByTestId('workout-editor')).toBeVisible();
    /* The list it came from is gone, not merely scrolled past. */
    await expect(page.getByTestId('workouts-card')).toHaveCount(0);
  });

  test('the list card and its rows are the design widths', async ({ page }) => {
    await openEditor(page);
    const card = page.getByTestId('editor-list');
    expect(Math.round((await card.boundingBox())!.width)).toBe(FIGMA.card.width);
    expect(px(await card.evaluate((el) => getComputedStyle(el).paddingLeft))).toBe(
      FIGMA.card.paddingX,
    );

    const row = page.locator('[data-testid^="editor-row-"]').first();
    const box = await row.boundingBox();
    /* 358 - 2*12 = 334. The narrower card padding is what makes those meet. */
    expect(Math.round(box!.width)).toBe(FIGMA.row.width);
    expect(Math.round(box!.height)).toBe(FIGMA.row.height);
  });

  test('the add button is the design size', async ({ page }) => {
    await openEditor(page);
    const add = page.getByTestId('editor-add');
    expect(Math.round((await add.boundingBox())!.height)).toBe(FIGMA.addButton.height);
  });

  test('the hint states ADR 0005 where someone might doubt it', async ({ page }) => {
    await openEditor(page);
    await expect(page.getByTestId('workout-editor')).toContainText(
      'changes the plan, not any workout you have already logged',
    );
  });

  test('the ⋯ opens the prescription sheet, with kind read-only', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: /^Actions for / }).first().click();
    await expect(page.getByTestId('prescription-sheet')).toBeVisible();

    /* Kind is a pill, never a control: changing it would change what every
       already-logged set MEANS, since the same columns read as a different
       representation. */
    const kind = page.getByTestId('prescription-kind');
    await expect(kind).toBeVisible();
    await expect(kind).toHaveJSProperty('tagName', 'SPAN');
    await expect(page.getByTestId('prescription-sheet')).toContainText('set when added');
  });

  test('sheet fields are the design size and blank is allowed', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: /^Actions for / }).first().click();
    const input = page.getByTestId('prescription-sets');
    expect(Math.round((await input.boundingBox())!.height)).toBe(FIGMA.sheet.inputHeight);
    /* Story 19 made planned values optional; the hint says so rather than
       leaving it to be discovered. */
    await expect(page.getByTestId('prescription-sheet')).toContainText(
      'planned targets are optional',
    );
  });

  test('inputs are at least 16px, the iOS zoom threshold', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: /^Actions for / }).first().click();
    const size = await page
      .getByTestId('prescription-sets')
      .evaluate((el) => getComputedStyle(el).fontSize);
    expect(px(size)).toBeGreaterThanOrEqual(16);
  });

  test('the sheet contains no control that does nothing', async ({ page }) => {
    /* "Replace exercise" is in the design (152:708) but was never wired. A
       row that does nothing is the defect being removed everywhere else this
       week, so it is absent until it works. */
    await openEditor(page);
    await page.getByRole('button', { name: /^Actions for / }).first().click();
    await expect(page.getByTestId('prescription-remove')).toBeVisible();
    await expect(page.getByTestId('prescription-replace')).toHaveCount(0);
    await expect(page.getByTestId('prescription-sheet')).not.toContainText('Replace exercise');
  });

  test('the editor add button opens the shared picker', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('editor-add').click();
    await expect(page.getByTestId('exercise-picker')).toBeVisible();
    await expect(page.getByTestId('picker-add')).toHaveText('Add exercises');
  });

  test('the page never scrolls sideways at 390px', async ({ page }) => {
    await openEditor(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('evidence for side-by-side review against Figma 147:708 and 152:708', async ({ page }) => {
    await openEditor(page);
    await page.screenshot({ path: 'test-results/workout-editor-390.png', fullPage: true });
    await page.getByRole('button', { name: /^Actions for / }).first().click();
    await page.screenshot({ path: 'test-results/prescription-sheet-390.png' });
  });
});

async function openEditor(page: import('@playwright/test').Page) {
  await page.locator('[data-testid^="workout-row-"]').first().click();
  await expect(page.getByTestId('workout-editor')).toBeVisible();
  await expect(page.locator('[data-testid^="editor-row-"]').first()).toBeVisible();
}
