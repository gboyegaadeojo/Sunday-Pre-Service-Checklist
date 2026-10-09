import type { CurrentUser } from "../../shared/types";
import type { User } from "../db/users";

/**
 * US-02: Admins and Directors always have access; otherwise the user must have been verified
 * as a member of a linked media team. Stage 7 adds the real Planning Center check and the
 * 90-day fallback window (US-04a).
 */
export const hasAccess = (user: User) => user.isAdmin || user.isDirector || user.teamVerifiedAt !== null;

export const toCurrentUser = (user: User): CurrentUser => ({
  id: user.id,
  name: user.name,
  avatarUrl: user.avatarUrl,
  isAdmin: user.isAdmin,
  isDirector: user.isDirector,
  hasAccess: hasAccess(user),
});
