import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const { mockSelect, mockInsert, mockUpdate, db, captured } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const captured: { activity: Record<string, unknown>[]; conflictSets: Record<string, unknown>[] } = {
    activity: [],
    conflictSets: [],
  };
  const db = { select: mockSelect, insert: mockInsert, update: mockUpdate, delete: vi.fn() };
  return { mockSelect, mockInsert, mockUpdate, db, captured };
});

vi.mock('../lib/clerk', () => ({ verifyBearerToken: vi.fn(async () => ({ sub: 'clerk-user-1' })) }));
vi.mock('../lib/db', () => ({ getDb: () => db }));

const authHeader = { authorization: 'Bearer test-token' };
const userRow = {
  id: '11111111-1111-4111-8111-111111111111',
  clerkUserId: 'clerk-user-1',
  displayName: null,
  preferredUnits: 'imperial',
  timezone: 'UTC',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function selectChain(rows: unknown[]) {
  const resolved = Promise.resolve(rows);
  const chain = {
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockResolvedValue(rows),
    then: resolved.then.bind(resolved),
  };
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(chain) }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  captured.activity = [];
  captured.conflictSets = [];

  // requireAuth's user lookup, then the sync-state lookup.
  mockSelect.mockImplementation(() => selectChain([userRow]));

  mockInsert.mockImplementation(() => ({
    values: (v: Record<string, unknown>) => {
      captured.activity.push(v);
      return {
        onConflictDoUpdate: ({ set }: { set: Record<string, unknown> }) => {
          captured.conflictSets.push(set);
          return Promise.resolve();
        },
        returning: () => Promise.resolve([{ id: 'sync-1', status: 'ok' }]),
      };
    },
  }));

  mockUpdate.mockImplementation(() => ({
    set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: 'sync-1', status: 'ok' }]) }) }),
  }));
});

const fullDay = {
  localDate: '2026-09-01',
  timezone: 'America/Chicago',
  syncedThrough: '2026-09-02T05:00:00.000Z',
  outcome: 'ok' as const,
  activity: {
    steps: 8432, activeEnergyKcal: 612, exerciseMinutes: 48,
    restingHeartRate: 54, hrvSdnnMs: 61, vo2Max: 44.2,
    weightKg: 80.4, bodyFatPercentage: 18.1, sleepTotalMinutes: 431,
  },
  sources: { steps: 'iPhone', restingHeartRate: 'Apple Watch' },
};

describe('POST /v1/integrations/apple-health/reconcile', () => {
  /**
   * The bug this route shipped with: it wrote `local_date`, `timezone`,
   * `sync_status` and `reconciled_at`, and no metric column at all. Every
   * value stayed null, so Trends read "Nothing recorded yet" for everything
   * except the weight the user types by hand.
   */
  it('writes the metrics, not just the bookkeeping', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/integrations/apple-health/reconcile',
      headers: authHeader,
      payload: { days: [fullDay] },
    });

    expect(res.statusCode).toBe(200);
    const written = captured.activity.find((v) => 'steps' in v)!;
    expect(written).toBeDefined();
    expect(written.steps).toBe(8432);
    expect(written.exerciseMinutes).toBe(48);
    // Numerics go to the driver as strings.
    expect(written.activeEnergyKcal).toBe('612');
    expect(written.restingHeartRate).toBe('54');
    expect(written.vo2Max).toBe('44.2');
    expect(written.sleepTotalMinutes).toBe('431');
  });

  it('stores weight in the unit it was sent in', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'POST', url: '/v1/integrations/apple-health/reconcile',
      headers: authHeader, payload: { days: [fullDay] },
    });

    const written = captured.activity.find((v) => 'weightValue' in v)!;
    expect(written.weightValue).toBe('80.4');
    expect(written.weightUnit).toBe('kg');
  });

  it('records where each metric came from', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'POST', url: '/v1/integrations/apple-health/reconcile',
      headers: authHeader, payload: { days: [fullDay] },
    });

    const written = captured.activity.find((v) => 'sourceProvenance' in v)!;
    expect(written.sourceProvenance).toEqual({ steps: 'iPhone', restingHeartRate: 'Apple Watch' });
  });

  /* Architecture §5: resending the same payload must never change the
     stored result. A partial merge would also pin a metric that has since
     been deleted in Health, so the conflict set carries every column. */
  it('upserts on (user, date) and can write a metric back to null', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'POST', url: '/v1/integrations/apple-health/reconcile',
      headers: authHeader,
      payload: { days: [{ ...fullDay, activity: { ...fullDay.activity, steps: null } }] },
    });

    const set = captured.conflictSets.find((s) => 'steps' in s)!;
    expect(set).toBeDefined();
    expect(set.steps).toBeNull();
  });

  it('settles each day and says so', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/v1/integrations/apple-health/reconcile',
      headers: authHeader,
      payload: {
        days: [
          fullDay,
          { ...fullDay, localDate: '2026-09-02', outcome: 'error' as const, activity: null },
        ],
      },
    });

    const body = res.json() as { days: { localDate: string; syncStatus: string }[] };
    expect(body.days).toEqual([
      { localDate: '2026-09-01', syncStatus: 'complete' },
      { localDate: '2026-09-02', syncStatus: 'error' },
    ]);
  });

  it('refuses an unbounded batch', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/v1/integrations/apple-health/reconcile',
      headers: authHeader,
      payload: { days: Array.from({ length: 61 }, (_, i) => ({ ...fullDay, localDate: `2026-07-${String(i % 28 + 1).padStart(2, '0')}` })) },
    });
    expect(res.statusCode).toBe(400);
  });
});
