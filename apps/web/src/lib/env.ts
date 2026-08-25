/**
 * Typed env access. Only VITE_-prefixed vars are exposed by Vite; keep
 * this the single place that reads `import.meta.env` so defaults/TODOs
 * live in one spot.
 */
export const env = {
  /**
   * Base URL for the Fastify API, including the `/v1` prefix (see
   * docs/api.md). Defaults to port 3000 — apps/api's dev port wasn't
   * finalized when this was written; override via VITE_API_BASE_URL.
   */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/v1',
  /** Placeholder key until a real Clerk publishable key is provisioned. */
  clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? 'pk_test_placeholder',
  /** When true, `npm run dev:mock` starts an MSW worker (see
   * src/mocks/browser.ts) instead of hitting the real API. */
  useMocks: import.meta.env.VITE_USE_MOCKS === 'true',
};
