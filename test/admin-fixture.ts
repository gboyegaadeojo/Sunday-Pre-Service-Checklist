// Shared setup for the admin editor tests: a list of their own (ID 77) made the default, so the seed
// checklist is untouched. Call setUpAdminFixture() at the top of a test file.
import { env } from "cloudflare:test";
import { afterEach, beforeEach } from "vitest";
import type { AdminListResponse, ChecklistResponse } from "../src/shared/types";
import { request, signInAs, withCookie } from "./helpers";

export const LIST = 77;
export const D1 = 7701; // "Dept One": sections 77011 (Alpha, Beta) and 77012 (Gamma); 2 Planning Center links
export const D2 = 7702; // "Dept Two": no sections
export const S_A = 77011;
export const S_B = 77012;
export const T_ALPHA = 770111;
export const T_BETA = 770112;
export const T_GAMMA = 770121;

/** Session cookies, signed in again before each test. */
export const cookies = { admin: "", director: "", volunteer: "" };

const inList = `SELECT id FROM categories WHERE list_id = ${LIST}`;
async function clearList() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM checkoffs"),
    env.DB.prepare("DELETE FROM resets"),
    env.DB.prepare("DELETE FROM services"),
    env.DB.prepare(`DELETE FROM team_links WHERE category_id IN (${inList})`),
    env.DB.prepare(`DELETE FROM tasks WHERE section_id IN (SELECT id FROM sections WHERE category_id IN (${inList}))`),
    env.DB.prepare(`DELETE FROM sections WHERE category_id IN (${inList})`),
    env.DB.prepare(`DELETE FROM categories WHERE list_id = ${LIST}`),
    env.DB.prepare(`DELETE FROM task_lists WHERE id = ${LIST}`),
    env.DB.prepare("UPDATE task_lists SET is_default = 1 WHERE id = 1"),
  ]);
}

export function setUpAdminFixture() {
  beforeEach(async () => {
    await clearList();
    await env.DB.batch([
      env.DB.prepare("UPDATE task_lists SET is_default = 0 WHERE id = 1"),
      env.DB.prepare(`INSERT INTO task_lists (id, name, is_default) VALUES (${LIST}, 'Test list', 1)`),
      env.DB.prepare(
        `INSERT INTO categories (id, list_id, name, sort_order) VALUES (${D1}, ${LIST}, 'Dept One', 1), (${D2}, ${LIST}, 'Dept Two', 2)`,
      ),
      env.DB.prepare(`INSERT INTO sections (id, category_id, name, sort_order) VALUES (${S_A}, ${D1}, 'Sec A', 1), (${S_B}, ${D1}, 'Sec B', 2)`),
      env.DB.prepare(
        `INSERT INTO tasks (id, section_id, text, sort_order) VALUES (${T_ALPHA}, ${S_A}, 'Alpha', 1), (${T_BETA}, ${S_A}, 'Beta', 2), (${T_GAMMA}, ${S_B}, 'Gamma', 1)`,
      ),
      env.DB.prepare(
        `INSERT INTO team_links (pco_team_id, pco_position_id, category_id, pco_team_name) VALUES ('t1', NULL, ${D1}, 'Team 1'), ('t2', 'p1', ${D1}, 'Team 2')`,
      ),
    ]);
    [cookies.admin, cookies.director, cookies.volunteer] = await Promise.all([
      signInAs("admin"),
      signInAs("director"),
      signInAs("volunteer"),
    ]);
  });

  afterEach(clearList);
}

/** Calls /api/admin{path} as the given user, with an optional JSON body. */
export const api = (cookie: string, method: string, path: string, body?: unknown) =>
  request(`/api/admin${path}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
export const adminList = async () => (await (await api(cookies.admin, "GET", "/lists/default")).json()) as AdminListResponse;
export const checklist = async () => (await request("/api/checklist", withCookie(cookies.volunteer))).json<ChecklistResponse>();
export const names = (l: { categories: { name: string }[] }) => l.categories.map((c) => c.name);
