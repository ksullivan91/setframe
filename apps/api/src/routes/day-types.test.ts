import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const { mockSelect, mockInsert, mockUpdate, mockDelete, db } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const db = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  };
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
    orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows), then: resolved.then.bind(resolved) }),
    returning: vi.fn().mockResolvedValue(rows),
    then: resolved.then.bind(resolved),
  };
}

function selectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(queryChain(rows)) }),
      where: vi.fn().mockReturnValue(queryChain(rows)),
      orderBy: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function insertChain(rows: unknown[]) {
  return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }) };
}

/** `insert().values()` with no `.returning()` — a membership row insert. */
function insertNoReturningChain() {
  return { values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }) };
}

function updateChain(rows: unknown[]) {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }) }) };
}

/** `set().where()` with no `.returning()` — e.g. nulling out a backlink column. */
function updateNoReturningChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
}

function deleteChain() {
  return { where: vi.fn().mockResolvedValue([]) };
}

const ownerUser = {
  id: '99999999-9999-4999-8999-999999999999',
  clerkUserId: 'clerk-user-1',
  displayName: null,
  preferredUnits: 'imperial',
  timezone: 'UTC',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const dayTypeRow = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: ownerUser.id,
  name: 'Upper A',
  description: null,
  estimatedDurationMinutes: 60,
  createdAt: new Date('2026-08-20T12:00:00Z'),
  updatedAt: new Date('2026-08-20T12:00:00Z'),
};

const secondDayTypeRow = {
  ...dayTypeRow,
  id: '55555555-5555-4555-8555-555555555555',
  name: 'Lower A',
};

const programRow = {
  id: '66666666-6666-4666-8666-666666666666',
  userId: ownerUser.id,
  name: 'Base',
  description: null,
  isActive: true,
  startDate: null,
  cycleLengthWeeks: null,
  archivedAt: null,
  createdAt: new Date('2026-08-20T12:00:00Z'),
  updatedAt: new Date('2026-08-20T12:00:00Z'),
};

const programVersionRow = {
  id: '77777777-7777-4777-8777-777777777777',
  trainingProgramId: programRow.id,
  versionNumber: 1,
  effectiveFrom: '2026-08-20',
  effectiveTo: null,
  notes: null,
  createdAt: new Date('2026-08-20T12:00:00Z'),
};

const exerciseRow = {
  id: '22222222-2222-4222-8222-222222222222',
  dayTypeId: dayTypeRow.id,
  exerciseId: '33333333-3333-4333-8333-333333333333',
  sortOrder: 0,
  prescription: { kind: 'duration', durationMinutes: 30 },
  progressionRuleId: null,
  notes: null,
  createdAt: new Date('2026-08-20T12:00:00Z'),
  updatedAt: new Date('2026-08-20T12:00:00Z'),
};

const authHeader = { authorization: 'Bearer test-token' };

describe('day type routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a day type exercise prescription via nested route', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([ownerUser]))
      .mockReturnValueOnce(selectChain([{ exercise: exerciseRow, owner: dayTypeRow }]));
    mockUpdate.mockReturnValueOnce(
      updateChain([{ ...exerciseRow, prescription: { kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 } }]),
    );

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/day-types/${dayTypeRow.id}/exercises/${exerciseRow.id}`,
      headers: authHeader,
      payload: {
        prescription: { kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().prescription).toEqual({ kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 });
    await app.close();
  });

  it('reorders exercises only when payload matches owned day type exercises', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([ownerUser]))
      .mockReturnValueOnce(selectChain([dayTypeRow]))
      .mockReturnValueOnce(selectChain([{ id: exerciseRow.id }, { id: '44444444-4444-4444-8444-444444444444' }]));
    mockUpdate.mockReturnValue(updateChain([]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/day-types/${dayTypeRow.id}/exercises/reorder`,
      headers: authHeader,
      payload: {
        exerciseIdsInOrder: ['44444444-4444-4444-8444-444444444444', exerciseRow.id],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    await app.close();
  });

  /**
   * Removing a workout mid-Guided-Setup (Story 18) exercises the delete
   * path for the first time — previously a bare `db.delete(dayType)` with
   * no child cleanup, which would throw a raw foreign-key-violation error
   * for any workout that already had exercises, a schedule assignment, or
   * (via the soft `templateId` backlink) a workout session.
   */
  it('deletes a day type with exercises, clearing every referencing row first', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([ownerUser])) // auth
      .mockReturnValueOnce(selectChain([dayTypeRow])) // getOwnedDayType
      .mockReturnValueOnce(selectChain([{ id: exerciseRow.id }])); // exercise ids under this day type
    mockDelete
      .mockReturnValueOnce(deleteChain()) // plannedSet
      .mockReturnValueOnce(deleteChain()) // dayTypeExercise
      .mockReturnValueOnce(deleteChain()) // programScheduleSlot
      .mockReturnValueOnce(deleteChain()) // scheduleOverride
      .mockReturnValueOnce(deleteChain()) // programDayType
      .mockReturnValueOnce(deleteChain()); // dayType itself
    mockUpdate.mockReturnValueOnce(updateNoReturningChain()); // workoutSession.templateId -> null

    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/day-types/${dayTypeRow.id}`,
      headers: authHeader,
    });

    expect(response.statusCode).toBe(204);
    expect(mockDelete).toHaveBeenCalledTimes(6);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('deletes a day type with no exercises, skipping the planned-set cleanup', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([ownerUser]))
      .mockReturnValueOnce(selectChain([dayTypeRow]))
      .mockReturnValueOnce(selectChain([])); // no exercises
    mockDelete
      .mockReturnValueOnce(deleteChain()) // dayTypeExercise (no-op, but still issued)
      .mockReturnValueOnce(deleteChain()) // programScheduleSlot
      .mockReturnValueOnce(deleteChain()) // scheduleOverride
      .mockReturnValueOnce(deleteChain()) // programDayType
      .mockReturnValueOnce(deleteChain()); // dayType itself
    mockUpdate.mockReturnValueOnce(updateNoReturningChain());

    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/day-types/${dayTypeRow.id}`,
      headers: authHeader,
    });

    expect(response.statusCode).toBe(204);
    // One fewer delete than the exercises-present case above: the planned-
    // set cleanup is skipped entirely when there are no exercises.
    expect(mockDelete).toHaveBeenCalledTimes(5);
    await app.close();
  });
});

