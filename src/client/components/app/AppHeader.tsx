import type { CurrentUser } from "../../../shared/types";
import { attentionItems, useMappingStatus } from "../../lib/adminAttention";
import type { Navigate, Route } from "../../lib/router";
import { AppNav } from "./AppNav";
import { Brand } from "./Brand";
import { UserMenu } from "./UserMenu";

interface Props {
  user: CurrentUser;
  route: Route;
  onNavigate: Navigate;
  onSignOut: () => void;
  signingOut: boolean;
  signOutError: string | null;
}

// Compact top bar (design.md §3A): brand, role-authorized sections, and the user menu.
// On phones the brand shrinks to its mark so the section links fit.
export function AppHeader({ user, route, onNavigate, ...menu }: Props) {
  // Admins only: what needs their attention, asked once per page load and after mapping changes (lib/adminAttention.ts).
  const attentionCount = attentionItems(useMappingStatus(user.isAdmin)).length;
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-line bg-panel">
      <div className="mx-auto flex h-full max-w-app items-center gap-2 px-4 sm:gap-4 md:px-6">
        {/* The branding links to the Checklist for anyone with access (not on the access screens). */}
        <Brand compact onHome={user.hasAccess ? onNavigate : undefined} />
        <div className="h-full min-w-0 flex-1">
          <AppNav user={user} route={route} onNavigate={onNavigate} />
        </div>
        <UserMenu user={user} route={route} onNavigate={onNavigate} attentionCount={attentionCount} {...menu} />
      </div>
    </header>
  );
}
