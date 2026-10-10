import { Hono } from "hono";
import type { Context } from "hono";
import type {
  ApiErrorBody,
  MappingEditsResponse,
  MappingResponse,
  MappingStatusResponse,
  SetLinkRequest,
  SetServiceTypeRequest,
  SetTeamReviewRequest,
} from "../../shared/types";
import {
  type LinkTarget,
  getMapping,
  getMappingEvents,
  getServiceTypeId,
  listServiceTypes,
  listTeams,
  refreshSchedule,
  setLink,
  setNotMediaTeam,
  setServiceType,
} from "../db/mapping";
import { actorFor } from "../lib/actor";
import { requireAdmin } from "../middleware/auth";
import { ProviderUnavailableError } from "../sources/identity";
import type { AppEnv } from "../types";

// Team mapping (Stage 7a, US-15). Admins only, enforced here.
//   GET  /api/admin/mapping                the screen: Service Types, teams and positions with links, missing, unlinked
//   GET  /api/admin/mapping/status         unlinked and missing counts, for the notice on the Admin tabs
//   POST /api/admin/mapping/refresh        "Refresh from Planning Center": fetch everything anew, then as GET
//   PUT  /api/admin/mapping/service-type   { externalId }  the Service Type the app follows
//   PUT  /api/admin/mapping/link           { teamExternalId, positionExternalId, departmentId, seesAll }  null department unlinks
//   PUT  /api/admin/mapping/team-review    { teamExternalId, notMediaTeam }  mark a team with no links "Not a media team", or undo
//   GET  /api/admin/mapping/events         the append-only mapping log, newest first
// Nothing is linked automatically. Changes are logged; links use the source's IDs, never names.

const notConnected = (c: Context<AppEnv>) =>
  c.json<ApiErrorBody>({ error: "Planning Center isn't connected yet, so there's nothing to link." }, 409);

/** The source couldn't be reached: say so, without blocking anything else in the app (US-04a). */
async function guardSource<T>(c: Context<AppEnv>, run: () => Promise<T>): Promise<T | Response> {
  try {
    return await run();
  } catch (err) {
    if (!(err instanceof ProviderUnavailableError)) throw err;
    const label = c.var.schedule?.label ?? "the schedule source";
    return c.json<ApiErrorBody>({ error: `Couldn't reach ${label}. Links already made keep working; try again in a few minutes.` }, 503);
  }
}

export const adminMappingRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
  .get("/", (c) => guardSource(c, async () => c.json<MappingResponse>(await getMapping(c.env.DB, c.var.schedule))))
  .get("/status", (c) =>
    guardSource(c, async () => {
      const mapping = await getMapping(c.env.DB, c.var.schedule);
      return c.json<MappingStatusResponse>({ unlinked: mapping.unlinked.length, missing: mapping.missing.length, newTeams: mapping.newTeams.length });
    }),
  )
  .get("/events", async (c) => c.json<MappingEditsResponse>(await getMappingEvents(c.env.DB)))
  .post("/refresh", (c) =>
    guardSource(c, async () => {
      const source = c.var.schedule;
      if (!source) return notConnected(c);
      await refreshSchedule(c.env.DB, source);
      return c.json<MappingResponse>(await getMapping(c.env.DB, source));
    }),
  )
  .put("/service-type", (c) =>
    guardSource(c, async () => {
      const source = c.var.schedule;
      if (!source) return notConnected(c);
      const body = (await c.req.json().catch(() => null)) as Partial<SetServiceTypeRequest> | null;
      const serviceType = (await listServiceTypes(c.env.DB, source)).find((t) => t.externalId === body?.externalId);
      if (!serviceType) return c.json<ApiErrorBody>({ error: "Choose a Service Type from the list." }, 400);
      await setServiceType(c.env.DB, actorFor(c), source, serviceType);
      return c.body(null, 204);
    }),
  )
  .put("/link", (c) =>
    guardSource(c, async () => {
      const source = c.var.schedule;
      if (!source) return notConnected(c);
      const body = (await c.req.json().catch(() => null)) as Partial<SetLinkRequest> | null;
      const departmentId = body?.departmentId;
      if (
        typeof body?.teamExternalId !== "string" ||
        (body.positionExternalId !== null && typeof body.positionExternalId !== "string") ||
        (departmentId !== null && !Number.isInteger(departmentId)) ||
        typeof body.seesAll !== "boolean"
      ) {
        return c.json<ApiErrorBody>({ error: "Send teamExternalId, positionExternalId, departmentId and seesAll." }, 400);
      }

      // The team or position must be in the source now, except when removing a link to one that's gone missing.
      const serviceTypeId = await getServiceTypeId(c.env.DB, source);
      const teams = serviceTypeId ? (await listTeams(c.env.DB, source, serviceTypeId)).teams : [];
      const team = teams.find((t) => t.externalId === body.teamExternalId);
      const position = body.positionExternalId === null ? null : team?.positions.find((p) => p.externalId === body.positionExternalId);
      let target: LinkTarget | null =
        team && (body.positionExternalId === null || position)
          ? { teamExternalId: team.externalId, positionExternalId: position?.externalId ?? null, teamName: team.name, positionName: position?.name ?? null }
          : null;
      if (!target && departmentId === null) {
        const stored = await c.env.DB.prepare(
          "SELECT team_name, position_name FROM team_links WHERE source = ?1 AND team_external_id = ?2 AND position_external_id IS ?3",
        )
          .bind(source.id, body.teamExternalId, body.positionExternalId)
          .first<{ team_name: string; position_name: string | null }>();
        if (stored) {
          target = { teamExternalId: body.teamExternalId, positionExternalId: body.positionExternalId, teamName: stored.team_name, positionName: stored.position_name };
        }
      }
      if (!target) return c.json<ApiErrorBody>({ error: "That team or position isn't in the schedule any more. Refresh and try again." }, 404);

      const result = await setLink(c.env.DB, actorFor(c), source.id, target, departmentId ?? null, body.seesAll);
      if (result === "bad_department") return c.json<ApiErrorBody>({ error: "Choose a department from the default list." }, 400);
      if (result === "not_media") {
        return c.json<ApiErrorBody>({ error: "This team is marked “Not a media team”. Undo that first to link it." }, 409);
      }
      if (result === "conflict") return c.json<ApiErrorBody>({ error: "This link was just changed by someone else. Showing the latest." }, 409);
      return c.body(null, 204);
    }),
  )
  .put("/team-review", (c) =>
    guardSource(c, async () => {
      const source = c.var.schedule;
      if (!source) return notConnected(c);
      const body = (await c.req.json().catch(() => null)) as Partial<SetTeamReviewRequest> | null;
      if (typeof body?.teamExternalId !== "string" || typeof body.notMediaTeam !== "boolean") {
        return c.json<ApiErrorBody>({ error: "Send teamExternalId and notMediaTeam." }, 400);
      }
      const serviceTypeId = await getServiceTypeId(c.env.DB, source);
      const team = serviceTypeId ? (await listTeams(c.env.DB, source, serviceTypeId)).teams.find((t) => t.externalId === body.teamExternalId) : undefined;
      if (!team) return c.json<ApiErrorBody>({ error: "That team isn't in the schedule any more. Refresh and try again." }, 404);
      const result = await setNotMediaTeam(c.env.DB, actorFor(c), source.id, team, body.notMediaTeam);
      if (result === "has_links") {
        return c.json<ApiErrorBody>({ error: "This team has links, so it's a media team. Remove its links first." }, 409);
      }
      return c.body(null, 204);
    }),
  );
