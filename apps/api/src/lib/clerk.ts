import { verifyToken as clerkVerifyToken } from '@clerk/backend';
import { getEnv } from './env.js';

/**
 * Verifies a Clerk-issued bearer token and returns the decoded payload
 * (`sub` = clerk_user_id). Uses the standalone `verifyToken` helper (per
 * @clerk/backend docs) rather than constructing a full ClerkClient, since
 * this API only needs token verification, not the wider Backend API
 * surface. Lazily reads env so the process can still boot without valid
 * Clerk credentials (see getDb() for the same rationale).
 */
export async function verifyBearerToken(token: string): Promise<{ sub: string }> {
  const env = getEnv();
  return clerkVerifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
}
