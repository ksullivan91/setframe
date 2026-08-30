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
  movementPattern: 'squat',
  equipment: 'barbell',
  isSystem: true,
  createdByUserId: null,
  archivedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const customExerciseRow = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  // Deliberately unclassified: the case story 57's editor exists to fix.
  name: 'Backyard Sled Push',
  movementPattern: null,
  equipment: null,
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
    expect(body[0]).toMatchObject({
      id: systemExerciseRow.id,
      name: 'Barbell Back Squat',
      isCustom: false,
      movementPattern: 'squat',
    });
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

/**
 * Story 57 — classifying an exercise by movement pattern.
 *
 * Progress's composition chart groups volume by this field. Before it was
 * editable, ungrouped volume in production was larger than every named group
 * combined and a user had no way to fix it from inside the product.
 */
describe('PATCH /v1/exercises/:exerciseId movement pattern', () => {
  function updateChain(rows: unknown[]) {
    return {
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }),
      }),
    };
  }

  it('sets a movement pattern on the caller’s own custom exercise', async () => {
    const updated = { ...customExerciseRow, movementPattern: 'hinge' };
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([customExerciseRow]));
    (db as Record<string, unknown>).update = vi.fn().mockReturnValue(updateChain([updated]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/exercises/${customExerciseRow.id}`,
      headers: authHeader,
      payload: { movementPattern: 'hinge' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().movementPattern).toBe('hinge');
    await app.close();
  });

  it('accepts null to clear it, because "not set" is a real choice', async () => {
    /* Forcing a value would be worse than leaving one unset: a wrong pattern
       silently misfiles the work on every chart that groups by it, where an
       unset one is openly reported as ungrouped. */
    const cleared = { ...customExerciseRow, movementPattern: null };
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ ...customExerciseRow, movementPattern: 'hinge' }]));
    (db as Record<string, unknown>).update = vi.fn().mockReturnValue(updateChain([cleared]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/exercises/${customExerciseRow.id}`,
      headers: authHeader,
      payload: { movementPattern: null },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().movementPattern).toBeNull();
    await app.close();
  });

  it('refuses to reclassify a system exercise', async () => {
    // The clients hide the control for these; the API must not rely on that.
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([systemExerciseRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/exercises/${systemExerciseRow.id}`,
      headers: authHeader,
      payload: { movementPattern: 'hinge' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('refuses to reclassify another user’s custom exercise', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(
        selectChain([
          { ...customExerciseRow, createdByUserId: '99999999-9999-4999-8999-999999999999' },
        ]),
      );

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/exercises/${customExerciseRow.id}`,
      headers: authHeader,
      payload: { movementPattern: 'hinge' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('rejects an empty-string pattern rather than storing one', async () => {
    // `''` is not "unset" — null is. Storing it would create a pattern key
    // that groups as its own nameless band.
    mockSelect.mockReturnValueOnce(selectChain([userRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/exercises/${customExerciseRow.id}`,
      headers: authHeader,
      payload: { movementPattern: '' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
