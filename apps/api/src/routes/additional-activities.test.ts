import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const { mockSelect, mockInsert, mockUpdate, mockDelete, db } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const db = { select: mockSelect, insert: mockInsert, update: mockUpdate, delete: mockDelete };
  return { mockSelect, mockInsert, mockUpdate, mockDelete, db };
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
    orderBy: vi.fn().mockResolvedValue(rows),
    then: resolved.then.bind(resolved),
  };
}

function selectChain(rows: unknown[]) {
  const chain = queryChain(rows);
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(chain) }) };
}

function insertChain(rows: unknown[]) {
  return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }) };
}

function updateChain(rows: unknown[]) {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }) }) };
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
const activityRow = {
  id: '22222222-2222-4222-8222-222222222222',
  userId: userRow.id,
  localDate: '2026-08-24',
  timezone: 'America/Chicago',
  startedAt: new Date('2026-08-24T18:45:00Z'),
  durationSeconds: 1080,
  activityType: 'walk',
  source: 'manual',
  title: null,
  distanceValue: null,
  distanceUnit: null,
  caloriesKcal: null,
  notes: null,
  externalSourceId: null,
  createdAt: new Date('2026-08-24T18:45:00Z'),
  updatedAt: new Date('2026-08-24T18:45:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /v1/additional-activities', () => {
  it('lists activities for a single day', async () => {
    mockSelect.mockReturnValueOnce(selectChain([userRow])).mockReturnValueOnce(selectChain([activityRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/additional-activities?localDate=2026-08-24',
      headers: authHeader,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toMatchObject([{ id: activityRow.id, activityType: 'walk', durationSeconds: 1080 }]);
    await app.close();
  });

  it('rejects a request with neither localDate nor a from/to range', async () => {
    mockSelect.mockReturnValueOnce(selectChain([userRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/additional-activities',
      headers: authHeader,
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('supports a from/to range for history', async () => {
    mockSelect.mockReturnValueOnce(selectChain([userRow])).mockReturnValueOnce(selectChain([activityRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/additional-activities?from=2026-08-01&to=2026-08-31',
      headers: authHeader,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(1);
    await app.close();
  });
});

describe('POST /v1/additional-activities', () => {
  it('records Apple Health provenance when a dedupe key comes with it', async () => {
    /* This endpoint used to force `source: 'manual'` because there was no
       discovery flow behind an `apple_health` claim. Story 44 is that flow.
       The claim is about the user's own data, affects only their own view
       and their own dedupe, and without it the external id is never stored
       — which is what made "Add to today" look like a dead button. */
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([]));
    const insert = insertChain([activityRow]);
    mockInsert.mockReturnValueOnce(insert);

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/additional-activities',
      headers: authHeader,
      payload: {
        localDate: '2026-08-24',
        timezone: 'America/Chicago',
        activityType: 'walk',
        durationSeconds: 1080,
        source: 'apple_health',
        externalSourceId: 'hk-walk-1',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'apple_health',
        externalSourceId: 'hk-walk-1',
        userId: userRow.id,
      }),
    );
    await app.close();
  });

  it('downgrades an apple_health claim with no dedupe key to manual', async () => {
    /* The guard that survives: provenance without an external id cannot be
       deduped, so a row claiming it would be re-suggested forever. Manual
       is the honest recording. */
    mockSelect.mockReturnValueOnce(selectChain([userRow]));
    const insert = insertChain([activityRow]);
    mockInsert.mockReturnValueOnce(insert);

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/additional-activities',
      headers: authHeader,
      payload: {
        localDate: '2026-08-24',
        timezone: 'America/Chicago',
        activityType: 'walk',
        durationSeconds: 1080,
        source: 'apple_health',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'manual', externalSourceId: null }),
    );
    await app.close();
  });

  it('importing the same workout twice returns the existing row, not an error', async () => {
    /* There is a unique index on (user_id, source, external_id), so a repeat
       import would otherwise surface as a 500. Importing twice is a no-op. */
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([activityRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/additional-activities',
      headers: authHeader,
      payload: {
        localDate: '2026-08-24',
        timezone: 'America/Chicago',
        activityType: 'walk',
        durationSeconds: 1080,
        source: 'apple_health',
        externalSourceId: 'hk-walk-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects an unknown activity type', async () => {
    // Zod body validation runs before the auth preHandler, so no `userId`
    // lookup ever happens for a request this malformed — no select mock
    // needed (and queuing an unconsumed one would leak into the next test).
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/additional-activities',
      headers: authHeader,
      payload: { localDate: '2026-08-24', timezone: 'America/Chicago', activityType: 'skydiving' },
    });

    expect(response.statusCode).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
    await app.close();
  });
});

describe('PATCH /v1/additional-activities/:id', () => {
  it('scopes the update to the owning user', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([activityRow]));
    mockUpdate.mockReturnValueOnce(updateChain([{ ...activityRow, durationSeconds: 1200 }]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/additional-activities/${activityRow.id}`,
      headers: authHeader,
      payload: { durationSeconds: 1200 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().durationSeconds).toBe(1200);
    await app.close();
  });

  it('404s for an activity that does not belong to the requester', async () => {
    mockSelect.mockReturnValueOnce(selectChain([userRow])).mockReturnValueOnce(selectChain([]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/additional-activities/${activityRow.id}`,
      headers: authHeader,
      payload: { notes: 'hi' },
    });

    expect(response.statusCode).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
    await app.close();
  });
});

describe('DELETE /v1/additional-activities/:id', () => {
  it('deletes an owned activity', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([activityRow]));
    mockDelete.mockReturnValueOnce({ where: vi.fn().mockResolvedValue([]) });

    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/additional-activities/${activityRow.id}`,
      headers: authHeader,
    });

    expect(response.statusCode).toBe(204);
    expect(mockDelete).toHaveBeenCalled();
    await app.close();
  });

  it('deletes when the client sends a JSON content-type with no body', async () => {
    /* Exactly what apps/mobile's fetch wrapper sends: it sets
       `Content-Type: application/json` on every request including bodyless
       DELETEs, where apps/web sets it only when there is a body. Fastify's
       JSON parser rejects an empty body under that content-type
       (FST_ERR_CTP_EMPTY_JSON_BODY, 400), which surfaced in the app as
       "Could not remove activity." */
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([activityRow]));
    mockDelete.mockReturnValueOnce({ where: vi.fn().mockResolvedValue([]) });

    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/additional-activities/${activityRow.id}`,
      headers: { ...authHeader, 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(204);
    await app.close();
  });

  it('still rejects malformed JSON', async () => {
    /* The empty-body tolerance above replaces Fastify's global JSON parser,
       so this guards the half that must keep failing: a body that is
       present but not JSON is a client bug and has to surface as 400, not
       be silently swallowed as "no body". */
    mockSelect.mockReturnValueOnce(selectChain([userRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/additional-activities',
      headers: { ...authHeader, 'content-type': 'application/json' },
      payload: '{"localDate": ',
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
