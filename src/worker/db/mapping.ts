// Team mapping (Stage 7a, US-15): links from the schedule source's teams and positions to checklist departments in
// the default list. Links use the source's IDs (team_links.source + *_external_id), never names, so renames in the
// source don't break them. Nothing is ever linked automatically: only an Admin's choice creates a link.
//
// Every change is logged to the append-only mapping_events table in the same transaction: the log row is written
// first, only if the link is still as it was read (and the department is live in the default list), and the change
// runs only if it was (changes() = 1), as in db/roles.ts.

import type {
  MappingEditEvent,
  MappingEditsResponse,
  MappingLink,
  MappingResponse,
  MappingTeam,
  MissingLink,
} from "../../shared/types";
import { cached, clearCache } from "../sources/cache";
import type { ScheduleSource, SourceServiceType, SourceTeam } from "../sources/schedule";
import { type Actor, actorValues } from "./checkoffs";
import { getSettings } from "./settings";

const DEFAULT_LIST = "(SELECT id FROM task_lists WHERE is_default = 1 AND deleted_at IS NULL)";
/** A department an Admin can link to: live, in the default list. */
const LINKABLE = `SELECT id FROM categories WHERE deleted_at IS NULL AND list_id = ${DEFAULT_LIST}`;

// The Service Type the app follows is a setting, stored with its source so a different source starts unset.
const SOURCE_KEY = "schedule_source";
const SERVICE_TYPE_KEY = "schedule_service_type";

/** The Service Type chosen for this source, or null. */
export async function getServiceTypeId(db: D1Database, source: ScheduleSource): Promise<string | null> {
  const s = await getSettings(db, [SOURCE_KEY, SERVICE_TYPE_KEY]);
  return s[SOURCE_KEY] === source.id ? s[SERVICE_TYPE_KEY] : null;
}

const cacheKey = (source: ScheduleSource, ...parts: string[]) => [source.id, ...parts].join(":");

export const listServiceTypes = (db: D1Database, source: ScheduleSource) =>
  cached<SourceServiceType[]>(db, cacheKey(source, "service-types"), () => source.listServiceTypes());

/** The Service Type's teams and positions, cached for a few minutes, with when they were fetched. */
export const listTeams = (db: D1Database, source: ScheduleSource, serviceTypeId: string) =>
  cached<{ teams: SourceTeam[]; fetchedAt: string }>(db, cacheKey(source, "teams", serviceTypeId), async () => ({
    teams: await source.listTeams(serviceTypeId),
    fetchedAt: new Date().toISOString(),
  }));

/** "Refresh from Planning Center": forget everything cached from this source, so the next read fetches it anew. */
export const refreshSchedule = (db: D1Database, source: ScheduleSource) => clearCache(db, `${source.id}:`);

interface LinkRow {
  id: number;
  team_external_id: string;
  position_external_id: string | null;
  team_name: string;
  position_name: string | null;
  sees_all: number;
  department_id: number;
  department_name: string;
  in_default_list: number;
}

const readLinks = (db: D1Database, sourceId: string) =>
  db
    .prepare(
      `SELECT tl.id, tl.team_external_id, tl.position_external_id, tl.team_name, tl.position_name, tl.sees_all,
              c.id AS department_id, c.name AS department_name,
              (c.deleted_at IS NULL AND c.list_id = ${DEFAULT_LIST}) AS in_default_list
         FROM team_links tl JOIN categories c ON c.id = tl.category_id
        WHERE tl.source = ? ORDER BY tl.id`,
    )
    .bind(sourceId)
    .all<LinkRow>();

const toLink = (r: LinkRow): MappingLink => ({
  department: { id: r.department_id, name: r.department_name },
  seesAll: r.sees_all === 1,
  outsideDefaultList: r.in_default_list !== 1,
});

/**
 * The mapping screen: the source's Service Types, the chosen one's teams and positions with their links, links
 * whose team or position has gone from the source, and positions in media teams that lead to no department.
 */