/**
 * Story 25 — before `program_day_type` existed, a workout's membership in
 * a program could only be inferred from `program_schedule_slot`, so an
 * added-but-not-yet-scheduled workout had nowhere to persist that at all.
 */
describe('program-day-type membership routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists only the workouts explicitly associated with a program', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([ownerUser]))
      .mockReturnValueOnce(selectChain([programRow]))
      .mockReturnValueOnce(selectChain([{ dayType: dayTypeRow }, { dayType: secondDayTypeRow }]));

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/v1/programs/${programRow.id}/day-types`,
      headers: authHeader,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((d: { name: string }) => d.name)).toEqual(['Upper A', 'Lower A']);
    await app.close();
  });

  it('adds an existing workout to a program as a membership row, not a copy', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([ownerUser]))
      .mockReturnValueOnce(selectChain([programRow]))
      .mockReturnValueOnce(selectChain([dayTypeRow]))
      .mockReturnValueOnce(selectChain([{ value: null }])); // empty program so far -> sortOrder 0
    mockInsert.mockReturnValueOnce(insertNoReturningChain());

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/programs/${programRow.id}/day-types`,
      headers: authHeader,
      payload: { dayTypeId: dayTypeRow.id },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().id).toBe(dayTypeRow.id);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('removing a workout from a program clears that program’s schedule slots for it, not the workout itself', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([ownerUser]))
      .mockReturnValueOnce(selectChain([programRow]))
      .mockReturnValueOnce(selectChain([dayTypeRow]))
      .mockReturnValueOnce(selectChain([{ id: programVersionRow.id }]));
    mockDelete.mockReturnValueOnce(deleteChain()).mockReturnValueOnce(deleteChain());

    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/programs/${programRow.id}/day-types/${dayTypeRow.id}`,
      headers: authHeader,
    });

    expect(response.statusCode).toBe(204);
    // programScheduleSlot cleanup + the membership row itself — day_type
    // is never touched by this route.
    expect(mockDelete).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it('creating a workout with a programId associates it with that program immediately', async () => {
    const created = { ...dayTypeRow, id: '88888888-8888-4888-8888-888888888888', name: 'New Workout' };
    mockSelect.mockReturnValueOnce(selectChain([ownerUser])).mockReturnValueOnce(selectChain([programRow]));
    mockInsert.mockReturnValueOnce(insertChain([created])).mockReturnValueOnce(insertNoReturningChain());

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/day-types',
      headers: authHeader,
      payload: { name: 'New Workout', programId: programRow.id },
    });

    expect(response.statusCode).toBe(201);
    expect(mockInsert).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it('rejects a schedule slot for a workout that is not a member of the program', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([ownerUser]))
      .mockReturnValueOnce(selectChain([programRow])) // getOwnedProgram (inside getOwnedProgramDayType)
      .mockReturnValueOnce(selectChain([secondDayTypeRow])) // getOwnedDayType
      .mockReturnValueOnce(selectChain([])); // no membership row

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/programs/${programRow.id}/schedule-slots`,
      headers: authHeader,
      payload: { dayTypeId: secondDayTypeRow.id, dayIndex: 0, sortOrder: 0 },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
