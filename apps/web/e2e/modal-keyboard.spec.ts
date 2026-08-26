import { expect, test, type Page } from '@playwright/test';

/**
 * Keyboard and focus behaviour, on desktop WebKit.
 *
 * Story 67. Deliberately not run on the phone profile: mobile Safari does not
 * tab through every control and a phone has no Tab key, so asserting a focus
 * trap there would be testing the browser's input model rather than the
 * dialog's contract.
 */

const HARNESS = '/e2e/harness.html';

async function open(page: Page, presentation: 'task' | 'compact' | 'actions') {
  await page.goto(HARNESS);
  await page.getByTestId(`open-${presentation}`).click();
  await expect(page.getByTestId('modal-surface')).toBeVisible();
}

for (const presentation of ['task', 'compact', 'actions'] as const) {
  test.describe(presentation, () => {
    test('moves focus into the dialog on open', async ({ page }) => {
      await open(page, presentation);
      await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused();
    });

    test('never lets focus reach the page behind', async ({ page }) => {
      await open(page, presentation);
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press('Tab');
        const insideDialog = await page.evaluate(() =>
          Boolean(document.activeElement?.closest('[data-testid="modal-surface"]')),
        );
        expect(insideDialog).toBe(true);
      }
    });

    test('closes on Escape and returns focus to the trigger', async ({ page }) => {
      await open(page, presentation);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('modal-surface')).toHaveCount(0);
      await expect(page.getByTestId(`open-${presentation}`)).toBeFocused();
    });
  });
}
