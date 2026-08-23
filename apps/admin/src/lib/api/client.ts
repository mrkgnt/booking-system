export type ApiClientConfig = { baseUrl: string; tenantSlug: string; accessToken: string };

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API request failed with status ${status}`);
  }
}

async function doFetch(config: ApiClientConfig, path: string, init: RequestInit): Promise<Response> {
  return fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Slug": config.tenantSlug,
      Authorization: `Bearer ${config.accessToken}`,
      ...init.headers,
    },
  });
}

export async function apiFetch<T>(config: ApiClientConfig, path: string, init: RequestInit = {}): Promise<T> {
  let res = await doFetch(config, path, init);
  // A 403 here means staffAuthMiddleware rejected the request before any
  // route logic ran (see apps/api/src/middleware/staffAuth.ts) — so a
  // retry can never duplicate a write. One retry papers over an observed,
  // rare (~1-2%) transient failure validating the caller's token against
  // Supabase Auth under concurrent requests (e.g. bookings.astro's
  // Promise.all) — not a data or permissions bug, since the identical
  // request reliably succeeds moments later.
  if (res.status === 403) {
    res = await doFetch(config, path, init);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
