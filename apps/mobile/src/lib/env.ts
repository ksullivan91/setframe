/**
 * Typed env access. Expo exposes `EXPO_PUBLIC_`-prefixed vars via
 * `process.env` at build time; keep this the single place that reads
 * them, mirroring apps/web/src/lib/env.ts.
 */
export const env = {
  /** Base URL for the Fastify API, including the `/v1` prefix (docs/api.md). */
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1',
  /** Placeholder key until a real Clerk publishable key is provisioned. */
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? 'pk_test_placeholder',
};
