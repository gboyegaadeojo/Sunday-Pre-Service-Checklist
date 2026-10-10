import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

// Schema guarantees that later stages rely on. Uses seed rows: task 1 is in section 1 of category 1.

const USER = 9001; // an app user created here, so check-offs can refer to it (US-03a)

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM checkoffs"),
    env.DB.prepare("DELETE FROM services"),
    env.DB.prepare("INSERT INTO services (id, service_date, list_id) VALUES (1, '2026-10-11', 1)"),
    env.DB.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES (?, 'Test Volunteer')").bind(USER),
  ]);
});

const insertCheckoff = (snapshot: {
  categoryId?: number;
  categoryName?: string;
  sectionId?: number;
  sectionName?: string;
  userId?: number;
}) =>
  env.DB.prepare(
    `INSERT INTO checkoffs (service_id, task_id, task_text_snapshot, category_id_snapshot, category_name_snapshot,
                            section_id_snapshot, section_name_snapshot, checked_by_user_id, checked_by_name)
     VALUES (1, 1, 'Verify power', ?1, ?2, ?3, ?4, ?5, 'Test Volunteer')`,
  )
    .bind(
      snapshot.categoryId ?? null,
      snapshot.categoryName ?? null,
      snapshot.sectionId ?? null,
      snapshot.sectionName ?? null,
      snapshot.userId ?? USER,
    )
    .run();

describe("app users (US-03a)", () => {
  const full = { categoryId: 1, categoryName: "Presentation", sectionId: 1, sectionName: "Power" };

  it("refers check-offs to an existing app user", async () => {
    await expect(insertCheckoff({ ...full, userId: 999999 })).rejects.toThrow(/FOREIGN KEY/);
    await expect(insertCheckoff(full)).resolves.toBeTruthy();
  });

  it("links each sign-in account to exactly one user; a user may link several", async () => {
    const link = (userId: number, provider: string) =>
      env.DB.prepare("INSERT INTO user_identities (user_id, provider, subject) VALUES (?, ?, 'p-1')").bind(userId, provider).run();
    await env.DB.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES (9002, 'Someone else')").run();
    await link(USER, "planning_center");
    await expect(link(9002, "planning_center")).rejects.toThrow(/UNIQUE/);
    await link(USER, "google");
    await env.DB.prepare("DELETE FROM user_identities WHERE user_id IN (?, 9002)").bind(USER).run();
  });
});

describe("checkoffs snapshots (US-06, US-13)", () => {
  it("requires the department and section snapshot", async () => {
    await expect(insertCheckoff({ sectionId: 1, sectionName: "Power" })).rejects.toThrow(/NOT NULL/);
    await expect(insertCheckoff({ categoryId: 1, categoryName: "Presentation" })).rejects.toThrow(/NOT NULL/);
  });

  it("keeps the snapshot when the task is later moved to another department", async () => {
    await insertCheckoff({ categoryId: 1, categoryName: "Presentation / Computer Graphics", sectionId: 1, sectionName: "Power & Initial System Check" });

    // Admin moves task 1 into a section of Audio Engineer (category 2).
    const audioSection = await env.DB.prepare("SELECT id FROM sections WHERE category_id = 2 ORDER BY sort_order LIMIT 1").first<{ id: number }>();
    await env.DB.prepare("UPDATE tasks SET section_id = ? WHERE id = 1").bind(audioSection?.id).run();

    const row = await env.DB.prepare(
      `SELECT c.category_name_snapshot, c.section_name_snapshot, s.category_id AS current_category_id
         FROM checkoffs c JOIN tasks t ON t.id = c.task_id JOIN sections s ON s.id = t.section_id`,
    ).first();
    expect(row).toEqual({
      category_name_snapshot: "Presentation / Computer Graphics",
      section_name_snapshot: "Power & Initial System Check",
      current_category_id: 2,
    });

    await env.DB.prepare("UPDATE tasks SET section_id = 1 WHERE id = 1").run();
  });
});
