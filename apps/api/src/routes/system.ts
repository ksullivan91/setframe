import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db';

/** GET /v1/health, GET /v1/ready — no auth (docs/api.md "System"). */
export const systemRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/v1/health',
    {
      schema: {
        response: { 200: z.object({ status: z.literal('ok') }) },
      },
    },
    async () => ({ status: 'ok' as const }),
  );

  fastify.get(
    '/v1/ready',
    {
      schema: {
        response: {
          200: z.object({ status: z.literal('ok') }),
          503: z.object({ status: z.literal('unavailable'), reason: z.string() }),
        },
      },
    },
    async (_request, reply) => {
      try {
        const db = getDb();
        await db.execute(sql`select 1`);
        return { status: 'ok' as const };
      } catch (err) {
        reply.status(503);
        return {
          status: 'unavailable' as const,
          reason: err instanceof Error ? err.message : 'Database unreachable',
        };
      }
    },
  );
};
