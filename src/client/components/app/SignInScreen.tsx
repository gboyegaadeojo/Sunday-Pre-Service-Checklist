import type { ReactNode } from "react";
import { useThemePreference } from "../../lib/theme";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { InfoIcon, MonitorIcon, MoonIcon, SunIcon } from "../ui/Icons";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Brand } from "./Brand";

interface Props {
  /** Starts sign-in. Undefined while sign-in is not available (button shown disabled with a note). */
  onSignIn?: () => void;
  signingIn?: boolean;
  error?: string | null;
  /** Why they're here, e.g. signed out mid-save and the change wasn't saved. */
  notice?: string | null;
  /** Rendered below the sign-in card (local development tools only). */
  children?: ReactNode;
}

// The one sign-in screen (US-01, design.md). It only ever offers a single option: roles come from
// Planning Center membership and the app's role flags after sign-in, never from the user.
export function SignInScreen({ onSignIn, signingIn = false, error = null, notice = null, children }: Props) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Brand />
        </div>
        <Card className="p-6">
          <h1 className="text-page font-semibold tracking-tight">Sign in</h1>
          {notice && (
            <p role="status" className="mt-3 flex gap-2.5 rounded-control border border-accent-soft/30 bg-accent/10 px-3 py-2.5 text-sm">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-accent-soft" />
              <span className="min-w-0">{notice}</span>
            </p>
          )}
          <p className="mt-1 text-sm text-fg-muted">
            Use your Planning Center account. Your team and role are set by Planning Center and the media team admins.
          </p>
          <Button
            variant="primary"
            className="mt-6 min-h-12 w-full text-task"
            onClick={onSignIn}
            disabled={!onSignIn || signingIn}
          >
            {signingIn ? "Signing in…" : "Sign in with Planning Center"}
          </Button>
          {!onSignIn && (
            <p className="mt-3 text-center text-meta text-fg-muted">Planning Center sign-in is being set up.</p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
        </Card>
        {children}
        <AppearanceChoice />
      </div>
    </main>
  );
}

/** Dark / Light / System before signing in (US-08a); signed in, it's in the menu under the person's name. */
function AppearanceChoice() {
  const { preference, setPreference } = useThemePreference();
  return (
    <div className="mt-6">
      <p className="mb-1.5 text-meta text-fg-muted">Appearance</p>
      <SegmentedControl
        label="Appearance"
        value={preference}
        onChange={setPreference}
        options={[
          { value: "dark", label: "Dark", icon: <MoonIcon className="size-4 shrink-0 text-fg-muted" /> },
          { value: "light", label: "Light", icon: <SunIcon className="size-4 shrink-0 text-fg-muted" /> },
          { value: "system", label: "System", icon: <MonitorIcon className="size-4 shrink-0 text-fg-muted" /> },
        ]}
      />
    </div>
  );
}
