import type { CurrentUser } from "../../shared/types";
import type { User } from "../db/users";

const isStaff = (user: User) => user.isAdmin || user.isDirector;

/**
 * US-02: Admins and Directors always have access. Anyone else needs team mapping to be set up (`mappingReady`,
 * db/schedule-view.ts isTeamMappingReady) and to have been confirmed as a member of a linked team
 * (team_verified_at, stamped by verifyMembership). Stage 7c adds the 90-day window for outages (US-04a).
 */
export const hasAccess = (user: User, mappingReady: boolean) => isStaff(user) || (mappingReady && user.teamVerifiedAt !== null);

export const toCurrentUser = (user: User, mappingReady: boolean): CurrentUser => ({
  id: user.id,
  name: user.name,
  avatarUrl: user.avatarUrl,
  isAdmin: user.isAdmin,
  isDirector: user.isDirector,
  hasAccess: hasAccess(user, mappingReady),
  ...(!mappingReady && !isStaff(user) ? { settingUp: true as const } : {}),
});
