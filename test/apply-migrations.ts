import { applyD1Migrations, env } from "cloudflare:test";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Team mapping set up (US-02): until it is, only Admins and Directors get in. Every test file starts with a minimal
// mapping: the fake source's Service Type, and its Production team (the test volunteer's team in the fake rosters)
// linked to the seed checklist's last department, so the test volunteer is let in. Tests about mapping itself clear it.
await env.DB.batch([
  env.DB.prepare("INSERT INTO settings (key, value) VALUES ('schedule_source', 'fake'), ('schedule_service_type', 'st-sunday')"),
  env.DB.prepare(
    `INSERT INTO team_links (source, team_external_id, category_id, team_name)
     SELECT 'fake', 'team-production', id, 'Production' FROM categories WHERE list_id = 1 ORDER BY sort_order DESC LIMIT 1`,
  ),
]);
