import { createClerkClient, verifyToken as clerkVerifyToken } from '@clerk/backend';
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

/**
 * Deletes the Clerk user, which is what frees the email for reuse.
 *
 * Removing our rows is only half of an account deletion: Clerk owns the
 * identity, so without this the address stays claimed and the person
 * cannot sign up again — which is exactly what "delete my account" is
 * usually taken to mean.
 *
 * Called AFTER the database rows are gone. The other order would leave
 * data belonging to an identity nobody can authenticate as, and therefore
 * no way to finish the job.
 */
export async function deleteClerkUser(clerkUserId: string): Promise<void> {
  const env = getEnv();
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  await clerk.users.deleteUser(clerkUserId);
}
