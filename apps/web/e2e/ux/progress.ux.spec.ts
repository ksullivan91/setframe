import { test, signInAs } from './auth';
import { ReviewSession, writeReport } from './review';

/**
 * Journey D — the payoff.
 *
 * The retention loop, reviewed as someone who comes back specifically to find
 * out whether the last twelve weeks meant anything. They are not here to log;
 * they are here to be told something true about their training, and they will
 * not accept a number they cannot interrogate.
 *
 * This is the journey the product is ultimately judged on. Acquisition gets
 * someone to a first workout and the daily loop keeps them logging, but a
 * progress screen that cannot answer "did I get stronger?" is where a training
 * app quietly becomes a spreadsheet people stop opening.
 */
test.describe('UX review — progress payoff', () => {
  test('data-motivated user asks whether twelve weeks meant anything', async ({ page }) => {
    test.setTimeout(180_000);

    const review = new ReviewSession(page, 'progress', 'analyst');
    review.watchConsole();

    await signInAs(page, 'analyst', '/progress');
    await page.waitForTimeout(2500);
    await review.capture('progress-on-arrival');

    const bodyText = await page.locator('body').innerText();

    /* The failure this screen has actually shipped before: a contract mismatch
       under mocks put Progress into its error state, and nobody noticed
       because nobody could reach it. An error state here is a P0 — the
       retention loop is simply gone. */
    if (/couldn.t load|something went wrong|try again/i.test(bodyText)) {
      review.find({
        severity: 'P0',
        title: 'Progress renders an error instead of progress',
        observed: 'The screen showed its error state rather than any training data.',
        impact: 'The entire payoff loop is unreachable. This is why people stop opening a training app.',
        evidence: await review.capture('progress-error-state'),
      });
      writeReport(review.toReport());
      return;
    }

    /* Empty states are legitimate for a new user and a failure for this one:
       the analyst persona is seeded with twelve weeks precisely so "not enough
       data" is a wrong answer here. */
    const looksEmpty = /no data|not enough|nothing yet|get started/i.test(bodyText);
    if (looksEmpty) {
      review.find({
        severity: 'P1',
        title: 'Progress reports no data for a user with twelve weeks of it',
        observed: 'The screen showed an empty or "not enough data" state.',
        impact:
          'Either the screen is wrong or the thresholds are too high. Both leave a committed user with nothing.',
        evidence: await review.capture('unexpected-empty-state'),
      });
    }

    /* Does anything here answer the actual question? A screen full of
       accurate numbers that never renders a verdict is a spreadsheet. */
    const hasCharts = await page.locator('svg').count();
    review.note(`Progress rendered ${hasCharts} chart element(s).`);
    if (hasCharts === 0 && !looksEmpty) {
      review.find({
        severity: 'P1',
        title: 'No visualisation of a trend',
        observed: 'Progress rendered no chart for a user with twelve weeks of history.',
        impact: 'A trend expressed only as numbers asks the user to do the comparison the product exists to do.',
        evidence: await review.capture('no-charts'),
      });
    }

    /* Metric explanations. This product deliberately ships `MetricInfo`
       popovers because its metrics (estimated 1RM, adherence, composition) are
       not self-evident. A metric with no way to ask "what is this?" is a
       number the user has to take on faith. */
    const explainers = await page.getByRole('button', { name: /what|about|info|explain/i }).count();
    review.note(`Found ${explainers} metric explainer control(s).`);

    /* Measured before any interaction, so a layout problem can be attributed
       to the screen itself rather than to whatever the reviewer touched. */
    const overflowOnArrival = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflowOnArrival > 0) {
      review.find({
        severity: 'P2',
        title: 'Progress scrolls horizontally on arrival',
        observed: `Document is ${overflowOnArrival}px wider than the viewport before any interaction.`,
        impact: 'Charts that push the page sideways are the classic mobile-web dataviz failure.',
        evidence: await review.capture('overflow-on-arrival'),
      });
    }

    /* Range controls are how an analyst interrogates rather than accepts. */
    const ranges = page.getByRole('button', { name: /^(4w|8w|12w|6m|1y|all|30 days|90 days)$/i });
    const rangeCount = await ranges.count();
    if (rangeCount > 0) {
      const target = ranges.last();
      /* Name the control. The first version of this journey reported a
         52,886px overflow without saying what had been clicked, which is a
         dramatic number and an unactionable report. */
      const label = ((await target.textContent()) ?? '').trim();
      await review.tap(target);
      await page.waitForTimeout(1800);
      await review.capture('after-changing-range');
      review.note(`Range controls available: ${rangeCount}. Selected “${label}”.`);

      const overflowAfter = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflowAfter > overflowOnArrival + 8) {
        review.find({
          severity: 'P1',
          title: `Selecting “${label}” breaks the page layout`,
          observed: `Horizontal overflow went from ${overflowOnArrival}px to ${overflowAfter}px after choosing “${label}”.`,
          impact:
            'A range control that destroys the layout makes the one screen built for interrogation unusable at the moment it is interrogated.',
          evidence: await review.capture('overflow-after-range-change'),
        });
      }
    } else {
      review.find({
        severity: 'P2',
        title: 'Progress cannot be re-scoped',
        observed: 'No time-range control was offered.',
        impact:
          'The user can see one window and cannot ask a different question, which is most of what this screen is for.',
        evidence: await review.capture('no-range-control'),
      });
    }

    await review.capture('progress-end-state');
    review.note(`Reaching this point cost ${review.interactions} interactions.`);
    writeReport(review.toReport());
  });
});
