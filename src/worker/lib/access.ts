import type { CurrentUser } from "../../shared/types";
import type { User } from "../db/users";

const isStaff = (user: User) => user.isAdmin || user.isDirector;

/**
 * How long a confirmed team membership lets someone in (US-04a). Membership is re-checked on every page load while
 * the schedule source can be reached, so this only matters during an outage.
 */
export const VERIFIED_FOR_DAYS = 90;

const recentlyVerified = (user: User, now = Date.now()) =>
  user.teamVerifiedAt !== null && now - Date.parse(user.teamVerifiedAt) <= VERIFIED_FOR_DAYS * 24 * 60 * 60 * 1000;

/**
 * US-02: Admins and Directors always have access. Anyone else needs team mapping to be set up (`mappingReady`,
 * db/schedule-view.ts isTeamMappingReady) and to have been confirmed as a member of a linked team
 * (team_verified_at, stamped by verifyMembership) within the last 90 days, which keeps people working through a
 * schedule-source outage (US-04a).
 */
export const hasAccess = (user: User, mappingReady: boolean) => isStaff(user) || (mappingReady && recentlyVerified(user));

/** `unreachable`: the schedule source's name when it couldn't be reached to confirm their team just now. */
export const toCurrentUser = (user: User, mappingReady: boolean, unreachable?: string): CurrentUser => ({
  id: user.id,
  name: user.name,
  avatarUrl: user.avatarUrl,
  isAdmin: user.isAdmin,
  isDirector: user.isDirector,
  hasAccess: hasAccess(user, mappingReady),
  ...(!mappingReady && !isStaff(user) ? { settingUp: true as const } : {}),
  ...(mappingReady && unreachable && !hasAccess(user, mappingReady) ? { unreachable } : {}),
});
