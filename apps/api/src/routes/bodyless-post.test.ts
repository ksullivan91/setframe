import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

/**
 * A POST with no body must survive a client that still declares JSON.
 *
 * `POST /programs/:id/activate` and `POST /workout-sessions/:id/complete`
 * take no body. apps/mobile's fetch wrapper used to set
 * `Content-Type: application/json` on every request, and Fastify's default
 * JSON parser answers 400 FST_ERR_CTP_EMPTY_JSON_BODY when a request
 * declares that type and sends nothing — so "Use this plan" did nothing at
 * all, and the mutation had no onError to say why.
 *
 * The client is fixed, but the API tolerating it is what unbreaks the build
 * already on a tester's phone, so this pins the server half.
 */
const { mockSelect, mockUpdate, db } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const db = { select: mockSelect, insert: vi.fn(), update: mockUpdate, delete: vi.fn() };
  return { mockSelect, mockUpdate, db };
});

vi.mock('../lib/clerk', () => ({
  verifyBearerToken: vi.fn(async () => ({ sub: 'clerk-user-1' })),
}));
vi.mock('../lib/db', () => ({ getDb: () => db }));

const userRow = {
  id: '11111111-1111-4111-8111-111111111111',
  clerkUserId: 'clerk-user-1',
  email: 'a@b.c',
  preferredUnits: 'imperial',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const programRow = {
  id: '22222222-2222-4222-8222-222222222222',
  userId: userRow.id,
  name: 'Lower/Upper',
  description: null,
  isActive: true,
  cycleLengthWeeks: null,
  startDate: null,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function selectChain(rows: unknown[]) {
  const resolved = Promise.resolve(rows);
  const chain = {
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
    returning: vi.fn().mockResolvedValue(rows),
    then: resolved.then.bind(resolved),
  };
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(chain) }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnValue(selectChain([userRow]));
  mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([programRow]) }),
    }),
  });
});

describe('POST with no body', () => {
  it('activates a program when the client declares JSON and sends nothing', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/programs/${programRow.id}/activate`,
      headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('activates a program when the client sends no content-type at all', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/programs/${programRow.id}/activate`,
      headers: { authorization: 'Bearer t' },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });
});
