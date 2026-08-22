import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { user } from '@setframe/database';
import { getDb } from '../lib/db.js';
import { verifyBearerToken } from '../lib/clerk.js';
import { unauthorized } from '../lib/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Internal user.id, set by the auth pre-handler — never trust a
     * client-supplied id for ownership (master spec §17). */
    userId?: string;
    clerkUserId?: string;
  }
}

async function resolveInternalUserId(clerkUserId: string): Promise<string> {
  const db = getDb();
  const existing = await db.select().from(user).where(eq(user.clerkUserId, clerkUserId)).limit(1);
  if (existing[0]) return existing[0].id;

  // First request from a newly-verified Clerk identity: lazily provision
  // the internal user row. Kept minimal — defaults match packages/schemas.
  const inserted = await db
    .insert(user)
    .values({ clerkUserId, preferredUnits: 'imperial' })
    .returning();
  const created = inserted[0];
  if (!created) throw unauthorized('Unable to provision user');
  return created.id;
}

/**
 * Verifies the Clerk bearer token on every request and attaches
 * `request.userId` (internal user.id) + `request.clerkUserId`. Routes must
 * always scope queries by `request.userId`, never by any id in the
 * request body/query (ADR 0002).
 */
export async function requireAuth(request: FastifyRequest): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw unauthorized('Missing bearer token');
  }
  const token = authHeader.slice('Bearer '.length);

  let clerkUserId: string;
  try {
    const verified = await verifyBearerToken(token);
    clerkUserId = verified.sub;
  } catch {
    throw unauthorized('Invalid or expired token');
  }

  request.clerkUserId = clerkUserId;
  request.userId = await resolveInternalUserId(clerkUserId);
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('userId', undefined);
  fastify.decorateRequest('clerkUserId', undefined);
};

export default fp(authPlugin);
