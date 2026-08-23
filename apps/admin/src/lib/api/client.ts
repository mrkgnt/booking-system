export type ApiClientConfig = { baseUrl: string; tenantSlug: string; accessToken: string };

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API request failed with status ${status}`);
  }
}

export async function apiFetch<T>(config: ApiClientConfig, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Slug": config.tenantSlug,
      Authorization: `Bearer ${config.accessToken}`,
      ...init.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