export async function getMapping(db: D1Database, source: ScheduleSource | null): Promise<MappingResponse> {
  const settings = await getSettings(db, ["time_zone"]);
  const timeZone = settings.time_zone ?? "";
  const [listResult, departmentResult] = await db.batch([
    db.prepare(`SELECT id, name FROM task_lists WHERE id = ${DEFAULT_LIST}`),
    db.prepare(`SELECT id, name FROM categories WHERE id IN (${LINKABLE}) ORDER BY sort_order, id`),
  ]);
  const base = {
    list: (listResult.results[0] as { id: number; name: string } | undefined) ?? null,
    departments: departmentResult.results as { id: number; name: string }[],
    timeZone,
  };
  if (!source) {
    return { ...base, source: null, serviceTypes: [], serviceTypeId: null, teams: [], missing: [], unlinked: [], newTeams: [], fetchedAt: null };
  }

  const serviceTypeId = await getServiceTypeId(db, source);
  const [serviceTypes, schedule, { results: links }, { results: marked }] = await Promise.all([
    listServiceTypes(db, source),
    serviceTypeId ? listTeams(db, source, serviceTypeId) : Promise.resolve(null),
    readLinks(db, source.id),
    db.prepare("SELECT team_external_id FROM non_media_teams WHERE source = ?").bind(source.id).all<{ team_external_id: string }>(),
  ]);
  const notMedia = new Set(marked.map((m) => m.team_external_id));
  const linkFor = (team: string, position: string | null) =>
    links.find((l) => l.team_external_id === team && l.position_external_id === position);

  const teams: MappingTeam[] = (schedule?.teams ?? []).map((team) => {
    const teamLink = linkFor(team.externalId, null);
    return {
      externalId: team.externalId,
      name: team.name,
      link: teamLink ? toLink(teamLink) : null,
      isMediaTeam: links.some((l) => l.team_external_id === team.externalId),
      notMediaTeam: notMedia.has(team.externalId),
      positions: team.positions.map((p) => {
        const own = linkFor(team.externalId, p.externalId);
        return { externalId: p.externalId, name: p.name, link: own ? toLink(own) : null, status: own ? "linked" : teamLink ? "team" : "unlinked" };
      }),
    };
  });

  // Gone from the source: only judged once a Service Type is chosen and its teams are known.
  const missing: MissingLink[] = schedule
    ? links
        .filter((l) => {
          const team = schedule.teams.find((t) => t.externalId === l.team_external_id);
          return !team || (l.position_external_id !== null && !team.positions.some((p) => p.externalId === l.position_external_id));
        })
        .map((l) => ({
          teamExternalId: l.team_external_id,
          positionExternalId: l.position_external_id,
          teamName: l.team_name,
          positionName: l.position_name,
          department: { id: l.department_id, name: l.department_name },
        }))
    : [];

  const unlinked = teams
    .filter((t) => t.isMediaTeam)
    .flatMap((t) => t.positions.filter((p) => p.status === "unlinked").map((p) => ({ team: t.name, position: p.name })));

  // New: no links, and not marked "Not a media team". Informational: link them or mark them.
  const newTeams = teams.filter((t) => !t.isMediaTeam && !t.notMediaTeam).map((t) => ({ externalId: t.externalId, name: t.name }));

  return {
    ...base,
    source: { label: source.label },
    serviceTypes: serviceTypes.map(({ externalId, name }) => ({ externalId, name })),
    serviceTypeId,
    teams,
    missing,
    unlinked,
    newTeams,
    fetchedAt: schedule?.fetchedAt ?? null,
  };
}

const LOG_COLUMNS = "action, source, team_external_id, position_external_id, target_name, before_json, after_json, user_id, user_name, session_id, tab_id, user_agent";

/** Binds ?1… then the actor as ?21–?25. */
const bindWithActor = (stmt: D1PreparedStatement, actor: Actor, ...params: unknown[]) =>
  stmt.bind(...params, ...Array(20 - params.length).fill(null), ...actorValues(actor));

