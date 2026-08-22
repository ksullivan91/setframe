import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const { mockSelect, mockInsert, db } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const db = { select: mockSelect, insert: mockInsert };
  return { mockSelect, mockInsert, db };
});

vi.mock('../lib/clerk', () => ({
  verifyBearerToken: vi.fn(async () => ({ sub: 'clerk-user-1' })),
}));

vi.mock('../lib/db', () => ({
  getDb: () => db,
}));

function selectChain(rows: unknown[]) {
  const resolved = Promise.resolve(rows);
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows), then: resolved.then.bind(resolved) }),
    }),
  };
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

const systemExerciseRow = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Barbell Back Squat',
  isSystem: true,
  createdByUserId: null,
  archivedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const customExerciseRow = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Backyard Sled Push',
  isSystem: false,
  createdByUserId: userRow.id,
  archivedAt: null,
  createdAt: new Date('2026-01-02T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

/** Story 02: a fresh/new user (no custom exercises of their own) must
 * still see the system exercise catalog — the catalog is not scoped to
 * users who happen to already have exercises. This is the regression
 * test the story's steering doc asks for: proving Guided Setup finds
 * standard exercises without the user manually creating them. */
describe('GET /v1/exercises', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the system exercise catalog for a brand-new user with no custom exercises', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([systemExerciseRow]));

    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/v1/exercises', headers: authHeader });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: systemExerciseRow.id, name: 'Barbell Back Squat', isCustom: false });
    await app.close();
  });

  it('returns both system and the caller’s own custom exercises together, preserving type', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([systemExerciseRow, customExerciseRow]));

    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/v1/exercises', headers: authHeader });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(2);
    expect(body.find((e: { id: string }) => e.id === systemExerciseRow.id)).toMatchObject({ isCustom: false });
    expect(body.find((e: { id: string }) => e.id === customExerciseRow.id)).toMatchObject({ isCustom: true, ownerUserId: userRow.id });
    await app.close();
  });

  it('returns an empty array (not an error) when the catalog is genuinely empty', async () => {
    mockSelect.mockReturnValueOnce(selectChain([userRow])).mockReturnValueOnce(selectChain([]));

    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/v1/exercises', headers: authHeader });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
    await app.close();
  });
});
