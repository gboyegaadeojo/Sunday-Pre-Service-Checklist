import type { ApiErrorBody } from "../shared/types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: ApiErrorBody["code"],
  ) {
    super(message);
  }
}

/** 401 or 403: the session ended or access changed, so the app should re-check who is signed in. */
export const isAuthError = (err: unknown) => err instanceof ApiError && (err.status === 401 || err.status === 403);

async function send<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { Accept: "application/json", ...init.headers } });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!res.ok) {
    const err = body as ApiErrorBody | null;
    throw new ApiError(err?.error ?? `Request failed (${res.status}).`, res.status, err?.code);
  }
  return body as T;
}

export const getJson = <T>(path: string) => send<T>(path, {});

export const postJson = <T = void>(path: string, body?: unknown) =>
  send<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
