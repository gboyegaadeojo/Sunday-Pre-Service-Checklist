import type { CurrentUser } from "../../../shared/types";
import { Brand } from "./Brand";
import { UserMenu } from "./UserMenu";

interface Props {
  user: CurrentUser;
  onSignOut: () => void;
  signingOut: boolean;
  signOutError: string | null;
}

// Compact top bar (design.md §3A). Service date and role-authorized links are added in later stages.
export function AppHeader(props: Props) {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-line bg-panel">
      <div className="mx-auto flex h-full max-w-app items-center justify-between gap-3 px-4 md:px-6">
        <Brand />
        <UserMenu {...props} />
      </div>
    </header>
  );
}
