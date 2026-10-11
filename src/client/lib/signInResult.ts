import { useState } from "react";
import type { SignInOptionsResponse } from "../../shared/types";
import { getJson } from "../api";

// After Planning Center sends someone back without signing them in, the Worker lands them on "/?signin=<reason>"
// (routes/auth-planning-center.ts). This turns the reason into words for the sign-in screen, once, and tidies the
// address so a reload doesn't show it again.

/** US-04b's wording when Planning Center can't be reached; the same message the developer sign-in uses. */
export const SIGN_IN_UNAVAILABLE = "Planning Center sign-in is temporarily unavailable. Please try again shortly.";

const MESSAGES: Record<string, string> = {
  unavailable: SIGN_IN_UNAVAILABLE,
  cancelled: "Sign-in was cancelled. Choose Sign in with Planning Center to try again.",
  failed: "Sign-in didn't work. Please try again.",
  not_set_up: "Planning Center sign-in isn't set up yet.",
};

/** The message for this page load's ?signin= reason (read once), or null. */
export function useSignInResult(): string | null {
  const [message] = useState(() => {
    const url = new URL(window.location.href);
    const reason = url.searchParams.get("signin");
    if (reason === null) return null;
    url.searchParams.delete("signin");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    return MESSAGES[reason] ?? MESSAGES.failed;
  });
  return message;
}

/** Whether Planning Center sign-in is set up (GET /api/auth/sign-in-options); false if that can't be read. */
export async function planningCenterSignInReady(): Promise<boolean> {
  try {
    return (await getJson<SignInOptionsResponse>("/api/auth/sign-in-options")).planningCenter;
  } catch {
    return false;
  }
}

/** Starts Planning Center sign-in: a full page visit, since the Worker redirects to Planning Center. */
export const startPlanningCenterSignIn = () => window.location.assign("/api/auth/planning-center/start");
