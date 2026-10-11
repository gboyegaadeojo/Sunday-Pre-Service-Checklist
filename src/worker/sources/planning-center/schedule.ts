// The church's schedule from Planning Center Services (Stage 9b; requirements C22, US-02, US-05, US-07, US-15),
// read with the church's Personal Access Token (config.ts). Nothing outside src/worker/sources/ knows this is
// Planning Center: it's a ScheduleSource like the fake one. Callers wrap every call in cached() (sources/cache.ts):
// 5-second limit, 5-minute cache, outage fallback.

import { addDays, localDate } from "../../../shared/service-day";
import type { ScheduleSource, SourceAssignment, SourcePlan, SourceServiceType, SourceTeam } from "../schedule";
import { type FetchLike, NotFoundError, type PlanningCenterClient, type Resource, createClient, relatedId } from "./client";
import { planningCenterCredentials } from "./config";

/** A plan's ID as the app stores it: Planning Center needs the Service Type to find a plan again. */
const planId = (serviceTypeId: string, id: string) => `${serviceTypeId}:${id}`;
const parsePlanId = (externalId: string) => {
  const [serviceTypeId, id] = externalId.split(":");
  return { serviceTypeId, id };
};

const live = (r: Resource) => !r.attributes.archived_at && !r.attributes.deleted_at;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Something Planning Center doesn't have (404) is none of it: someone with no Services profile is on no team and
 * scheduled nowhere; a Service Type deleted there has no teams or plans (its links then show as missing, US-15).
 */
async function orNone<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch (err) {
    if (err instanceof NotFoundError) return [];
    throw err;
  }
}

/** The church's time zone (Settings, US-11a), for turning a plan's time into its date. Never assumed in code. */
async function timeZoneOf(db: D1Database): Promise<string> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'time_zone'").first<{ value: string }>();
  if (!row?.value) throw new Error("The church's time zone isn't set (Church settings).");
  return row.value;
}

export function createPlanningCenterSchedule(
  db: D1Database,
  credentials: { appId: string; secret: string },
  fetchImpl?: FetchLike,
): ScheduleSource {
  const api: PlanningCenterClient = createClient(credentials, fetchImpl);

  const listTeams = (serviceTypeId: string): Promise<SourceTeam[]> =>
    orNone(async () => {
    const { data, included } = await api.list(`/services/v2/service_types/${serviceTypeId}/teams?per_page=100&include=team_positions`);
    const positions = new Map(included.filter((r) => r.type === "TeamPosition").map((p) => [p.id, p]));
    return data.filter(live).map((team) => {
      const ids = team.relationships?.team_positions?.data;
      const own = Array.isArray(ids)
        ? ids.map((ref) => positions.get(ref.id)).filter((p): p is Resource => p !== undefined)
        : [...positions.values()].filter((p) => relatedId(p, "team") === team.id);
      return {
        externalId: team.id,
        name: String(team.attributes.name ?? ""),
        positions: own.map((p) => ({ externalId: p.id, name: String(p.attributes.name ?? "") })),
      };
    });
    });

  return {
    id: "planning_center",
    label: "Planning Center",

    async listServiceTypes(): Promise<SourceServiceType[]> {
      const { data } = await api.list("/services/v2/service_types?per_page=100&order=sequence");
      return data.filter(live).map((st) => ({ externalId: st.id, name: String(st.attributes.name ?? "") }));
    },

    listTeams,

    // Team membership is the roster (US-02): the teams of the positions the person is assigned to, plus teams they
    // lead. Being scheduled this week isn't needed.
    async teamsOf(person) {
      const [assigned, leading] = await Promise.all([
        orNone(async () => {
          const { data, included } = await api.list(`/services/v2/people/${person}/person_team_position_assignments?per_page=100&include=team_position`);
          const positions = new Map(included.filter((r) => r.type === "TeamPosition").map((p) => [p.id, p]));
          return data.map((a) => {
            const position = positions.get(relatedId(a, "team_position") ?? "");
            return position ? relatedId(position, "team") : null;
          });
        }),
        orNone(async () => (await api.list(`/services/v2/people/${person}/team_leaders?per_page=100`)).data.map((l) => relatedId(l, "team"))),
      ]);
      return [...new Set([...assigned, ...leading].filter((id): id is string => id !== null))];
    },

    // The earliest plan on or after `fromDate` in the church's time zone (US-07). Planning Center is asked from the
    // day before, since its dates are in UTC; the first page (sorted by date) is plenty.
    async nextPlan(serviceTypeId, fromDate): Promise<SourcePlan | null> {
      const [timeZone, data] = await Promise.all([
        timeZoneOf(db),
        orNone(
          async () =>
            (await api.list(`/services/v2/service_types/${serviceTypeId}/plans?filter=after&after=${addDays(fromDate, -1)}&order=sort_date&per_page=25`, 1)).data,
        ),
      ]);
      for (const plan of data) {
        const sortDate = plan.attributes.sort_date;
        if (typeof sortDate !== "string") continue; // a plan with no times has no date yet
        const date = localDate(new Date(sortDate), timeZone).date;
        if (date >= fromDate) return { externalId: planId(serviceTypeId, plan.id), date };
      }
      return null;
    },

    // Where the person is scheduled in the plan (US-05): their team and position, unless they declined. Planning
    // Center names the position here rather than giving its ID, so it's matched by name within that team; a position
    // renamed after the schedule was made then counts as the whole team (its team link, if any, still applies).
    async assignments(planExternalId, person): Promise<SourceAssignment[]> {
      const { serviceTypeId, id } = parsePlanId(planExternalId);
      const [members, teams] = await Promise.all([
        orNone(async () => (await api.list(`/services/v2/service_types/${serviceTypeId}/plans/${id}/team_members?per_page=100`)).data),
        listTeams(serviceTypeId),
      ]);
      const assignments: SourceAssignment[] = [];
      for (const m of members) {
        if (relatedId(m, "person") !== person || m.attributes.status === "D") continue;
        const teamId = relatedId(m, "team");
        if (!teamId) continue;
        const positionName = typeof m.attributes.team_position_name === "string" ? m.attributes.team_position_name : "";
        const position = teams.find((t) => t.externalId === teamId)?.positions.find((p) => positionName && sameName(p.name, positionName));
        assignments.push({ teamExternalId: teamId, positionExternalId: position?.externalId ?? null });
      }
      return assignments;
    },
  };
}

/** Planning Center's schedule when its token is configured (config.ts), otherwise none. */
export function planningCenterSchedule(env: Env, db: D1Database): ScheduleSource | null {
  const credentials = planningCenterCredentials(env).schedule;
  return credentials ? createPlanningCenterSchedule(db, credentials) : null;
}
