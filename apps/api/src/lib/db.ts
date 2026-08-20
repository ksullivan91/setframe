import { createDb, type Database } from '@setline/database';
import { getEnv } from './env';

/**
 * Lazily constructed Drizzle client. Constructing a neon-http client does
 * not itself open a persistent connection (it's per-query HTTP), but we
 * still defer this until a route actually needs the DB so a bad/placeholder
 * DATABASE_URL never prevents the server from booting or answering
 * /v1/health.
 */
let cached: Database | undefined;

export function getDb(): Database {
  if (!cached) {
    cached = createDb(getEnv().DATABASE_URL);
  }
  return cached;
}
