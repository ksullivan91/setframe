import { expect } from '@playwright/test';
import { test, signInAs } from '../ux/auth';

/**
 * "Just start training" and saving a session as a reusable workout.
 *
 * Figma: `Training 1 · No plan yet` (148:708) and the Just-start band
 * (167:708 – 169:883).
 *
 * The teardown's biggest structural finding is what these cover: *"Setframe
 * requires a program before Today has anything to offer... correct, and a
 * wall."*
 */

test.use({ viewport: { width: 390, height: 844 } });

test.describe('just start training', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'novice', '/training');
  });

  test('a user with no plan is offered three ways in, not a wall', async ({ page }) => {
    await expect(page.getByTestId('training-no-plan')).toBeVisible();
    await expect(page.getByTestId('just-start')).toBeVisible();
    await expect(page.getByTestId('build-your-own')).toBeVisible();
    await expect(page.getByTestId('browse-templates')).toBeVisible();
  });

  test('the live routes come first, and the one with no data behind it is last', async ({ page }) => {
    const titles = await page
      .getByTestId('no-plan-routes')
      .locator('h2')
      .allTextContents();
    expect(titles).toEqual(['Just start training', 'Build your own', 'Start from a template']);
  });

  test('templates are badged Coming soon and the button is inert', async ({ page }) => {
    /* An enabled control that leads nowhere is the defect the badge exists
       to prevent. */
    await expect(page.getByTestId('no-plan-routes')).toContainText('Coming soon');
    await expect(page.getByTestId('browse-templates')).toBeDisabled();
  });

  test('the empty state promises the session counts either way', async ({ page }) => {
    await expect(page.getByTestId('no-plan-routes')).toContainText(
      'it is a real session either way',
    );
  });
});
