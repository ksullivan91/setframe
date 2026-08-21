import { useAuth } from '@clerk/clerk-react';
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
 * Thin fetch wrapper pointed at the Fastify API. TODO: swap this for
 * `packages/api-client` once its generated client is filled in (currently
 * a stub per docs/dependencies.md); keep the same call signature so pages
 * only need an import change later.
 */
async function request<T>(
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new ApiError(`Request to ${path} failed`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Hook that returns an authenticated fetch function, attaching the Clerk
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
    put: async <T>(path: string, body?: unknown) =>
      request<T>(path, await getToken(), {
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
      }),
    del: async <T>(path: string) =>
      request<T>(path, await getToken(), { method: 'DELETE' }),
  };
}
