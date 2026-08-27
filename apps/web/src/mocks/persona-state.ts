/**
 * Which product a review persona actually meets.
 *
 * Phase 2 of the UX review system. Phase 1 gave every persona its own Clerk
 * account and then served all three the same fixture, which made the personas
 * cosmetic: a "novice" arrived to a fully configured program and twelve weeks
 * of history, so the one journey that matters for them — getting started —
 * could not be reviewed at all.
 *
 * A persona is selected with `?ux-persona=novice` and remembered for the tab,
 * because the app navigates internally and a query param does not survive a
 * client-side route change. `sessionStorage`, not `localStorage`: a review run
 * must not inherit whatever the last run left behind.
 *
 * Development mocks only. This module is imported solely by `mocks/`, which
 * `main.tsx` loads behind `VITE_USE_MOCKS`, so none of it reaches production.
 */

export type UxPersona = 'novice' | 'lifter' | 'analyst';

const STORAGE_KEY = 'setframe.ux-persona';
const personas: readonly UxPersona[] = ['novice', 'lifter', 'analyst'];

function isPersona(value: string | null): value is UxPersona {
  return value != null && (personas as readonly string[]).includes(value);
}

/**
 * The persona for this tab, or `lifter` as the default.
 *
 * `lifter` rather than "no persona" because the mid-program state is the one
 * most screens were designed against, so an ordinary `dev:mock` session
 * behaves exactly as it did before this module existed.
 */
/**
 * Captures `?ux-persona=` at boot, before any route change can drop it.
 *
 * Reading the param lazily inside a handler was not enough: `/sign-in` issues
 * no API calls, so nothing read the URL while the param was still on it, and
 * by the time `/today` made its first request the app had already navigated
 * and the persona silently fell back to the default. The reviewer duly filed
 * a confident P1 against a novice who was looking at a fully configured
 * program.
 */
export function capturePersonaFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('ux-persona');
    if (isPersona(fromUrl)) window.sessionStorage.setItem(STORAGE_KEY, fromUrl);
  } catch {
    /* Storage can throw in private browsing; the default persona still works. */
  }
}

export function currentPersona(): UxPersona {
  if (typeof window === 'undefined') return 'lifter';
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('ux-persona');
    if (isPersona(fromUrl)) {
      window.sessionStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (isPersona(stored)) return stored;
  } catch {
    /* Private browsing and some automation contexts throw on storage access.
       A review that cannot read a preference should still run. */
  }
  return 'lifter';
}

/** Picks the value for the active persona. */
export function forPersona<T>(byPersona: Record<UxPersona, T>): T {
  return byPersona[currentPersona()];
}

const dayOffset = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/**
 * Whether this persona has a program at all.
 *
 * The novice does not, and that is the entire point: "create your first
 * program" cannot be reviewed against an account that already has one.
 */
export function hasProgram(): boolean {
  return currentPersona() !== 'novice';
}

/**
 * How much training history the persona has behind them.
 *
 * The analyst persona exists to review the payoff loop, which needs enough
 * history for a trend to be real rather than two points and a line.
 */
export function historyWeeks(): number {
  return forPersona({ novice: 0, lifter: 3, analyst: 12 });
}

/**
 * A weight series matching the persona's history.
 *
 * Deliberately not a clean line. A perfectly monotonic series makes every
 * chart look correct and hides exactly the problems a progress review is
 * meant to find — noise, plateaus, and whether the product can tell the
 * difference between the two.
 */
export function seededWeightSeries(): { localDate: string; value: number }[] {
  const weeks = historyWeeks();
  if (weeks === 0) return [];
  const points: { localDate: string; value: number }[] = [];
  for (let i = weeks * 7; i >= 0; i -= 1) {
    const drift = (weeks * 7 - i) * 0.06;
    // A repeatable wobble, so two runs of the same review compare like for like.
    const wobble = Math.sin(i * 1.7) * 0.8;
    points.push({ localDate: dayOffset(i), value: Number((182 - drift + wobble).toFixed(1)) });
  }
  return points;
}

/** Session ids the mock treats as "already finished" for this persona. */
export function completedSessionsToday(): boolean {
  // Only the analyst arrives to an already-finished day; the lifter needs a
  // session they can actually start, or the core journey has nothing to do.
  return currentPersona() === 'analyst';
}
