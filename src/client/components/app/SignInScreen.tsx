import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Brand } from "./Brand";

interface Props {
  /** Starts sign-in. Undefined while sign-in is not available (button shown disabled with a note). */
  onSignIn?: () => void;
  signingIn?: boolean;
  error?: string | null;
  /** Rendered below the sign-in card (local development tools only). */
  children?: ReactNode;
}

// The one sign-in screen (US-01, design.md). It only ever offers a single option: roles come from
// Planning Center membership and the app's role flags after sign-in, never from the user.
export function SignInScreen({ onSignIn, signingIn = false, error = null, children }: Props) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Brand />
        </div>
        <Card className="p-6">
          <h1 className="text-page font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Use your Planning Center account. Your team and role are set by Planning Center and the media team admins.
          </p>
          <Button
            variant="primary"
            className="mt-6 min-h-12 w-full text-[15px]"
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
      </div>
    </main>
  );
}
