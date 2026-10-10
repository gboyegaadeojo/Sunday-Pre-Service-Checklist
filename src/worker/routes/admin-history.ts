import { Hono } from "hono";
import type { ApiErrorBody, HistoryResponse, ServiceHistoryResponse } from "../../shared/types";
import { getServiceHistory, getServiceRecord } from "../db/history";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../types";

// Service history (Stage 5d.3, design.md §7, US-07). Admins only, enforced here. Read-only.
//   GET /api/admin/history              past services, newest first (the current one is left out)
//   GET /api/admin/history/:serviceId   one service: what was checked (snapshots) and its resets
// A service's activity log is GET /api/services/:serviceId/events (routes/events.ts).
export const adminHistoryRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
  .get("/", async (c) => c.json<HistoryResponse>(await getServiceHistory(c.env.DB, new Date())))
  .get("/:serviceId", async (c) => {
    const serviceId = Number(c.req.param("serviceId"));
    const record = Number.isInteger(serviceId) ? await getServiceRecord(c.env.DB, serviceId, new Date()) : null;
    if (!record) return c.json<ApiErrorBody>({ error: "Not found" }, 404);
    return c.json<ServiceHistoryResponse>(record);
  });
