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
const presetRow = {
  id: '22222222-2222-4222-8222-222222222222',
  userId: userRow.id,
  title: 'Post-meal walk',
  activityType: 'walk',
  defaultDurationSeconds: 900,
  defaultDistanceValue: null,
  defaultDistanceUnit: null,
  defaultNotes: null,
  createdAt: new Date('2026-08-24T12:00:00Z'),
  updatedAt: new Date('2026-08-24T12:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /v1/additional-activity-presets', () => {
  it('lists the owning user’s presets', async () => {
    mockSelect.mockReturnValueOnce(selectChain([userRow])).mockReturnValueOnce(selectChain([presetRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/additional-activity-presets',
      headers: authHeader,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toMatchObject([{ title: 'Post-meal walk', defaultDurationSeconds: 900 }]);
    await app.close();
  });
});

describe('POST /v1/additional-activity-presets', () => {
  it('creates a preset scoped to the requester', async () => {
    mockSelect.mockReturnValueOnce(selectChain([userRow]));
    const insert = insertChain([presetRow]);
    mockInsert.mockReturnValueOnce(insert);

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/additional-activity-presets',
      headers: authHeader,
      payload: { title: 'Post-meal walk', activityType: 'walk', defaultDurationSeconds: 900 },
    });

    expect(response.statusCode).toBe(201);
    expect(insert.values).toHaveBeenCalledWith(expect.objectContaining({ userId: userRow.id, title: 'Post-meal walk' }));
    await app.close();
  });

  it('rejects an empty title', async () => {
    // Zod body validation runs before the auth preHandler, so no `userId`
    // lookup ever happens for a request this malformed — no select mock
    // needed (and queuing an unconsumed one would leak into the next test).
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/additional-activity-presets',
      headers: authHeader,
      payload: { title: '', activityType: 'walk' },
    });

    expect(response.statusCode).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
    await app.close();
  });
});

describe('DELETE /v1/additional-activity-presets/:id', () => {
  it('deletes an owned preset', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([presetRow]));
    mockDelete.mockReturnValueOnce({ where: vi.fn().mockResolvedValue([]) });

    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/additional-activity-presets/${presetRow.id}`,
      headers: authHeader,
    });

    expect(response.statusCode).toBe(204);
    expect(mockDelete).toHaveBeenCalled();
    await app.close();
  });

  it('404s for a preset that does not belong to the requester', async () => {
    mockSelect.mockReturnValueOnce(selectChain([userRow])).mockReturnValueOnce(selectChain([]));

    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/additional-activity-presets/${presetRow.id}`,
      headers: authHeader,
    });

    expect(response.statusCode).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
    await app.close();
  });
});
