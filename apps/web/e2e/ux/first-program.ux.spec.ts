import { test, signInAs } from './auth';
import { ReviewSession, writeReport } from './review';

/**
 * Journey A — a new user reaching their first program.
 *
 * The acquisition loop, reviewed as someone who has never written a training
 * block and does not know what a "day type" or a "prescription" is. They will
 * not learn the vocabulary to get started; if the first screen assumes it,
 * they leave.
 *
 * This journey could not exist before phase 2. Every persona previously met
 * the same fixture — one with a program already configured — so "create your
 * first program" had nothing to review. The novice persona now arrives with
 * no program at all, which is the only honest way to look at this flow.
 */
test.describe('UX review — first program', () => {
  test('novice arrives with no program and tries to get started', async ({ page }) => {
    test.setTimeout(180_000);

    const review = new ReviewSession(page, 'first-program', 'novice');
    review.watchConsole();

    await signInAs(page, 'novice', '/today');
    await page.waitForTimeout(1500);
    await review.capture('today-with-no-program');

    /* The first question: does Today tell someone with nothing set up what to
       do next? An empty state that merely reports emptiness is a dead end. */
    const bodyText = (await page.locator('body').innerText()).toLowerCase();
    const offersSetup = /program|get started|create|guided|set ?up/.test(bodyText);
    if (!offersSetup) {
      review.find({
        severity: 'P0',
        title: 'No route out of the empty state',
        observed: 'Today, for a user with no program, mentions nothing about creating one.',
        impact: 'A new user has no next action. This is where they stop using the product.',
        evidence: await review.capture('empty-state-dead-end'),
      });
      writeReport(review.toReport());
      return;
    }

    /* Matching the product's actual words, not the ones the reviewer expected.
       An earlier version of this regex omitted "setup" and so missed
       "Start guided setup" entirely, then filed a confident P1 saying no
       control existed — against a screen where the button was the largest
       thing on it. A reviewer's own selector is perfectly capable of
       manufacturing a finding, so a "missing" control is only reported after
       matching on how the product actually speaks. */
    const setupPattern = /program|get started|create|guided|set ?up/i;
    const setupLink = page
      .getByRole('link', { name: setupPattern })
      .or(page.getByRole('button', { name: setupPattern }))
      .first();

    if (!(await setupLink.count())) {
      review.find({
        severity: 'P1',
        title: 'Setup is described but not offered',
        observed: 'Today explains that a program is needed but exposes no control to create one.',
        impact: 'The user must find Training on their own, having just been told what they lack.',
        evidence: await review.capture('no-setup-control'),
      });
      writeReport(review.toReport());
      return;
    }

    await review.tap(setupLink);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await review.capture('after-following-setup');

    /* Jargon check. This is the single most common way a setup flow loses a
       novice: it is correct, and it is written for someone who already knows
       the model. Terms are only flagged when unaccompanied by an explanation. */
    const pageText = await page.locator('body').innerText();
    const jargon = ['day type', 'prescription', 'top set', 'backoff', 'per side', 'mesocycle'];
    const bare = jargon.filter((term) => new RegExp(term, 'i').test(pageText));
    if (bare.length) {
      review.note(`Setup surface uses domain vocabulary: ${bare.join(', ')}. Check each is explained in place.`);
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) {
      review.find({
        severity: 'P2',
        title: 'Setup scrolls horizontally on a phone',
        observed: `Document is ${overflow}px wider than the viewport.`,
        impact: 'A first impression that drifts sideways reads as broken.',
        evidence: await review.capture('setup-overflow'),
      });
    }

    /* Touch targets, measured rather than eyeballed. A novice on a phone is
       the least forgiving audience for a control that is hard to hit. */
    const buttons = page.getByRole('button');
    const count = Math.min(await buttons.count(), 12);
    const small: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const button = buttons.nth(i);
      if (!(await button.isVisible())) continue;
      const box = await button.boundingBox();
      const label = ((await button.textContent()) ?? '').trim().slice(0, 40);
      if (box && box.height < 44 && label) small.push(`${label} (${Math.round(box.height)}px)`);
    }
    if (small.length) {
      review.find({
        severity: 'P2',
        title: 'Controls below the comfortable touch target',
        observed: `${small.length} visible control(s) under 44px tall: ${small.join(', ')}.`,
        impact: 'Small targets are the first friction a new user meets, before they have any reason to persist.',
        evidence: await review.capture('small-touch-targets'),
      });
    }

    await review.capture('setup-end-state');
    review.note(`Reaching this point cost ${review.interactions} interactions.`);
    writeReport(review.toReport());
  });
});
