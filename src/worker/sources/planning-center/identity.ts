// Signing in with Planning Center (Stage 9c, US-01, US-04b, US-16): OAuth 2 authorization code flow with the church's
// OAuth application (config.ts). The browser only ever sees Planning Center's consent page and the app's own
// addresses; the code exchange, with the Client Secret, happens here in the Worker. The person's access token is used
// once, to ask who they are, and is then dropped: never stored, logged or sent to the browser.

import { withTimeout, SOURCE_TIMEOUT_MS } from "../cache";
import { type ExternalIdentity, type IdentityProvider, ProviderUnavailableError } from "../identity";
import { API_BASE, type FetchLike } from "./client";

/** Only who they are: name, photo and Planning Center ID (People). */
export const SIGN_IN_SCOPE = "people";

/** Planning Center sent the person back without signing them in (they cancelled, or it refused). */
export class SignInDeclinedError extends Error {}

/** The sign-in couldn't be completed for another reason (an expired or reused code, an unexpected answer). */
export class SignInFailedError extends Error {}

export function createPlanningCenterSignIn(
  credentials: { clientId: string; clientSecret: string },
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
): IdentityProvider {
  /** A request to Planning Center within the usual 5 seconds; no answer, or a server error, means it's down (US-04b). */
  async function call(url: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await withTimeout(fetchImpl(url, init), SOURCE_TIMEOUT_MS);
    } catch (err) {
      if (err instanceof ProviderUnavailableError) throw err;
      throw new ProviderUnavailableError(`Planning Center couldn't be reached: ${(err as Error).message}`);
    }
    if (res.status === 429 || res.status >= 500) throw new ProviderUnavailableError(`Planning Center answered ${res.status}`);
    return res;
  }

  return {
    id: "planning_center",
    label: "Planning Center",

    authorizeUrl(redirectUri, state) {
      const url = new URL("/oauth/authorize", API_BASE);
      url.search = new URLSearchParams({ client_id: credentials.clientId, redirect_uri: redirectUri, response_type: "code", scope: SIGN_IN_SCOPE, state }).toString();
      return url.toString();
    },

    async completeSignIn(callbackUrl, redirectUri): Promise<ExternalIdentity> {
      const error = callbackUrl.searchParams.get("error");
      if (error) throw new SignInDeclinedError(`Planning Center returned ${error}`);
      const code = callbackUrl.searchParams.get("code");
      if (!code) throw new SignInFailedError("No code in Planning Center's answer");

      // The code for a token: in the Worker, with the Client Secret (US-01, US-16).
      const tokenRes = await call(new URL("/oauth/token", API_BASE).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          redirect_uri: redirectUri,
        }).toString(),
      });
      if (!tokenRes.ok) throw new SignInFailedError(`Planning Center refused the code (${tokenRes.status})`);
      const token = ((await tokenRes.json()) as { access_token?: string }).access_token;
      if (!token) throw new SignInFailedError("No access token in Planning Center's answer");

      // Who they are, with that token; then the token goes out of scope, unsaved.
      const meRes = await call(new URL("/people/v2/me", API_BASE).toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!meRes.ok) throw new SignInFailedError(`Planning Center didn't say who signed in (${meRes.status})`);
      const me = (await meRes.json()) as { data?: { id?: string; attributes?: Record<string, unknown> } };
      const id = me.data?.id;
      if (!id) throw new SignInFailedError("No person in Planning Center's answer");
      const a = me.data?.attributes ?? {};
      const text = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
      const name = text(a.name) ?? ([text(a.first_name), text(a.last_name)].filter(Boolean).join(" ") || "Planning Center user");
      return { provider: "planning_center", subject: id, name, avatarUrl: text(a.avatar), email: null };
    },
  };
}
