import type { CurrentUser } from "../../../shared/types";
import { roleLabel } from "../../lib/roles";
import { usePopover } from "../../lib/usePopover";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Chevron } from "../ui/Chevron";

interface Props {
  user: CurrentUser;
  onSignOut: () => void;
  signingOut: boolean;
  signOutError: string | null;
}

// Avatar, name and role in the header (design.md §3A), with sign-out in a small menu.
export function UserMenu({ user, onSignOut, signingOut, signOutError }: Props) {
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const role = roleLabel(user);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="user-menu"
        aria-label={`Account: ${user.name}`}
        className="flex min-h-11 items-center gap-2.5 rounded-control px-2 transition-colors hover:bg-hover"
      >
        <Avatar name={user.name} url={user.avatarUrl} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium">{user.name}</span>
          {role && <span className="block text-meta text-fg-muted">{role}</span>}
        </span>
        <Chevron open={open} className="hidden sm:block" />
      </button>

      {open && (
        <div id="user-menu" className="absolute top-full right-0 z-40 mt-1 w-64 rounded-card border border-line bg-panel p-3">
          <p className="text-sm font-medium">{user.name}</p>
          {role && <p className="text-meta text-fg-muted">{role}</p>}
          {signOutError && (
            <p role="alert" className="mt-3 text-meta text-danger">
              {signOutError}
            </p>
          )}
          <Button className="mt-3 w-full" onClick={onSignOut} disabled={signingOut}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      )}
    </div>
  );
}
