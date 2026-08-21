import { z } from 'zod';

/**
 * Typed env parsing for apps/api. Fails fast at boot on missing/invalid
 * env vars rather than surfacing confusing runtime errors later
 * (master spec §34 — Postgres + one Fastify service, keep ops simple).
 */
export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CORS_ORIGIN: z.string().optional(),
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function parseApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(source);
}
