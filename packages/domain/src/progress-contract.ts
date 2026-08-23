import type { ProgressOverviewResponse } from '@setframe/schemas';

/**
 * Narrows an API payload to the current overview contract.
 *
 * The web and mobile clients deploy independently of the API, so a client can
 * outrun the server and receive a previous response shape. Destructuring that
 * blindly takes the whole screen down; this lets the caller fall back to its
 * error state instead. It is a shape check rather than full validation — the
 * point is to survive a version skew, not to re-validate trusted data.
 */
export function isProgressOverview(value: unknown): value is ProgressOverviewResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProgressOverviewResponse>;
  return (
    Array.isArray(candidate.training?.weeks) &&
    Array.isArray(candidate.bodyWeight?.points) &&
    Array.isArray(candidate.exercises) &&
    Array.isArray(candidate.recentSessions)
  );
}
