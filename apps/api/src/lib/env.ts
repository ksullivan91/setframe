import { parseApiEnv, type ApiEnv } from '@setline/config';

/**
 * Lazily parsed env — deferred until first access so the process can boot
 * (and answer /v1/health) even before all required vars are validated.
 * Any route that actually needs DB/Clerk config triggers validation here.
 */
let cached: ApiEnv | undefined;

export function getEnv(): ApiEnv {
  if (!cached) {
    cached = parseApiEnv();
  }
  return cached;
}
