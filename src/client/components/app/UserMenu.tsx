import { type KeyboardEvent, useEffect, useRef } from "react";
import type { CurrentUser } from "../../../shared/types";
import { type Navigate, type Route, isAdminRoute } from "../../lib/router";
import { roleLabel } from "../../lib/roles";
import { type ThemePreference, useThemePreference } from "../../lib/theme";
import { usePopover } from "../../lib/usePopover";
import { Avatar } from "../ui/Avatar";
import { Chevron } from "../ui/Chevron";
import { MonitorIcon, MoonIcon, OverviewIcon, SignOutIcon, SunIcon } from "../ui/Icons";
import { RouteLink } from "./RouteLink";

interface Props {
  user: CurrentUser;
  route: Route;
  onNavigate: Navigate;
  onSignOut: () => void;
  signingOut: boolean;
  signOutError: string | null;
  /** Admins only: how many things need their attention (lib/adminAttention.ts); a dot on the avatar and a count here. */
  attentionCount?: number;
}

const ITEM =
  "flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left text-sm transition-colors outline-offset-[-2px] hover:bg-hover kbd-focus:bg-hover disabled:cursor-not-allowed disabled:opacity-50";

const APPEARANCE: { value: ThemePreference; label: string; icon: typeof MoonIcon }[] = [
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

/** Focus stops for ↑/↓: each menu item, and the appearance row as one stop (its chosen option). */
const STOPS = "[role=menuitem]:not([disabled]), [role=menuitemradio][aria-checked=true]";

/**
 * The menu under the person's name (design.md §3A, requirements v1.20): who they are; Appearance (Dark / Light /
 * System, US-08a) for everyone; Administrative Settings for Admins only (the server refuses everyone else too), with a
 * count when something needs their attention; then Sign out, set apart.
 * A real menu for keyboards: focus moves in on opening, ↑/↓ and Home/End move between items (the appearance row is one
 * stop), ←/→ move along the row, Enter or Space picks; Escape or Tab closes, and Escape returns focus to the button.
 * Picking an appearance keeps the menu open, so the change shows straight away.
 */
export function UserMenu({ user, route, onNavigate, onSignOut, signingOut, signOutError, attentionCount = 0 }: Props) {
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  const role = roleLabel(user);
  const { preference, setPreference } = useThemePreference();
  const attention = user.isAdmin && attentionCount > 0 ? attentionCount : 0;

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>(STOPS)?.focus();
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    const menu = menuRef.current;
    if (!menu) return;
    const active = document.activeElement as HTMLElement | null;
    const radios = [...menu.querySelectorAll<HTMLElement>("[role=menuitemradio]")];
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && active && radios.includes(active)) {
      e.preventDefault();
      const i = radios.indexOf(active) + (e.key === "ArrowRight" ? 1 : -1);
      radios[(i + radios.length) % radios.length]?.focus();
      return;
    }
    const stops = [...menu.querySelectorAll<HTMLElement>(STOPS)];
    // Any option in the appearance row counts as the row's stop.
    const at = active && radios.includes(active) ? stops.findIndex((s) => radios.includes(s)) : stops.indexOf(active as HTMLElement);
    const move = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: stops.length - 1 }[e.key];
    if (move !== undefined) {
      e.preventDefault();
      stops[(move + stops.length) % stops.length]?.focus();
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
        aria-label={`Account: ${user.name}${attention ? `, ${attention} ${attention === 1 ? "thing needs" : "things need"} your attention` : ""}`}
        className="flex min-h-11 items-center gap-2.5 rounded-control px-2 transition-colors hover:bg-hover"
      >
        <span className="relative shrink-0">
          <Avatar name={user.name} url={user.avatarUrl} />
          {attention > 0 && (
            <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-warning ring-2 ring-panel" />
          )}
        </span>
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
          className="absolute top-full right-0 z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-card border border-line bg-panel p-1.5"
        >
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar name={user.name} url={user.avatarUrl} className="size-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              {role && <p className="text-meta text-fg-muted">{role}</p>}
            </div>
          </div>

          <fieldset aria-labelledby="appearance-label" className="mt-0.5 border-t border-line px-1.5 pt-2.5 pb-2">
            <p id="appearance-label" className="mb-1.5 px-1 text-meta text-fg-muted">
              Appearance
            </p>
            <div className="grid grid-cols-3 gap-1">
              {APPEARANCE.map(({ value, label, icon: Icon }) => {
                const checked = preference === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={checked}
                    onClick={() => setPreference(value)}
                    className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-control border px-1 py-1 text-meta transition-colors outline-offset-[-2px] ${
                      checked ? "border-accent bg-accent/10 font-medium text-fg" : "border-line text-fg-muted hover:bg-hover hover:text-fg"
                    }`}
                  >
                    <Icon className={`size-4 ${checked ? "text-accent-soft" : ""}`} />
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {user.isAdmin && (
            <div role="none" className="mt-0.5 border-t border-line py-1.5">
              <RouteLink
                to="admin-home"
                current={isAdminRoute(route)}
                onNavigate={go}
                role="menuitem"
                className={`${ITEM} ${isAdminRoute(route) ? "font-medium text-fg" : "text-fg-muted hover:text-fg"}`}
              >
                <OverviewIcon className={`size-5 shrink-0 ${isAdminRoute(route) ? "text-accent-soft" : ""}`} />
                <span className="min-w-0 flex-1">Administrative Settings</span>
                {attention > 0 && (
                  <span className="rounded-full bg-warning/15 px-1.5 text-meta font-semibold text-warning">
                    {attention}
                    <span className="sr-only"> need{attention === 1 ? "s" : ""} attention</span>
                  </span>
                )}
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
