import { useEffect, useState } from "react";
import type { DevUser, DevUsersResponse } from "../../shared/types";
import { getJson, postJson, putJson } from "../api";
import { SignInScreen } from "../components/app/SignInScreen";
import { Switch } from "../components/ui/Switch";

// LOCAL DEVELOPMENT ONLY. App.tsx renders this only when import.meta.env.DEV is true, so production
// builds drop this file (test/production-build.test.ts checks the client bundle). The server side
// also needs DEV_AUTH=true; without it this page behaves exactly like the production sign-in.
export function DevSignInPage({ onSignedIn, notice }: { onSignedIn: () => void; notice?: string | null }) {
  const [users, setUsers] = useState<DevUser[] | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The fake schedule source's adjustments; `down` stands for a Planning Center outage (US-04a, US-04b).
  const [schedule, setSchedule] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    getJson<DevUsersResponse>("/api/dev/users")
      .then((res) => setUsers(res.users))
      .catch(() => setUsers(null)); // DEV_AUTH off: no test users, same as production
    getJson<Record<string, unknown>>("/api/dev/schedule")
      .then(setSchedule)
      .catch(() => setSchedule(null));
  }, []);

  const toggleDown = async () => {
    if (!schedule) return;
    const next = { ...schedule, down: !schedule.down };
    await putJson("/api/dev/schedule", next);
    setSchedule(next);
    setError(null);
  };

  /** viaPlanningCenter: the main button, which fails like Planning Center sign-in while it's down (US-04b). */
  const signInAs = async (key: string, viaPlanningCenter = false) => {
    setPendingKey(key);
    setError(null);
    try {
      await postJson("/api/dev/sign-in", { key, viaPlanningCenter });
      onSignedIn();
    } catch (err) {
      setError((err as Error).message);
      setPendingKey(null);
    }
  };

  if (!users) return <SignInScreen notice={notice} />;

  return (
    <SignInScreen onSignIn={() => void signInAs("volunteer", true)} signingIn={pendingKey === "volunteer"} error={error} notice={notice}>
      <section
        aria-labelledby="dev-tools-heading"
        className="mt-6 rounded-card border border-dashed border-warning/50 bg-warning/5 p-4"
      >
        <h2 id="dev-tools-heading" className="text-meta font-semibold tracking-wide text-warning uppercase">
          Developer only · local testing
        </h2>
        <p className="mt-1 text-meta text-fg-muted">
          Not part of the app. The button above signs in as the test volunteer, through the sample Planning Center.
          Switch test user:
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {users.map((u) => (
            <li key={u.key}>
              <button
                type="button"
                onClick={() => void signInAs(u.key)}
                disabled={pendingKey !== null}
                title={u.description}
                className="min-h-11 rounded-control border border-line bg-card px-3 text-meta text-fg transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendingKey === u.key ? "Signing in…" : u.name.replace(/^Test /, "")}
              </button>
            </li>
          ))}
        </ul>
        {schedule && (
          <div className="mt-4 border-t border-warning/30 pt-3">
            <Switch label="Planning Center (sample data) is down" on={Boolean(schedule.down)} onToggle={() => void toggleDown()} />
            <p className="mt-1 text-meta text-fg-muted">
              Down: schedule lookups fail, and the button above can't sign in. People already signed in carry on.
            </p>
          </div>
        )}
      </section>
    </SignInScreen>
  );
}
