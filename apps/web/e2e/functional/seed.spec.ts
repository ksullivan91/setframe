import { test } from '../ux/auth';
import { signInAs } from '../ux/auth';

/**
 * The starting state Playwright's planner and generator agents explore from.
 *
 * `init-agents` scaffolds this file empty, which is fine for an app that opens
 * onto something. Setframe does not: every route except `/sign-in` sits behind
 * Clerk, so an agent starting from a blank page would explore a sign-in form
 * and conclude the product is one screen.
 *
 * Seeding it with a real signed-in session is what makes the agents useful
 * here. It reuses the same programmatic sign-in the UX reviewer uses — the
 * agents get an authenticated `/today` and can discover the actual product.
 *
 * The `lifter` persona deliberately: it has an active program, a scheduled
 * workout and some history, so the largest surface is reachable. A novice
 * would show the agents an empty product and a much smaller map.
 *
 * It lives under `functional/` rather than in its own project because every
 * project narrows `testMatch` to its own specs, and a project added mid-session
 * is invisible to an MCP server that read the config when it started. Sitting
 * here it is also a genuine smoke test: `signInAs` throws if sign-in breaks.
 */
test('seed', async ({ page }) => {
  await signInAs(page, 'lifter', '/today');
});
