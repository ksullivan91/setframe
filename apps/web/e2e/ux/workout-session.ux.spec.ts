import { test, signInAs } from './auth';
import { ReviewSession, writeReport } from './review';

/**
 * Journey B — a real gym session.
 *
 * The core daily-use loop, reviewed as an experienced lifter on a phone. This
 * is the flow the product lives or dies on: it happens between sets, standing,
 * one-handed, often on poor gym wifi, and every extra tap is paid dozens of
 * times per workout.
 *
 * A review, not a regression test. It walks the flow and records what it sees;
 * it only fails on genuine breakage — a route that will not load, a control
 * that does not exist — because a hard assertion halfway through would hide
 * everything after it, which is precisely what a review must not do.
 */
test.describe('UX review — active workout session', () => {
  test('experienced lifter logs today’s workout on a phone', async ({ page }) => {
    test.setTimeout(180_000);

    const review = new ReviewSession(page, 'workout-session', 'lifter');
    review.watchConsole();

    await signInAs(page, 'lifter', '/today');
    await page.waitForTimeout(1500);
    await review.capture('today-on-arrival');

    /* Interaction cost starts here: everything before this is the reviewer
       getting into position, not the user doing their workout. */
    const start = page.getByRole('button', { name: /start workout/i });
    const canStart = await start.count();

    if (!canStart) {
      review.find({
        severity: 'P1',
        title: 'No way to start today’s workout',
        observed: 'Today offered no “Start workout” control for a user with an active program.',
        impact:
          'The core daily loop is unreachable. Everything else in the product assumes a session can begin here.',
        evidence: await review.capture('no-start-control'),
      });
      writeReport(review.toReport());
      return;
    }

    await review.tap(start.first());
    await page.waitForURL(/\/workout\//, { timeout: 30_000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    await review.capture('session-opened');

    /* Quick Log is the fast path the input redesign (stories 58/59) exists to
       provide. Whether it is reachable without opening the detailed editor is
       the single highest-value question on this screen. */
    const quickWeight = page.getByLabel(/^Quick log: Weight/).first();
    const quickReps = page.getByLabel(/^Quick log: Reps/).first();

    if (await quickWeight.count()) {
      await review.type(quickWeight, '185');
      await review.type(quickReps, '6');
      await review.capture('quick-log-filled');

      const logAll = page.getByRole('button', { name: /^Log (all|remaining|1 set)/i }).first();
      if (await logAll.count()) {
        const label = (await logAll.textContent())?.trim() ?? '';
        await review.tap(logAll);
        await page.waitForTimeout(2000);
        await review.capture('after-quick-log');
        review.note(`Quick Log action was labelled “${label}”.`);
      } else {
        review.find({
          severity: 'P1',
          title: 'Quick Log has fields but no action',
          observed: 'Weight and reps could be entered, but no button was offered to persist them.',
          impact: 'The fast path collects input and then strands it — worse than not offering it.',
          evidence: await review.capture('quick-log-no-action'),
        });
      }
    } else {
      review.note('Quick Log was not offered for the first exercise (already logged, or unsupported prescription).');
    }

    /* Horizontal overflow is the failure this repo has shipped before, and it
       is invisible in a screenshot until someone scrolls. Measured rather
       than eyeballed. */
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) {
      review.find({
        severity: 'P2',
        title: 'Page scrolls horizontally on a phone',
        observed: `Document is ${overflow}px wider than the viewport at 390px.`,
        impact: 'Content drifts sideways mid-workout, which is disorienting one-handed.',
        evidence: await review.capture('horizontal-overflow'),
      });
    }

    /* Finish is the exit. If it cannot be reached without hunting, the session
       never ends cleanly and the next day's Today screen is wrong.

       Guarded on the session's own state first. The first run of this journey
       raised a P1 for a missing Finish control against a session that was
       already complete — where its absence is correct. A reviewer that cannot
       tell a legitimate state from a defect trains people to ignore it, so
       the state is checked before the control is judged. */
    const finish = page.getByRole('button', { name: /finish workout/i }).first();
    const alreadyComplete = await page.getByRole('heading', { name: /workout complete/i }).count();
    if (alreadyComplete) {
      review.note(
        'Session was already complete on arrival, so Finish is correctly absent — review mode, not a missing control.',
      );
      /* Worth reviewing on its own terms: this is the completed-workout review
         surface, and dead controls here are the defect stories 42A/42B fixed. */
      const deadControls = await page
        .getByRole('button', { name: /^(Save|Duplicate set|Delete set|Add set)/ })
        .count();
      if (deadControls) {
        review.find({
          severity: 'P2',
          title: 'Mutation controls still present in completed-workout review',
          observed: `${deadControls} editing control(s) rendered on a workout that is already complete.`,
          impact: 'A review surface offering actions that cannot be taken reads as an unfinished screen.',
          evidence: await review.capture('dead-controls-in-review'),
        });
      } else {
        review.note('Completed-workout review offered no dead editing controls.');
      }
    } else if (await finish.count()) {
      const box = await finish.boundingBox();
      review.note(
        box ? `Finish workout is ${Math.round(box.height)}px tall.` : 'Finish workout is present but has no box.',
      );
      if (box && box.height < 44) {
        review.find({
          severity: 'P2',
          title: 'Finish workout is below the comfortable touch target',
          observed: `The control measures ${Math.round(box.height)}px tall; 44px is the accepted minimum.`,
          impact: 'Sweaty hands and a phone held one-handed make small targets genuinely hard to hit.',
        });
      }
    } else {
      review.find({
        severity: 'P1',
        title: 'No reachable way to finish the workout',
        observed: 'No “Finish workout” control was present on the session screen.',
        impact: 'The session cannot be closed, so Today stays wrong the following day.',
        evidence: await review.capture('no-finish-control'),
      });
    }

    await review.capture('session-end-state');
    review.note(`Reaching this point cost ${review.interactions} interactions.`);
    writeReport(review.toReport());
  });
});
