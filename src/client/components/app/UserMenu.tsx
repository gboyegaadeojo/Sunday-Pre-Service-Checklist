import { type KeyboardEvent, useEffect, useRef } from "react";
import type { CurrentUser } from "../../../shared/types";
import { type Navigate, type Route, isAdminRoute } from "../../lib/router";
import { roleLabel } from "../../lib/roles";
import { usePopover } from "../../lib/usePopover";
import { Avatar } from "../ui/Avatar";
import { Chevron } from "../ui/Chevron";
import { OverviewIcon, SignOutIcon } from "../ui/Icons";
import { RouteLink } from "./RouteLink";

interface Props {
  user: CurrentUser;
  route: Route;
  onNavigate: Navigate;
  onSignOut: () => void;
  signingOut: boolean;
  signOutError: string | null;
}

const ITEM =
  "flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left text-sm transition-colors outline-offset-[-2px] hover:bg-hover focus-visible:bg-hover disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The menu under the person's name (design.md §3A, requirements v1.20): who they are, then Administrative Settings
 * for Admins only (the server refuses everyone else too), then Sign out, set apart. A real menu for keyboards: focus
 * moves into it on opening, arrow keys and Home/End move between items, Escape or Tab closes it and Escape returns
 * focus to the button.
 */
export function UserMenu({ user, route, onNavigate, onSignOut, signingOut, signOutError }: Props) {
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  const role = roleLabel(user);

  const items = () => [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? [])];
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus();
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const move = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: list.length - 1 }[e.key];
    if (move !== undefined) {
      e.preventDefault();
      list[(move + list.length) % list.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const go: Navigate = (to, search) => {
    setOpen(false);
    onNavigate(to, search);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
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
        <div
          ref={menuRef}
          id="user-menu"
          role="menu"
          aria-label={`Account: ${user.name}`}
          onKeyDown={onKeyDown}
          className="absolute top-full right-0 z-40 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-card border border-line bg-panel p-1.5"
        >
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar name={user.name} url={user.avatarUrl} className="size-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              {role && <p className="text-meta text-fg-muted">{role}</p>}
            </div>
          </div>

          {user.isAdmin && (
            <div role="none" className="mt-0.5 border-t border-line py-1.5">
              <RouteLink
                to="admin-overview"
                current={isAdminRoute(route)}
                onNavigate={go}
                role="menuitem"
                className={`${ITEM} ${isAdminRoute(route) ? "font-medium text-fg" : "text-fg-muted hover:text-fg"}`}
              >
                <OverviewIcon className={`size-5 shrink-0 ${isAdminRoute(route) ? "text-accent-soft" : ""}`} />
                Administrative Settings
              </RouteLink>
            </div>
          )}

          <div role="none" className="mt-0.5 border-t border-line pt-1.5">
            {signOutError && (
              <p role="alert" className="px-3 pb-1.5 text-meta text-danger">
                {signOutError}
              </p>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={onSignOut} // stays open while signing out, so an error shows here
              disabled={signingOut}
              className={`${ITEM} text-fg-muted hover:text-fg`}
            >
              <SignOutIcon className="size-5 shrink-0" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
