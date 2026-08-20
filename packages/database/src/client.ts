import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export type Database = ReturnType<typeof createDb>;

/**
 * Typed Drizzle client factory over Neon's serverless HTTP driver. Callers
 * (apps/api) are responsible for lazily invoking this only once a real
 * `DATABASE_URL` is needed — constructing this client does not eagerly
 * open a network connection (the neon-http driver is per-query HTTP, not
 * a persistent pool), but we still keep construction out of module scope
 * so an app can boot (e.g. for /v1/health) without a valid connection
 * string being reachable.
 */
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}
