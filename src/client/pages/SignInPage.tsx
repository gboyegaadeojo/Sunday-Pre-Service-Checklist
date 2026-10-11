import { useEffect, useState } from "react";
import { SignInScreen } from "../components/app/SignInScreen";
import { planningCenterSignInReady, startPlanningCenterSignIn, useSignInResult } from "../lib/signInResult";

// Production sign-in (US-01): "Sign in with Planning Center" starts the real flow once its OAuth application is
// configured (Stage 9c); until then the button stays disabled with a note, rather than a button that does nothing.
// A sign-in that came back unfinished says why (cancelled, Planning Center unavailable: US-04b).
export function SignInPage({ notice }: { onSignedIn: () => void; notice?: string | null }) {
  const result = useSignInResult();
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void planningCenterSignInReady().then(setReady);
  }, []);

  return (
    <SignInScreen
      onSignIn={
        ready
          ? () => {
              setStarting(true);
              startPlanningCenterSignIn();
            }
          : undefined
      }
      signingIn={starting}
      error={result}
      notice={notice}
    />
  );
}
