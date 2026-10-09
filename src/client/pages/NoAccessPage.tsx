import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

// US-02: signed in, but not on a linked media team and no Admin/Director role.
export function NoAccessPage({ onSignOut, signingOut }: { onSignOut: () => void; signingOut: boolean }) {
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
