// What the schedule source says about a person, and what follows for the app (Stage 7b):
// - membership (US-02): on a linked team → access; the check is stamped in users.team_verified_at.
// - the plan for the current service (US-05, US-07): it's "published", and it says who is scheduled where.
// - the department view (US-05): which departments the checklist shows a person first, or only.
// Every source call is cached for a few minutes (sources/cache.ts). Nothing here limits what anyone may check off:
// the view is a display choice, and the server accepts any live task from anyone with access.

import type { ChecklistView } from "../../shared/types";
import { cached } from "../sources/cache";
import { ProviderUnavailableError } from "../sources/identity";
import { PERSON_PROVIDER, type ScheduleSource, type SourceAssignment, type SourcePlan } from "../sources/schedule";
import { getServiceTypeId } from "./mapping";
import type { Service } from "./services";
import type { User } from "./users";

/** The person's ID in the source, from their linked sign-in account; null if they have none there. */
const personFor = async (db: D1Database, source: ScheduleSource, userId: number) =>
  (
    await db
      .prepare("SELECT subject FROM user_identities WHERE user_id = ? AND provider = ?")
      .bind(userId, PERSON_PROVIDER[source.id])
      .first<{ subject: string }>()
  )?.subject ?? null;

/** null while the source can't be reached: callers carry on without it (US-04a; Stage 7c adds the banner). */
async function orUnavailable<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ProviderUnavailableError) return null;
    throw err;
  }
}

/**
 * Is team mapping set up (US-02)? A source is connected, an Admin has chosen its Service Type, and at least one team
 * or position is linked. Until then nobody can be confirmed as a media team member, so only Admins and Directors
 * get in (everyone else is told the app is being set up). One query.
 */
export async function isTeamMappingReady(db: D1Database, source: ScheduleSource | null): Promise<boolean> {
  if (!source) return false;
  const row = await db
    .prepare(
      `SELECT (SELECT value FROM settings WHERE key = 'schedule_source') = ?1
               AND (SELECT value FROM settings WHERE key = 'schedule_service_type') IS NOT NULL
               AND EXISTS (SELECT 1 FROM team_links WHERE source = ?1) AS ready`,
    )
    .bind(source.id)
    .first<{ ready: number }>();
  return row?.ready === 1;
}

export type Membership = "member" | "not_member" | "unknown";

/**
 * US-02: is the user on a team an Admin has linked? Membership is enough; this week's schedule doesn't matter.
 * Stamps users.team_verified_at with `now` for a member and clears it for someone who isn't. "unknown" changes
 * nothing: no source, team mapping not set up yet (no Service Type or no links: before then nobody could be
 * confirmed, so existing access is left alone), no account in this source, or the source can't be reached.
 */
export async function verifyMembership(db: D1Database, source: ScheduleSource | null, userId: number, now: Date): Promise<Membership> {
  if (!source || !(await getServiceTypeId(db, source))) return "unknown";
  const { results: linked } = await db
    .prepare("SELECT DISTINCT team_external_id FROM team_links WHERE source = ?")
    .bind(source.id)
    .all<{ team_external_id: string }>();
  const person = await personFor(db, source, userId);
  if (linked.length === 0 || !person) return "unknown";

  const teams = await orUnavailable(() => cached(db, `${source.id}:teams-of:${person}`, () => source.teamsOf(person)));
  if (!teams) return "unknown";
  const member = teams.some((t) => linked.some((l) => l.team_external_id === t));
  await db
    .prepare("UPDATE users SET team_verified_at = CASE WHEN ?2 THEN ?3 ELSE NULL END WHERE id = ?1")
    .bind(userId, member ? 1 : 0, now.toISOString())
    .run();
  return member ? "member" : "not_member";
}

/**
 * The source's plan for the current service's date, recorded on the service (plan_source, plan_external_id): the
 * service is then "published" (US-05) and its assignments say who is scheduled. Unchanged without a plan.
 * The date itself still comes from the service-day setting; a plan on another date doesn't move the service.
 */
export async function attachPlan(db: D1Database, source: ScheduleSource | null, service: Service): Promise<Service> {
  const serviceTypeId = source && (await getServiceTypeId(db, source));
  if (!source || !serviceTypeId) return service;
  const plan = await orUnavailable(() =>
    cached<SourcePlan | null>(db, `${source.id}:plan:${serviceTypeId}:${service.date}`, () => source.nextPlan(serviceTypeId, service.date)),
  );
  if (!plan || plan.date !== service.date) return service;
  if (service.planExternalId !== plan.externalId) {
    await db
      .prepare("UPDATE services SET plan_source = ?2, plan_external_id = ?3 WHERE id = ?1")
      .bind(service.id, source.id, plan.externalId)
      .run();
  }
  return { ...service, planExternalId: plan.externalId };
}

/**
 * US-05: which departments the checklist shows this person.
 * - "all": Admins, Directors, and anyone scheduled in a team or position marked "sees all departments". Their own
 *   departments (if scheduled) come first.
 * - "own": scheduled, and their positions lead to departments: those only, with "Show all departments".
 * - "choose": everything, and they pick theirs. `note` says why: not scheduled for this service, or scheduled in a
 *   position nobody has linked yet; null when the schedule can't tell (nothing set up, no plan, source unreachable).
 * `categoryIds` are the service checklist's departments in display order; `own` follows that order.
 */
export async function getChecklistView(
  db: D1Database,
  source: ScheduleSource | null,
  user: User,
  service: Service,
  categoryIds: number[],
): Promise<ChecklistView> {
  const staff = user.isAdmin || user.isDirector;
  const unknown: ChecklistView = { mode: staff ? "all" : "choose", own: [], note: null };
  if (!source || !service.planExternalId || !(await getServiceTypeId(db, source))) return unknown;
  const person = await personFor(db, source, user.id);
  if (!person) return unknown;
  const plan = service.planExternalId;
  const assignments = await orUnavailable(() =>
    cached<SourceAssignment[]>(db, `${source.id}:assignments:${plan}:${person}`, () => source.assignments(plan, person)),
  );
  if (!assignments) return unknown;

  const { results: links } = await db
    .prepare("SELECT team_external_id, position_external_id, category_id, sees_all FROM team_links WHERE source = ?")
    .bind(source.id)
    .all<{ team_external_id: string; position_external_id: string | null; category_id: number; sees_all: number }>();
  // A position's own link wins over its team's (US-15).
  const resolved = assignments
    .map(
      (a) =>
        links.find((l) => l.team_external_id === a.teamExternalId && a.positionExternalId !== null && l.position_external_id === a.positionExternalId) ??
        links.find((l) => l.team_external_id === a.teamExternalId && l.position_external_id === null),
    )
    .filter((l) => l !== undefined);
  const own = categoryIds.filter((id) => resolved.some((l) => l.category_id === id));
  const seesAll = resolved.some((l) => l.sees_all === 1);

  if (staff || seesAll) return { mode: "all", own, note: null };
  if (own.length > 0) return { mode: "own", own, note: null };
  return { mode: "choose", own: [], note: assignments.length > 0 ? "not_linked" : "not_scheduled" };
}
