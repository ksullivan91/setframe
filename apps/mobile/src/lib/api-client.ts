import { useAuth } from '@clerk/clerk-expo';
import { env } from './env';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Thin fetch wrapper pointed at the Fastify API, mirroring
 * apps/web/src/lib/api-client.ts's shape. TODO: swap this for
 * `packages/api-client` once its generated client is filled in (currently
 * a stub per docs/dependencies.md) — keep the same call signature so
 * screens only need an import change later.
 */
async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      /* Only when there is actually a body. Declaring a JSON content-type
         on a bodyless DELETE makes Fastify's JSON parser reject the empty
         body (FST_ERR_CTP_EMPTY_JSON_BODY, 400) — which is why removing an
         Additional Activity failed on mobile and worked on web, where this
         header was already conditional. */
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    /* The API answers with { error: { code, message, requestId } }. Dropping
       it left every failure as "Request to /x failed", which says nothing a
       reader can act on. */
    let detail = '';
    try {
      const body = (await res.json()) as { error?: { message?: string; code?: string } };
      if (body?.error?.message) detail = `: ${body.error.message}`;
    } catch {
      /* Non-JSON or empty error body; the status alone will have to do. */
    }
    throw new ApiError(`Request to ${path} failed (${res.status})${detail}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Hook returning an authenticated fetch client, attaching the Clerk
 * bearer token to every request per docs/architecture.md's auth model.
 */
export function useApiClient() {
  const { getToken } = useAuth();

  return {
    get: async <T>(path: string) => request<T>(path, await getToken()),
    post: async <T>(path: string, body?: unknown) =>
      request<T>(path, await getToken(), {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      }),
    patch: async <T>(path: string, body?: unknown) =>
      request<T>(path, await getToken(), {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
      }),
    del: async <T>(path: string) => request<T>(path, await getToken(), { method: 'DELETE' }),
    delete: async <T>(path: string) => request<T>(path, await getToken(), { method: 'DELETE' }),
  };
}
