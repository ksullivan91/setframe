import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const { mockSelect, mockInsert, mockDelete, db } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockDelete = vi.fn();
  const db = { select: mockSelect, insert: mockInsert, update: vi.fn(), delete: mockDelete };
  return { mockSelect, mockInsert, mockDelete, db };
});

vi.mock('../lib/clerk', () => ({
  verifyBearerToken: vi.fn(async () => ({ sub: 'clerk-user-1' })),
}));

vi.mock('../lib/db', () => ({
  getDb: () => db,
}));

function queryChain(rows: unknown[]) {
  const resolved = Promise.resolve(rows);
  return {
    limit: vi.fn().mockResolvedValue(rows),
    then: resolved.then.bind(resolved),
  };
}

function selectChain(rows: unknown[]) {
  const chain = queryChain(rows);
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(chain) }) };
}

function insertChain(rows: unknown[]) {
  const returning = { returning: vi.fn().mockResolvedValue(rows) };
  return {
    values: vi.fn().mockReturnValue({
      ...returning,
      onConflictDoUpdate: vi.fn().mockReturnValue(returning),
    }),
  };
}

const authHeader = { authorization: `Bearer ${'test-token'}` };
const userRow = {
  id: '11111111-1111-4111-8111-111111111111',
  clerkUserId: 'clerk-user-1',
  displayName: null,
  preferredUnits: 'imperial',
  timezone: 'UTC',
  createdAt: new Date(),
  updatedAt: new Date(),
};
const restRow = {
  id: '77777777-7777-4777-8777-777777777777',
  userId: userRow.id,
  localDate: '2026-08-24',
  timezone: 'America/Chicago',
  note: null,
  createdAt: new Date('2026-08-24T12:00:00Z'),
  updatedAt: new Date('2026-08-24T12:00:00Z'),
};

const payload = { localDate: '2026-08-24', timezone: 'America/Chicago' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /v1/rest-days', () => {
  it('records a rest day on a day with no workout', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([]));
    mockInsert.mockReturnValueOnce(insertChain([restRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/rest-days',
      headers: authHeader,
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ localDate: '2026-08-24', note: null });
  });

  // Training and resting are contradictory claims about the same day.
  it('refuses when a workout is already logged for the day', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ id: 'session-1', status: 'completed' }]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/rest-days',
      headers: authHeader,
      payload,
    });

    expect(response.statusCode).toBe(409);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('ignores an abandoned session, which is not training', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ id: 'session-1', status: 'abandoned' }]));
    mockInsert.mockReturnValueOnce(insertChain([restRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/rest-days',
      headers: authHeader,
      payload,
    });

    expect(response.statusCode).toBe(200);
  });

  // Double-tapping the button must not create a second row or 500 on the
  // unique index, so the write is an upsert rather than a check-then-insert
  // that two concurrent requests could both slip past.
  it('is idempotent for a day already marked as rest', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([]));
    const insert = insertChain([restRow]);
    mockInsert.mockReturnValueOnce(insert);

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/rest-days',
      headers: authHeader,
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: restRow.id });
    expect(insert.values.mock.results[0]!.value.onConflictDoUpdate).toHaveBeenCalled();
  });

  // Story 21 — rest can be planned ahead or corrected after the fact from
  // the Training schedule page, not just declared for today. The route
  // never checked "is this today" in the first place; these are
  // regression guards against that restriction ever being added.
  it('accepts a future date, for planning rest ahead', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([]));
    mockInsert.mockReturnValueOnce(insertChain([{ ...restRow, localDate: '2026-09-15' }]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/rest-days',
      headers: authHeader,
      payload: { localDate: '2026-09-15', timezone: 'America/Chicago' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ localDate: '2026-09-15' });
  });

  it('accepts a past date, for correcting a day the user forgot to mark', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([]));
    mockInsert.mockReturnValueOnce(insertChain([{ ...restRow, localDate: '2026-07-01' }]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/rest-days',
      headers: authHeader,
      payload: { localDate: '2026-07-01', timezone: 'America/Chicago' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ localDate: '2026-07-01' });
  });

  it('rejects a malformed date', async () => {
    mockSelect.mockReturnValueOnce(selectChain([userRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/rest-days',
      headers: authHeader,
      payload: { localDate: 'not-a-date', timezone: 'America/Chicago' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('DELETE /v1/rest-days/:localDate', () => {
  it('undoes a rest day', async () => {
    mockSelect.mockReturnValueOnce(selectChain([userRow]));
    mockDelete.mockReturnValueOnce({ where: vi.fn().mockResolvedValue([]) });

    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/rest-days/2026-08-24',
      headers: authHeader,
    });

    expect(response.statusCode).toBe(204);
    expect(mockDelete).toHaveBeenCalled();
  });
});
