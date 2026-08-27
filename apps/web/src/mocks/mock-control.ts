/**
 * A small imperative handle on the mock layer, for tests that need to control
 * a response rather than accept the shared fixture.
 *
 * Story 42.7. The regression matrix has to drive one exercise through several
 * representations, and has to make a save slow or fail on purpose. The obvious
 * approach — Playwright's `page.route` — does not work here: MSW runs as a
 * service worker and intercepts `fetch` before the request reaches the
 * browser's network layer, so Playwright never sees it and the stub silently
 * does nothing. Every scenario failed against the shared fixture instead.
 *
 * So the override lives inside the mock layer, where MSW can consult it.
 *
 * Development mocks only: this module is imported solely by `mocks/`, which
 * `main.tsx` loads behind `VITE_USE_MOCKS`, so none of it reaches production.
 */

export interface QuickLogBehaviour {
  /** Delay before responding, for observing optimistic state. */
  delayMs?: number;
  /** Respond 500, for rollback and retry scenarios. */
  fail?: boolean;
}

interface MockOverrides {
  session?: unknown;
  quickLog?: QuickLogBehaviour;
}

/**
 * Held in `sessionStorage`, not a module variable.
 *
 * A module variable is wiped by every full page load, so an override set
 * before navigating to the workout route was gone by the time that route
 * asked for its data — the scenarios ran against the shared fixture and
 * failed for reasons that had nothing to do with the product.
 *
 * `sessionStorage` rather than `localStorage` for the same reason the persona
 * uses it: a run must not inherit whatever the last one left behind.
 */
const STORAGE_KEY = 'setframe.mock-overrides';

function read(): MockOverrides {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockOverrides) : {};
  } catch {
    return {};
  }
}

function write(next: MockOverrides) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Storage can throw in private browsing; the shared fixture still works. */
  }
}

export const mockControl = {
  /** Replaces the session GET payload for subsequent requests. */
  setSession(session: unknown) {
    write({ ...read(), session });
  },
  /** Makes the quick-log endpoint slow, failing, or both. */
  setQuickLog(behaviour: QuickLogBehaviour | undefined) {
    const next = read();
    if (behaviour) next.quickLog = behaviour;
    else delete next.quickLog;
    write(next);
  },
  /** Back to the shared fixture. */
  reset() {
    write({});
  },
  sessionOverride: () => read().session,
  quickLogBehaviour: () => read().quickLog,
};

/** Exposes the handle to Playwright. Called only when mocks are enabled. */
export function exposeMockControl() {
  if (typeof window !== 'undefined') {
    (window as unknown as { __setframeMocks?: typeof mockControl }).__setframeMocks = mockControl;
  }
}
