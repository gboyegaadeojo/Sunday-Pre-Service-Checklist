import type { ApiErrorBody } from "../shared/types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function getJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  const body = (await res.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!res.ok) {
    const message = (body as ApiErrorBody | null)?.error ?? `Request failed (${res.status}).`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}
