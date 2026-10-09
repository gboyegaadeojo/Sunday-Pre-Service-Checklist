// App session token (US-01): base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature).
// It identifies the user only; roles are re-read from D1 on every request (US-03).

export const SESSION_COOKIE = "session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Re-issue the cookie (sliding 30 days) once it is this old, rather than on every request. */
export const SESSION_RENEW_AFTER_SECONDS = 60 * 60;

export interface SessionPayload {
  sub: string; // Planning Center person ID
  iat: number; // issued at, seconds
  exp: number; // expires at, seconds
}

const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const hmacKey = (secret: string) =>
  crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);

export async function createSessionToken(secret: string, sub: string, now: number): Promise<string> {
  const payload: SessionPayload = { sub, iat: now, exp: now + SESSION_TTL_SECONDS };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Returns the payload if the signature is valid and the token has not expired, otherwise null. */
export async function verifySessionToken(secret: string, token: string, now: number): Promise<SessionPayload | null> {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromBase64Url(signature),
      encoder.encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number" || payload.exp <= now) return null;
    return payload;
  } catch {
    return null; // malformed base64 or JSON
  }
}
