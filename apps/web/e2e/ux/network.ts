import type { Page, Request, Response } from '@playwright/test';
import type { Finding } from './review';

/**
 * Watching what the app actually does on the wire.
 *
 * Story §11. This exists because a class of UX defect is invisible on screen
 * and obvious in the network panel: saving set 1 blocking set 2 for 1.4
 * seconds is not an implementation detail, it is the user standing in a gym
 * waiting. Reviewing only pixels means never seeing it.
 *
 * Observation only — no assertions. The reviewer reports; a journey fails only
 * on genuine breakage.
 */

interface Call {
  method: string;
  /** Path with the origin and query stripped, so ids do not fragment grouping. */
  route: string;
  url: string;
  startedAt: number;
  endedAt?: number;
  status?: number;
  failed?: boolean;
}

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** `/v1/workout-sets/abc-123` → `/v1/workout-sets/:id`, so retries group. */
function normalise(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+(?=\/|$)/g, '/:id');
  } catch {
    return url;
  }
}

export class NetworkWatcher {
  private readonly calls: Call[] = [];
  private readonly byUrl = new Map<string, Call>();

  constructor(private readonly page: Page) {}

  /** Starts recording. Only *our* API; assets and third parties are noise. */
  start(): void {
    /* Origin-scoped, not just `/v1/`. Clerk's own API is also versioned under
       `/v1/`, so a bare path match pulled its traffic in and duly reported
       "repeated mutation: POST /v1/environment ×2" — a finding about the auth
       provider's internals, which is not this product's UX. */
    const appOrigin = (() => {
      try {
        return new URL(this.page.url()).origin;
      } catch {
        return '';
      }
    })();
    const isApi = (url: string) => {
      if (!/\/v1\//.test(url)) return false;
      if (/clerk|accounts\.dev/i.test(url)) return false;
      try {
        return appOrigin === '' || new URL(url).origin === appOrigin;
      } catch {
        return false;
      }
    };

    this.page.on('request', (request: Request) => {
      if (!isApi(request.url())) return;
      const call: Call = {
        method: request.method(),
        route: normalise(request.url()),
        url: request.url(),
        startedAt: Date.now(),
      };
      this.calls.push(call);
      this.byUrl.set(`${request.method()} ${request.url()}`, call);
    });

    this.page.on('response', (response: Response) => {
      const call = this.byUrl.get(`${response.request().method()} ${response.url()}`);
      if (!call) return;
      call.endedAt = Date.now();
      call.status = response.status();
    });

    this.page.on('requestfailed', (request: Request) => {
      const call = this.byUrl.get(`${request.method()} ${request.url()}`);
      if (!call) return;
      call.endedAt = Date.now();
      call.failed = true;
    });
  }

  get requestCount(): number {
    return this.calls.length;
  }

  /** A one-line summary for the report's Notes. */
  summary(): string {
    const mutations = this.calls.filter((call) => MUTATING.has(call.method)).length;
    return `${this.calls.length} API request(s), ${mutations} mutation(s).`;
  }

  /**
   * What the traffic says about the experience.
   *
   * Each check corresponds to a failure this product could plausibly have, and
   * each is phrased as something the user feels rather than something the
   * network did.
   */
  findings(): Finding[] {
    const found: Finding[] = [];
    const durationOf = (call: Call) => (call.endedAt ?? Date.now()) - call.startedAt;

    /* Failed calls first: a mutation that never landed is data the user
       believes they saved. */
    const failed = this.calls.filter((call) => call.failed || (call.status != null && call.status >= 400));
    if (failed.length) {
      const worst = failed[0]!;
      found.push({
        severity: MUTATING.has(worst.method) ? 'P0' : 'P1',
        title: `API call failed: ${worst.method} ${worst.route}`,
        observed: `${failed.length} request(s) failed or returned ≥400. First: ${worst.method} ${worst.route} → ${worst.failed ? 'network failure' : worst.status}.`,
        impact: MUTATING.has(worst.method)
          ? 'A failed mutation means the user believes something is saved that is not.'
          : 'The screen is rendering from data it did not actually receive.',
      });
    }

    /* Duplicate identical mutations: the fingerprint of a double-fire, which
       in this product means a duplicated set or a duplicated session. */
    const mutationCounts = new Map<string, number>();
    for (const call of this.calls) {
      if (!MUTATING.has(call.method)) continue;
      const key = `${call.method} ${call.route}`;
      mutationCounts.set(key, (mutationCounts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of mutationCounts) {
      if (count > 1 && !key.startsWith('PATCH')) {
        found.push({
          severity: 'P1',
          title: `Repeated mutation: ${key} ×${count}`,
          observed: `The same mutating request was issued ${count} times during one journey.`,
          impact:
            'Repeated creates duplicate records. This product has shipped a duplicated workout session from exactly this shape.',
        });
      }
    }

    /* Serialised mutations. The specific complaint §11 names: one save
       blocking the next, which mid-workout is the user waiting between sets. */
    const mutations = this.calls
      .filter((call) => MUTATING.has(call.method) && call.endedAt != null)
      .sort((a, b) => a.startedAt - b.startedAt);
    for (let i = 1; i < mutations.length; i += 1) {
      const previous = mutations[i - 1]!;
      const current = mutations[i]!;
      const gap = current.startedAt - (previous.endedAt ?? previous.startedAt);
      // Started only after the previous finished, and the wait was noticeable.
      if (current.startedAt >= (previous.endedAt ?? 0) && gap >= 0 && durationOf(previous) > 800) {
        found.push({
          severity: 'P2',
          title: 'Mutations appear serialised behind one another',
          observed: `${current.method} ${current.route} started after ${previous.method} ${previous.route} completed, which took ${durationOf(previous)}ms.`,
          impact:
            'Waiting for one save before the next can begin is the user standing still between sets. Saves should be independent.',
        });
        break;
      }
    }

    /* Slow mutations with no optimistic path. Under mocks this will rarely
       fire, which is honest: it is a real-network property. */
    const slow = mutations.filter((call) => durationOf(call) > 1_200);
    if (slow.length) {
      found.push({
        severity: 'P2',
        title: 'Slow mutation without visible optimistic feedback',
        observed: `${slow.length} mutation(s) took over 1.2s; slowest ${durationOf(slow[0]!)}ms on ${slow[0]!.route}.`,
        impact: 'On gym wifi this is dead time unless the UI has already moved on.',
      });
    }

    /* Duplicate reads of the same resource in one journey: usually two
       components fetching independently rather than sharing a query. */
    const readCounts = new Map<string, number>();
    for (const call of this.calls) {
      if (call.method !== 'GET') continue;
      const key = call.route;
      readCounts.set(key, (readCounts.get(key) ?? 0) + 1);
    }
    const chatty = [...readCounts.entries()].filter(([, count]) => count >= 4);
    if (chatty.length) {
      const [route, count] = chatty[0]!;
      found.push({
        severity: 'P3',
        title: `Repeated reads of ${route}`,
        observed: `${route} was fetched ${count} times in one journey.`,
        impact: 'Usually two components fetching independently instead of sharing one query. Cheap on wifi, not on cellular.',
      });
    }

    return found;
  }
}
