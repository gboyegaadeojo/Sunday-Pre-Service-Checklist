import type { CurrentUser } from "../../shared/types";

/** Role shown next to the user's name, or null for someone without access. */
export function roleLabel(user: CurrentUser): string | null {
  if (!user.hasAccess) return null;
  const roles = [user.isAdmin && "Admin", user.isDirector && "Director"].filter(Boolean);
  return roles.length > 0 ? roles.join(" · ") : "Volunteer";
}
