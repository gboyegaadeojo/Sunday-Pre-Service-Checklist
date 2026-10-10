import { SignInScreen } from "../components/app/SignInScreen";

// Production sign-in. Stage 9 connects the button to Planning Center OAuth (US-01);
// until then it is shown disabled with a note rather than as a button that does nothing.
export function SignInPage(_props: { onSignedIn: () => void }) {
  return <SignInScreen />;
}
