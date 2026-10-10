// Sign-in providers (requirements C22, US-03a). A provider only answers "who is this?"; the app then finds
// or creates the app user linked to that account (db/users.ts signInWithIdentity). Nothing outside
// src/worker/sources/ (and the dev-only test sign-in) knows which provider is in use.
//
// Implementations: local test users ("dev", src/worker/routes/dev-auth.ts, never in production builds);
// Planning Center OAuth (Stage 9). Google could be added later (requirements §4, Later).

/** Provider names as stored in user_identities.provider. */
export type IdentityProviderId = "planning_center" | "dev";

/** Who signed in, as the provider reports it. */
export interface ExternalIdentity {
  provider: IdentityProviderId;
  /** The provider's stable ID for this person (e.g. a Planning Center person ID). Stored only server-side. */
  subject: string;
  name: string;
  avatarUrl: string | null;
  email: string | null;
}

/** A redirect-based sign-in (OAuth). The code exchange and any secret stay in the Worker (US-01, US-16). */
export interface IdentityProvider {
  readonly id: IdentityProviderId;
  /** Text for the sign-in button, e.g. "Sign in with Planning Center". */
  readonly label: string;
  /** The URL to send the browser to, carrying `state` to check on return. */
  authorizeUrl(redirectUri: string, state: string): string;
  /**
   * Turns the provider's callback into who signed in. The provider's access token is used only for this
   * and never stored (US-01). Throws ProviderUnavailableError when the provider can't be reached (US-04b).
   */
  completeSignIn(callbackUrl: URL, redirectUri: string): Promise<ExternalIdentity>;
}

/** The provider (sign-in or schedule source) couldn't be reached or timed out. */
export class ProviderUnavailableError extends Error {}
