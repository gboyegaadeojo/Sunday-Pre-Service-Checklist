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

/**
 * Random ID for this page load, sent with every request and recorded in the server's check-off log, so
 * activity can be traced to a browser tab. Uses getRandomValues, which also works on plain-http LAN testing.
 */
export const TAB_ID = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");

async function send<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { Accept: "application/json", "X-Tab-Id": TAB_ID, ...init.headers } });
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

export const putJson = <T>(path: string, body?: unknown) =>
  send<T>(
    path,
    body === undefined ? { method: "PUT" } : { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );

export const deleteJson = <T>(path: string) => send<T>(path, { method: "DELETE" });

export const patchJson = <T = void>(path: string, body: unknown) =>
  send<T>(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const postJson = <T = void>(path: string, body?: unknown) =>
  send<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
