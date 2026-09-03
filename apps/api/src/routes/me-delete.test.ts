import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const { mockSelect, mockBatch, mockDeleteUser, db } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockBatch = vi.fn(async () => []);
  const mockDeleteUser = vi.fn(async () => ({}));
  const db = {
    select: mockSelect,
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(() => ({ where: vi.fn(() => ({})) })),
    batch: mockBatch,
  };
  return { mockSelect, mockBatch, mockDeleteUser, db };
});
vi.mock('../lib/clerk', () => ({
  verifyBearerToken: vi.fn(async () => ({ sub: 'clerk-user-1' })),
  deleteClerkUser: mockDeleteUser,
}));
vi.mock('../lib/db', () => ({ getDb: () => db }));

const userRow = {
  id: '11111111-1111-4111-8111-111111111111',
  clerkUserId: 'clerk-user-1',
  email: 'a@b.c',
  preferredUnits: 'imperial',
  onboardedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
function selectChain(rows: unknown[]) {
  const resolved = Promise.resolve(rows);
  const tail = {
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockResolvedValue(rows),
    then: resolved.then.bind(resolved),
  };
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(tail) }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnValue(selectChain([userRow]));
  mockBatch.mockResolvedValue([]);
  mockDeleteUser.mockResolvedValue({});
});

describe('DELETE /v1/me', () => {
  it('returns 204 and no body', async () => {
    /* 204 with a schema is exactly the shape Fastify + zod can reject at
       runtime while typechecking fine, so this asserts the wire result
       rather than the handler's return. */
    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: { authorization: 'Bearer t' },
    });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
  });

  it('deletes the data before the identity', async () => {
    /* The other order leaves rows belonging to an identity nobody can
       authenticate as, and therefore no way to finish the job. */
    const order: string[] = [];
    mockBatch.mockImplementation(async () => {
      order.push('db');
      return [];
    });
    mockDeleteUser.mockImplementation(async () => {
      order.push('clerk');
      return {};
    });

    const app = await buildApp();
    await app.inject({ method: 'DELETE', url: '/v1/me', headers: { authorization: 'Bearer t' } });

    expect(order).toEqual(['db', 'clerk']);
  });

  it('deletes everything in ONE batch, so it cannot half-apply', async () => {
    const app = await buildApp();
    await app.inject({ method: 'DELETE', url: '/v1/me', headers: { authorization: 'Bearer t' } });
    expect(mockBatch).toHaveBeenCalledTimes(1);
    expect(mockBatch.mock.calls[0]![0]!.length).toBeGreaterThan(20);
  });

  it('reports a Clerk failure rather than claiming success', async () => {
    /* The rows are gone at this point. Returning 204 would tell the user
       their email is free when it is still claimed. */
    mockDeleteUser.mockRejectedValue(new Error('clerk down'));
    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: { authorization: 'Bearer t' },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('ACCOUNT_PARTIALLY_DELETED');
  });

  it('requires authentication', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: '/v1/me' });
    expect(res.statusCode).toBe(401);
  });
});
