import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

// US-02: signed in, but not on a linked media team and no Admin/Director role; or the app's team mapping isn't set up
// yet, when only Admins and Directors get in; or (US-04a) the schedule source couldn't be reached to confirm their team
// and they haven't been confirmed in the last 90 days.
export function NoAccessPage({
  settingUp = false,
  unreachable,
  onRetry,
  onSignOut,
  signingOut,
}: {
  settingUp?: boolean;
  /** The schedule source's name, when it couldn't be reached to confirm their team (US-04a). */
  unreachable?: string;
  onRetry?: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  if (unreachable) {
    return (
      <main className="mx-auto flex max-w-app justify-center px-4 py-12 md:py-20">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-page font-semibold tracking-tight">Couldn't confirm your team</h1>
          <p className="mt-2 text-task text-fg-muted">
            We couldn't reach {unreachable} to confirm your team. Please try again in a few minutes.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {onRetry && (
              <Button variant="primary" onClick={onRetry}>
                Try again
              </Button>
            )}
            <Button onClick={onSignOut} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </Card>
      </main>
    );
  }
  if (settingUp) {
    return (
      <main className="mx-auto flex max-w-app justify-center px-4 py-12 md:py-20">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-page font-semibold tracking-tight">Almost ready</h1>
          <p className="mt-2 text-task text-fg-muted">The app is being set up. Check back soon.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {onRetry && (
              <Button variant="primary" onClick={onRetry}>
                Try again
              </Button>
            )}
            <Button onClick={onSignOut} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </Card>
      </main>
    );
  }
  return (
    <main className="mx-auto flex max-w-app justify-center px-4 py-12 md:py-20">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-page font-semibold tracking-tight">Media team only</h1>
        <p className="mt-2 text-task text-fg-muted">
          This app is for the media team. If you think you should have access, contact a media team admin.
        </p>
        <Button className="mt-5" onClick={onSignOut} disabled={signingOut}>
          {signingOut ? "Signing out…" : "Sign in with a different account"}
        </Button>
      </Card>
    </main>
  );
}
