import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const { mockSelect, db } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const db = { select: mockSelect, insert: vi.fn(), update: vi.fn(), delete: vi.fn() };
  return { mockSelect, db };
});

vi.mock('../lib/clerk', () => ({ verifyBearerToken: vi.fn(async () => ({ sub: 'clerk-user-1' })) }));
vi.mock('../lib/db', () => ({ getDb: () => db }));

function selectChain(rows: unknown[]) {
  const resolved = Promise.resolve(rows);
  /* `limit` is what requireAuth's user lookup calls; `orderBy` is what this
     route calls. The chain has to answer both or the auth pre-handler 500s
     before the route is ever reached. */
  const chain = {
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockResolvedValue(rows),
    then: resolved.then.bind(resolved),
  };
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(chain) }) };
}

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
const day = (localDate: string, over: Record<string, unknown> = {}) => ({
  localDate,
  weightValue: null,
  bodyFatPercentage: null,
  restingHeartRate: null,
  hrvSdnnMs: null,
  sleepTotalMinutes: null,
  steps: null,
  activeEnergyKcal: null,
  exerciseMinutes: null,
  vo2Max: null,
  ...over,
});

const seriesFor = (body: { series: { key: string; points: unknown[]; latest: number | null; change: number | null }[] }, key: string) =>
  body.series.find((s) => s.key === key)!;

beforeEach(() => vi.clearAllMocks());

describe('GET /v1/trends', () => {
  it('returns a sparse series per metric, ascending', async () => {
    mockSelect.mockReturnValueOnce(selectChain([userRow])).mockReturnValueOnce(
      selectChain([
        day('2026-09-01', { weightValue: '170.2', restingHeartRate: '56' }),
        day('2026-09-02'),
        day('2026-09-03', { weightValue: '168.6', restingHeartRate: '54' }),
      ]),
    ).mockReturnValueOnce(selectChain([]));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/v1/trends?from=2026-09-01&to=2026-09-03', headers: authHeader });
    expect(res.statusCode).toBe(200);

    const weight = seriesFor(res.json(), 'weight');
    // The middle day recorded nothing, so it is absent rather than zero — a
    // zero weight is not a light day, it is a day nobody weighed.
    expect(weight.points).toEqual([
      { localDate: '2026-09-01', value: 170.2 },
      { localDate: '2026-09-03', value: 168.6 },
    ]);
    expect(weight.latest).toBe(168.6);
    expect(weight.change).toBeCloseTo(-1.6, 5);
  });

  it('reports no change for a single reading', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([day('2026-09-03', { steps: 8412 })]))
      .mockReturnValueOnce(selectChain([]));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/v1/trends?from=2026-09-01&to=2026-09-03', headers: authHeader });
    const steps = seriesFor(res.json(), 'steps');
    expect(steps.latest).toBe(8412);
    // Not 0 — one reading has nothing to be a change from.
    expect(steps.change).toBeNull();
  });

  it('returns an empty series rather than omitting a metric nobody records', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([day('2026-09-03', { steps: 1000 })]))
      .mockReturnValueOnce(selectChain([]));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/v1/trends?from=2026-09-01&to=2026-09-03', headers: authHeader });
    const vo2 = seriesFor(res.json(), 'vo2Max');
    expect(vo2.points).toEqual([]);
    expect(vo2.latest).toBeNull();
  });

  it('prefers the user’s own weigh-in over the imported one', async () => {
    /* Architecture §4: a manual entry is shown first and neither source
       overwrites the other. Reading only the snapshot would show nothing at
       all to anyone who weighs in by hand. */
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([day('2026-09-03', { weightValue: '170.4' })]))
      .mockReturnValueOnce(
        selectChain([{ localDate: '2026-09-03', value: '168.6', unit: 'lb' }]),
      );
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/v1/trends?from=2026-09-01&to=2026-09-03', headers: authHeader });
    expect(seriesFor(res.json(), 'weight').points).toEqual([
      { localDate: '2026-09-03', value: 168.6 },
    ]);
  });

  it('converts a weigh-in entered in kilograms', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([day('2026-09-03')]))
      .mockReturnValueOnce(selectChain([{ localDate: '2026-09-03', value: '76.5', unit: 'kg' }]));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/v1/trends?from=2026-09-01&to=2026-09-03', headers: authHeader });
    // 76.5kg is 168.7lb, not 76.5.
    expect(seriesFor(res.json(), 'weight').points[0]!.value).toBeCloseTo(168.7, 1);
  });

  it('still shows an imported weight on a day with no manual entry', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([day('2026-09-02', { weightValue: '170.4' })]))
      .mockReturnValueOnce(selectChain([]));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/v1/trends?from=2026-09-01&to=2026-09-03', headers: authHeader });
    expect(seriesFor(res.json(), 'weight').points).toEqual([
      { localDate: '2026-09-02', value: 170.4 },
    ]);
  });

  it('refuses a backwards range', async () => {
    mockSelect.mockReturnValueOnce(selectChain([userRow]));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/v1/trends?from=2026-09-30&to=2026-09-01', headers: authHeader });
    expect(res.statusCode).toBe(400);
  });

  it('needs both ends of the range', async () => {
    /* Unlike the params-validated routes, a querystring failure here still
       runs the auth pre-handler first, so the user lookup must be answered
       or the 400 arrives as a 500. */
    mockSelect.mockReturnValueOnce(selectChain([userRow]));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/v1/trends?from=2026-09-01', headers: authHeader });
    expect(res.statusCode).toBe(400);
  });
});