/** Sets the Service Type the app follows (logged). False when it was already that one. */
export async function setServiceType(db: D1Database, actor: Actor, source: ScheduleSource, serviceType: SourceServiceType): Promise<boolean> {
  const before = await getServiceTypeId(db, source);
  if (before === serviceType.externalId) return false;
  const beforeName = before ? ((await listServiceTypes(db, source)).find((t) => t.externalId === before)?.name ?? before) : null;
  const upsert = (key: string, value: string) =>
    db
      .prepare(
        `INSERT INTO settings (key, value) SELECT ?1, ?2 WHERE changes() = 1
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      )
      .bind(key, value);
  const [logged] = await db.batch([
    bindWithActor(
      db.prepare(
        `INSERT INTO mapping_events (${LOG_COLUMNS})
         SELECT 'service_type', ?1, NULL, NULL, ?2, json_object('serviceType', ?3), json_object('serviceType', ?2), ?21, ?22, ?23, ?24, ?25
          WHERE (SELECT value FROM settings WHERE key = '${SOURCE_KEY}') IS NOT ?1
             OR (SELECT value FROM settings WHERE key = '${SERVICE_TYPE_KEY}') IS NOT ?4`,
      ),
      actor,
      source.id,
      serviceType.name,
      beforeName,
      serviceType.externalId,
    ),
    upsert(SOURCE_KEY, source.id),
    upsert(SERVICE_TYPE_KEY, serviceType.externalId),
  ]);
  return logged.meta.changes === 1;
}

export interface LinkTarget {
  teamExternalId: string;
  positionExternalId: string | null;
  /** Current names from the source, stored with the link (or the stored ones, for a link that's gone missing). */
  teamName: string;
  positionName: string | null;
}

export type SetLinkResult = "ok" | "unchanged" | "bad_department" | "not_media" | "conflict";

/** The team (?1 source, ?2 team) is marked "Not a media team". */
const MARKED = "EXISTS (SELECT 1 FROM non_media_teams WHERE source = ?1 AND team_external_id = ?2)";

/**
 * Links a team or position to a department (or removes the link, departmentId null), and marks whether people
 * scheduled there see all departments. Logged. "conflict": someone else changed this link meanwhile.
 */
export async function setLink(
  db: D1Database,
  actor: Actor,
  sourceId: string,
  target: LinkTarget,
  departmentId: number | null,
  seesAll: boolean,
): Promise<SetLinkResult> {
  const { teamExternalId: team, positionExternalId: position } = target;
  const existing = await db
    .prepare(
      `SELECT tl.id, tl.category_id, tl.sees_all, c.name AS department_name FROM team_links tl JOIN categories c ON c.id = tl.category_id
        WHERE tl.source = ?1 AND tl.team_external_id = ?2 AND tl.position_external_id IS ?3`,
    )
    .bind(sourceId, team, position)
    .first<{ id: number; category_id: number; sees_all: number; department_name: string }>();
  const name = target.positionName ? `${target.teamName} › ${target.positionName}` : target.teamName;
  const seesAllNow = seesAll && departmentId !== null;
  if (!existing && departmentId === null) return "unchanged";
  if (existing && existing.category_id === departmentId && (existing.sees_all === 1) === seesAllNow) return "unchanged";

  // The link must still be exactly as read: ?6 its id (or NULL for none), ?7/?8 its department and sees_all.
  const asRead = existing
    ? "EXISTS (SELECT 1 FROM team_links WHERE id = ?6 AND category_id = ?7 AND sees_all = ?8)"
    : "NOT EXISTS (SELECT 1 FROM team_links WHERE source = ?1 AND team_external_id = ?2 AND position_external_id IS ?3)";
  const params = [sourceId, team, position, name, departmentId, existing?.id ?? null, existing?.category_id ?? null, existing?.sees_all ?? null, seesAllNow ? 1 : 0, target.teamName, target.positionName];
  const beforeLink = existing ? JSON.stringify({ department: { id: existing.category_id, name: existing.department_name }, seesAll: existing.sees_all === 1 }) : null;

  let statements: D1PreparedStatement[];
  if (departmentId === null) {
    statements = [
      bindWithActor(
        db.prepare(
          `INSERT INTO mapping_events (${LOG_COLUMNS})
           SELECT 'unlink', ?1, ?2, ?3, ?4, ?12, NULL, ?21, ?22, ?23, ?24, ?25 WHERE ${asRead}`,
        ),
        actor,
        ...params,
        beforeLink,
      ),
      db.prepare("DELETE FROM team_links WHERE id = ?1 AND changes() = 1").bind(existing?.id),
    ];
  } else {
    const onlySeesAll = existing?.category_id === departmentId;
    const [before, after] = onlySeesAll
      ? [`json_object('seesAll', json(CASE ?8 WHEN 1 THEN 'true' ELSE 'false' END))`, `json_object('seesAll', json(CASE ?9 WHEN 1 THEN 'true' ELSE 'false' END))`]
      : ["?12", `json_object('department', json_object('id', c.id, 'name', c.name), 'seesAll', json(CASE ?9 WHEN 1 THEN 'true' ELSE 'false' END))`];
    statements = [
      bindWithActor(
        db.prepare(
          `INSERT INTO mapping_events (${LOG_COLUMNS})
           SELECT '${onlySeesAll ? "sees_all" : "link"}', ?1, ?2, ?3, ?4, ${before}, ${after}, ?21, ?22, ?23, ?24, ?25
             FROM categories c WHERE c.id = ?5 AND c.id IN (${LINKABLE}) AND ${asRead} AND NOT ${MARKED}`,
        ),
        actor,
        ...params,
        beforeLink,
      ),
      existing
        ? db
            .prepare("UPDATE team_links SET category_id = ?2, sees_all = ?3, team_name = ?4, position_name = ?5 WHERE id = ?1 AND changes() = 1")
            .bind(existing.id, departmentId, seesAllNow ? 1 : 0, target.teamName, target.positionName)
        : db
            .prepare(
              `INSERT INTO team_links (source, team_external_id, position_external_id, category_id, team_name, position_name, sees_all)
               SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE changes() = 1`,
            )
            .bind(sourceId, team, position, departmentId, target.teamName, target.positionName, seesAllNow ? 1 : 0),
    ];
  }

  const [logged] = await db.batch(statements);
  if (logged.meta.changes === 1) return "ok";
  if (departmentId !== null && (await db.prepare(`SELECT ${MARKED} AS marked`).bind(sourceId, team).first<{ marked: number }>())?.marked) {
    return "not_media";
  }
  if (departmentId !== null && !(await db.prepare(`SELECT 1 FROM categories WHERE id = ? AND id IN (${LINKABLE})`).bind(departmentId).first())) {
    return "bad_department";
  }
  return "conflict";
}

export type TeamReviewResult = "ok" | "unchanged" | "has_links";

/**
 * Marks a team "Not a media team" (so it stops showing as new and can't be linked), or undoes that. Logged. Only a
 * team with no links can be marked: unlink it first.
 */
export async function setNotMediaTeam(
  db: D1Database,
  actor: Actor,
  sourceId: string,
  team: { externalId: string; name: string },
  notMediaTeam: boolean,
): Promise<TeamReviewResult> {
  const marked = await db
    .prepare("SELECT 1 FROM non_media_teams WHERE source = ?1 AND team_external_id = ?2")
    .bind(sourceId, team.externalId)
    .first();
  if (Boolean(marked) === notMediaTeam) return "unchanged";
  const flag = (on: boolean) => JSON.stringify({ notMediaTeam: on });
  // ?1 source, ?2 team, ?3 name, ?4/?5 before/after; the log row carries the guards, the change follows it.
  const guard = notMediaTeam
    ? `NOT ${MARKED} AND NOT EXISTS (SELECT 1 FROM team_links WHERE source = ?1 AND team_external_id = ?2)`
    : MARKED;
  const [logged] = await db.batch([
    bindWithActor(
      db.prepare(
        `INSERT INTO mapping_events (${LOG_COLUMNS})
         SELECT 'not_media', ?1, ?2, NULL, ?3, ?4, ?5, ?21, ?22, ?23, ?24, ?25 WHERE ${guard}`,
      ),
      actor,
      sourceId,
      team.externalId,
      team.name,
      flag(!notMediaTeam),
      flag(notMediaTeam),
    ),
    notMediaTeam
      ? db
          .prepare("INSERT INTO non_media_teams (source, team_external_id, team_name) SELECT ?1, ?2, ?3 WHERE changes() = 1")
          .bind(sourceId, team.externalId, team.name)
      : db.prepare("DELETE FROM non_media_teams WHERE source = ?1 AND team_external_id = ?2 AND changes() = 1").bind(sourceId, team.externalId),
  ]);
  if (logged.meta.changes === 1) return "ok";
  return notMediaTeam ? "has_links" : "unchanged";
}

const EVENTS_PAGE = 500;

/** The mapping log, newest first (Admins only). */
export async function getMappingEvents(db: D1Database): Promise<MappingEditsResponse> {
  const { results } = await db
    .prepare(
      `SELECT id, created_at, action, target_name, before_json, after_json, user_name, session_id, tab_id
         FROM mapping_events ORDER BY id DESC LIMIT ?1`,
    )
    .bind(EVENTS_PAGE + 1)
    .all<{
      id: number;
      created_at: string;
      action: MappingEditEvent["action"];
      target_name: string;
      before_json: string | null;
      after_json: string | null;
      user_name: string;
      session_id: string | null;
      tab_id: string | null;
    }>();
  const parse = (json: string | null) => (json === null ? null : JSON.parse(json));
  return {
    events: results.slice(0, EVENTS_PAGE).map((r) => ({
      id: r.id,
      at: r.created_at,
      action: r.action,
      target: r.target_name,
      before: parse(r.before_json),
      after: parse(r.after_json),
      user: r.user_name,
      sessionId: r.session_id,
      tabId: r.tab_id,
    })),
    truncated: results.length > EVENTS_PAGE,
  };
}
