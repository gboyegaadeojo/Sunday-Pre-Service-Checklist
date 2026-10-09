import { useCallback, useEffect, useState } from "react";
import type { DevUser, DevUsersResponse } from "../../shared/types";
import { ApiError, getJson, postJson } from "../api";
import { Brand } from "../components/app/Brand";
import { Card } from "../components/ui/Card";
import { ErrorState, LoadingState } from "../components/ui/States";

type State =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "error"; message: string }
  | { status: "ready"; users: DevUser[] };

// Stage 2 sign-in: test users for local development only. The real "Sign in with Planning Center"
// button (US-01) is added in Stage 8; until then a production build shows "not available yet".
export function SignInPage({ onSignedIn }: { onSignedIn: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { users } = await getJson<DevUsersResponse>("/api/dev/users");
      setState({ status: "ready", users });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setState({ status: "unavailable" });
      else setState({ status: "error", message: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const signIn = async (key: string) => {
    setPendingKey(key);
    setSignInError(null);
    try {
      await postJson("/api/dev/sign-in", { key });
      onSignedIn();
    } catch (err) {
      setSignInError((err as Error).message);
      setPendingKey(null);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Brand />
        </div>
        <Card className="p-5 sm:p-6">
          <h1 className="text-page font-semibold tracking-tight">Sign in</h1>

          {state.status === "loading" && <LoadingState label="Loading…" />}

          {state.status === "error" && (
            <div className="mt-4">
              <ErrorState title="Couldn't load sign-in" message={state.message} onRetry={() => void loadUsers()} />
            </div>
          )}

          {state.status === "unavailable" && (
            <p className="mt-2 text-sm text-fg-muted">Sign-in isn't available yet. Please check back soon.</p>
          )}

          {state.status === "ready" && (
            <>
              <p className="mt-1 text-sm text-fg-muted">
                Planning Center sign-in isn't connected yet. For local testing, choose a test user.
              </p>
              <ul className="mt-5 space-y-2" aria-label="Test users">
                {state.users.map((u) => (
                  <li key={u.key}>
                    <button
                      type="button"
                      onClick={() => void signIn(u.key)}
                      disabled={pendingKey !== null}
                      className="flex min-h-14 w-full items-center gap-3 rounded-control border border-line bg-surface px-4 py-2.5 text-left transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">{u.name}</span>
                        <span className="block text-meta text-fg-muted">{u.description}</span>
                      </span>
                      {pendingKey === u.key && (
                        <span
                          aria-hidden="true"
                          className="size-4 rounded-full border-2 border-line border-t-accent-soft motion-safe:animate-spin"
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {signInError && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {signInError}
                </p>
              )}
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
