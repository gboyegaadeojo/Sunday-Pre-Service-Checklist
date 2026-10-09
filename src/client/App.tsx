import { useCallback, useEffect, useState } from "react";
import type { CurrentUser, MeResponse } from "../shared/types";
import { ApiError, getJson, postJson } from "./api";
import { AppHeader } from "./components/app/AppHeader";
import { ErrorState, LoadingState } from "./components/ui/States";
import { ChecklistPage } from "./pages/ChecklistPage";
import { NoAccessPage } from "./pages/NoAccessPage";
import { SignInPage } from "./pages/SignInPage";

type Session =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "signed_out" }
  | { status: "signed_in"; user: CurrentUser };

export function App() {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // Who is signed in, and with what access. Re-run whenever the server says the session or access changed.
  const loadSession = useCallback(async () => {
    try {
      const { user } = await getJson<MeResponse>("/api/auth/me");
      setSession({ status: "signed_in", user });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setSession({ status: "signed_out" });
      else setSession({ status: "error", message: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const signOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await postJson("/api/auth/sign-out");
      setSession({ status: "signed_out" });
    } catch (err) {
      setSignOutError((err as Error).message);
    } finally {
      setSigningOut(false);
    }
  };

  if (session.status === "loading") return <LoadingState label="Loading…" />;

  if (session.status === "error") {
    return (
      <main className="px-4 py-16">
        <ErrorState
          title="Couldn't load the app"
          message={session.message}
          onRetry={() => {
            setSession({ status: "loading" });
            void loadSession();
          }}
        />
      </main>
    );
  }

  if (session.status === "signed_out") return <SignInPage onSignedIn={() => void loadSession()} />;

  const { user } = session;
  return (
    <>
      <AppHeader user={user} onSignOut={() => void signOut()} signingOut={signingOut} signOutError={signOutError} />
      {user.hasAccess ? (
        <ChecklistPage onAccessChanged={() => void loadSession()} />
      ) : (
        <NoAccessPage onSignOut={() => void signOut()} signingOut={signingOut} />
      )}
    </>
  );
}
