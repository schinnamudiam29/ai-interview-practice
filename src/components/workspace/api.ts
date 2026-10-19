export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init: { method: string; body?: unknown; keepalive?: boolean }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      keepalive: init.keepalive,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection; your code is kept in this tab.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.code);
  return data as T;
}
