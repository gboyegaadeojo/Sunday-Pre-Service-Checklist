# Build Plan — Church Media Team Checklist App

> **Based on:** requirements.md v1.11 · **Date:** October 2026
> **Status:** Approved

---

## 1. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | **Cloudflare Workers** (Free plan) | Required (US-18). |
| Database | **Cloudflare D1** (Free plan), accessed only through a Worker binding | Required (US-17, US-18). No database credentials exist that could leak. |
| Server framework | **Hono** (TypeScript) | Small and fast, built for Workers, and keeps CPU time well under the 10 ms limit. Has built-in helpers for cookies, routing and middleware. |
| Front end | **React + Vite**, built into static files | Workers serves static assets for free and without limit, so page loads don't count toward the 100k requests a day. Only `/api/*` calls run the Worker. React handles optimistic check-offs, the 30-second progress refresh and admin reordering cleanly. |
| Local dev | **`@cloudflare/vite-plugin`** | `npm run dev` runs the real Workers runtime (workerd) with a local D1 database, so local behaviour matches production. |
| Styling | **Tailwind CSS** | Dark theme by default, responsive layouts at 375 and 768 px, and easy 44 px tap targets. |
| Database schema | **Plain SQL migrations** using `wrangler d1 migrations` | No ORM dependency. Typed query helpers live in one file. |
| Sessions | HMAC-signed cookie (HttpOnly, Secure, SameSite=Lax, 30-day sliding expiry) built with Web Crypto | No session library needed. Roles are re-read from D1 on every request (US-03). |
| Time zone | `Intl.DateTimeFormat` with the church's time zone from settings (seeded `America/Winnipeg`) | Built into Workers and handles daylight saving (US-07, US-11a). |
| Tests | **Vitest** with `@cloudflare/vitest-pool-workers` | Runs server tests inside the Workers runtime against a real local D1. Covers the risky logic: current service, access rules, team mapping and reset/undo. |
| Planning Center | A `PlanningCenter` interface with two implementations: **Fake** (stages 1–7) and **Real** (stage 8) | Every Planning Center–dependent feature can be built and tested before real credentials exist. The fake can also simulate an outage. |

**Planning Center cache:** this is stored in a D1 table, not the Workers Cache API. The Cache API does nothing on `*.workers.dev` addresses, and that's the default hostname (US-18).

---

## 2. Folder Structure

```
/
├── wrangler.jsonc            # Worker config, D1 binding, static assets (SPA fallback, /api/* hits the Worker)
├── vite.config.ts
├── package.json
├── .dev.vars.example         # Template only. Real .dev.vars is gitignored (US-16)
├── migrations/
│   ├── 0001_schema.sql
│   ├── 0002_seed_ifc_checklist.sql   # Section 6 of requirements (US-14)
│   └── 0003_default_settings.sql     # starting branding, time zone, service weekday (US-11a)
├── src/
│   ├── worker/
│   │   ├── index.ts          # Hono app: mounts routes and middleware
│   │   ├── middleware/       # session loading, role guards (requireAdmin, requireStaff)
│   │   ├── routes/           # auth, dev-auth, checklist, progress, admin-lists, admin-users, admin-mapping
│   │   ├── lib/              # session, time (church time zone), current-service, access, reset
│   │   ├── db/               # typed query helpers
│   │   └── pco/              # PlanningCenter interface, fake.ts, real.ts, cache.ts
│   ├── client/
│   │   ├── main.tsx, App.tsx
│   │   ├── pages/            # SignIn, Checklist, Progress, NoAccess, admin/*
│   │   ├── components/
│   │   └── api.ts            # fetch wrapper for /api/*
│   └── shared/
│       └── types.ts          # API request and response types used by both sides
├── test/                     # Vitest (Workers pool)
└── docs/
    ├── requirements.md
    ├── build-plan.md
    └── deployment.md         # written in stage 9
```

---

## 3. Database Tables

All IDs are integers unless noted. Planning Center IDs are stored as text. Timestamps are ISO 8601 UTC. Service dates are `YYYY-MM-DD` in the church's time zone (a setting).

### Users and settings

**users**
| Column | Notes |
|--------|-------|
| `pco_person_id` TEXT PK | Planning Center person ID (US-03) |
| `display_name`, `avatar_url` | Refreshed at each sign-in |
| `is_admin`, `is_director` | 0/1 flags (US-03) |
| `team_verified_at` | Last time membership in a linked team was confirmed (US-02, US-04a: 90-day rule) |
| `created_at`, `last_seen_at` | |

**settings** — key/value table of church-specific values, all admin-editable (US-11a, US-15): `church_short_name`, `team_name`, `app_name` (branding, public via `GET /api/branding`), `time_zone` (IANA), `service_weekday` (0 = Sunday … 6 = Saturday), and the selected Planning Center Service Type. Starting values come from `0003_default_settings.sql`; code never supplies defaults.

### Checklist definition

Deletes set `deleted_at` instead of removing the row (US-12, US-13).

**task_lists** — `id`, `name`, `description`, `is_default` (only one row can be 1, enforced with a partial unique index), `deleted_at`, `created_at`

**categories** — `id`, `list_id` → task_lists, `name`, `sort_order`, `deleted_at`

**sections** — `id`, `category_id` → categories, `name` (e.g. "Power & Initial System Check"), `sort_order`, `deleted_at`

**tasks** — `id`, `section_id` → sections, `text`, `sort_order`, `deleted_at`

### Services and check-offs

**services** — one row per service (single service per service day, Q4)
| Column | Notes |
|--------|-------|
| `id` | |
| `service_date` UNIQUE | Date in the church's time zone |
| `pco_plan_id` | Null when no plan is published (Q3). Filled in if a plan appears later |
| `list_id` → task_lists | List used for this service (the default list at creation time) |
| `created_at` | |

Rows are created lazily the first time someone opens that service. No scheduled job is needed (US-07).

**checkoffs** — each check is one row. Unchecking updates that row rather than deleting it.
| Column | Notes |
|--------|-------|
| `id`, `service_id`, `task_id` | |
| `task_text_snapshot` | Task text at the moment of check-off (US-06, C8) |
| `category_id_snapshot` → categories, `category_name_snapshot` | Department the task was in when checked (US-13 history rule, C14). The ID groups past records reliably; the name shows the department as it was called then |
| `section_id_snapshot` → sections, `section_name_snapshot` | Section the task was in when checked, likewise |
| `checked_by_pco_id`, `checked_by_name`, `checked_at` | |
| `unchecked_by_pco_id`, `unchecked_by_name`, `unchecked_at` | Null while checked |
| `reset_id` → resets | Set when a reset archives this row |

A check-off is *active* when `unchecked_at IS NULL AND reset_id IS NULL`. A partial unique index on `(service_id, task_id)` for active rows stops two people from double-checking the same task at the same moment.

**Where a check-off is shown.** The *current* service's checklist and progress view place each check-off by its task's current location, joining on `task_id`. So a task moved mid-service stays checked in its new place. *Past* services and service history group check-offs by the snapshot columns, so moves and renames never rewrite history. Past records cover what was checked. Unchecked tasks in a past service aren't stored per service.

**Moves.** A move updates `tasks.section_id` or `sections.category_id` and gives the item the next `sort_order` at the end of its destination. Moves are only allowed to live destinations in the same list. Nothing in the code may assume which department owns a task; the seed is only a starting point.

**Reorder.** Up/down swaps `sort_order` with the nearest *live* sibling, skipping hidden ones. New and moved items take `MAX(sort_order) + 1` over all siblings, hidden ones included, so every item in a parent keeps a distinct `sort_order`.

**Restore (US-13a).** Restore clears `deleted_at`. The row keeps its ID, so its check-offs stay attached, and it keeps its `sort_order`, so it returns between its old neighbours unless they were reordered since. Hiding a department or section doesn't touch its children, so restoring it brings back everything that wasn't hidden on its own. An item is restored only into a live parent. "Restore with parents" clears the hidden ancestors and the item in one transaction. Team links deleted by a department hide are not recreated.

**checklist_events** (Stage 5c, planned): append-only log of checklist edits (US-13b), built like `checkoff_events`.
- Columns: `list_id`, `entity` (category/section/task), `entity_id`, `action` (add/rename/edit/hide/restore/move/reorder), `before_json`, `after_json` (e.g. old and new name or text, old and new parent and position), `user_pco_id`, `user_name`, `session_id`, `tab_id`, `user_agent`, `created_at`.
- Written in the same `db.batch` transaction as the edit. Triggers abort `UPDATE` and `DELETE`. No foreign keys.

**checkoff_events** — append-only activity log (migration `0004`): one row per check or uncheck attempt that reaches the check-off logic.
- Columns: `service_id`, `task_id`, `action` (check/uncheck), `outcome` (applied / no_change / not_found / service_changed), `user_pco_id`, `user_name`, `session_id` (random, fixed at sign-in, kept when the cookie renews), `tab_id` (random per page load, sent as `X-Tab-Id`), `user_agent`, `created_at`.
- Written in the same transaction as the check-off itself.
- Triggers abort any `UPDATE` or `DELETE`, so entries are never edited or removed.
- No foreign keys, so the log outlives anything it mentions.

**resets** — `id`, `service_id`, `reset_by_pco_id`, `reset_by_name`, `reset_at`, `undone_by_pco_id`, `undone_by_name`, `undone_at`. Only the most recent, not-yet-undone reset for a service can be undone (US-07).

### Planning Center

**team_links** (US-15)
| Column | Notes |
|--------|-------|
| `id` | |
| `pco_team_id` | |
| `pco_position_id` | Null means a team-level link |
| `category_id` → categories | |
| `pco_team_name`, `pco_position_name` | Last known names, used only for display and to show "missing" when Planning Center no longer returns the ID |
| `created_at` | |

There's a unique index on `(pco_team_id, IFNULL(pco_position_id, ''))`, so each team or position maps to exactly one category. A category can still have many links.

**pco_cache** — `key` PK, `json`, `expires_at`. Holds short-lived Planning Center responses, a few minutes per service (Architecture Note).

---

## 4. Build Stages

Each stage ends with something you can open at `http://localhost:5173` (via `npm run dev`) and test by hand. The server logic in each stage also gets Vitest tests.

### Stage 1 — Read-only seeded checklist
- Project scaffold (Worker, Vite, React, Tailwind, D1), schema migration and IFC seed migration.
- `GET /api/checklist` returns the default list, and the page shows the 5 departments with their sections and tasks.
- Dark theme, responsive layout and collapsible categories.
- **Test in the browser:** all 5 departments and their sections appear. Check the layout at 375 px and 768 px in devtools, and confirm there's no horizontal scroll.

### Stage 2 — Fake login, sessions and roles
- The sign-in screen looks like the real one: a single "Sign in with Planning Center" button. Roles are worked out after sign-in and never chosen by the user. Locally, the button signs in as the test volunteer.
- A small, clearly labelled developer-only control under the sign-in card switches between test users: Volunteer, Admin, Director, or Not on a media team. It creates the same signed session cookie that real sign-in will use later.
- Fake login can't exist in production. Production builds drop it entirely, from both the Worker and the client code, and a test proves it. Locally it also needs `DEV_AUTH=true` in `.dev.vars`.
- Middleware loads the session and re-reads roles from D1 on every request. The "Not on a media team" user sees the explanation page (US-02), and the header shows the user's name and a sign-out link.
- **Test in the browser:** sign in as each fake user and confirm what each one can see. Delete the cookie and confirm you're sent back to sign-in.

### Stage 3 — Check-offs per service
- Calculate the current service using the `time_zone` and `service_weekday` settings. Stages 3–6 use the next service weekday or today; Planning Center plans come in Stage 7. Show the "No service is published…" note (US-05).
- Tap to check or uncheck with an optimistic update and revert on error. Record who and when, plus snapshots of the task text, department and section (US-06, US-13).
- **Test in the browser:** check tasks as the Volunteer, then sign in as the Admin and see the same ticks with names and times. Stop the dev server mid-tap to see the checkmark revert and the error appear.

### Stage 4 — Progress view, reset and undo
- A progress page for everyone with access (US-09, requirements v1.6): per-category counts, a colour plus a text label, and expandable rows showing who checked each task and when. It auto-refreshes every ~30 seconds and has a "last updated" time and a refresh button (US-09, US-10).
- Reset with a confirmation prompt that archives check-offs, plus "Undo reset" (US-07). These controls show only for Admins and Directors, and the server returns 403 to Volunteers.
- **Activity log for admins:** an Admin-only "Activity" view of `checkoff_events` for the current service. It shows time, person, check or uncheck, task, outcome, and short session and tab IDs, newest first. The server rejects non-admins. If it doesn't fit in Stage 4, it moves to the Stage 5 admin area (see below).
- **Test in the browser:** use two browser profiles, one as Volunteer checking tasks and one as Director watching progress update. Confirm the Volunteer sees progress but no reset controls. Reset, then undo. Call the reset API as the Volunteer and confirm it's rejected.

### Stage 5 — Admin list management
Built in parts, each approved and committed on its own. The server rejects everything in Stage 5 for non-admins, including Directors.

**5a — Editor: add, rename/edit, hide** (done)
- Categories, sections and tasks: add, rename or edit, and hidden delete with a confirmation prompt and warnings (US-12, US-12a, US-13).

**5b — Restructuring and restore**
- **Restructuring (requirements v1.8):**
  - Each task has a "Move to…" menu: choose a department, then a section. It can go to any live section in the list, including other departments.
  - Each section has "Move to…": choose a department, and it moves with all its tasks.
  - Departments, sections and tasks can all be reordered with up/down controls.
  - Everything works on a phone. Desktop drag-and-drop is optional and not planned for the first pass.
  - Moved items go to the end of their destination.
  - The server rejects moves to hidden destinations or another list.
- **Hidden items view (US-13a, requirements v1.11)** at `/admin/checklist/hidden`, linked from the editor: every hidden department, section and task, newest first, with where it was and when it was hidden. Restore brings it back in its old position. Restoring inside a hidden parent explains why and offers to restore the parent too.
- **Test in the browser:**
  - Move a checked task from Audio Engineer to Camera Operators during the current service. It stays checked and counts toward Camera Operators now, while its check-off record still says Audio Engineer.
  - Move a whole section to another department on a 375 px screen.
  - Reorder a department, a section and a task with Move up/Move down.
  - Hide a task, then restore it from Hidden items: it returns to the same place, still checked if it was.
  - Hide a section, then hide its department. Restoring the section offers to restore the department too.

**5c — Checklist edit log (US-13b, requirements v1.11)**
- `checklist_events` (section 3), written in the same transaction as every add, rename, edit, hide, restore, move and reorder, including 5a's and 5b's.
- The Admin Activity view gets a filter: check-offs, checklist edits, or both. Edits show the item and its before and after values.
- **Test in the browser:** rename a task, move it and hide it, then see the three entries with old and new values. Confirm the log rejects `UPDATE` and `DELETE`.

**5d — Lists, settings and service history**
- Lists: create, edit, delete and set the default (US-11).
- Church settings screen (US-11a): time zone (validated IANA name), service weekday, and branding (short name, team name, app name).
- Service history (design.md §7) includes each past service's check-offs and activity log, read-only. Nothing in the admin area can edit or delete log entries.
- **Test in the browser:**
  - Edit a task that's already checked and confirm the service history still shows the old text.
  - Delete a category and confirm it disappears from the checklist but past data still displays.

### Stage 6 — Admin user management
- Users page: grant or revoke Admin and Director (US-03). Revoking takes effect on the user's next page load.
- **Test in the browser:** as Admin, make the fake Volunteer a Director. Reload as that Volunteer and see the reset controls appear.

### Stage 7 — Team mapping and access, with the fake Planning Center
- The Fake Planning Center provides sample Service Types, teams, positions, rosters, plans and schedules, and it can be switched to "down" from the developer-only box on the sign-in page. Its sample data, including the church's real position names (below), lives in a **dev-only data file** under `src/worker/dev/`. Production builds drop it, as with the test users, and the production-build test checks those names are absent. **Nothing is mapped automatically:** admins link every team or position in the mapping screen, with the fake data as with real data.
- Admin mapping screen: pick a Service Type, then link teams or positions to categories. Unlinked items are marked, position links override team links, and items that have gone missing are flagged (US-15).
- Access is based on linked-team membership and the `team_verified_at` stamp (US-02). Scheduled categories are highlighted first, and users who aren't scheduled see a note (US-05).
- Manual department pick is remembered on the device for the day. Fallback banner and 90-day rule when Planning Center is "down" (US-04a). Current service now comes from Planning Center plans (US-07).
- `pco_cache` is used here.
- **Expected mapping** of the church's real Planning Center positions to checklist departments (requirements v1.7). This is for the admins to set up in the app, never hardcoded:

  | Planning Center position | Checklist department |
  |---|---|
  | Audio | Audio Engineer |
  | Camera 1 | Camera Operators |
  | Camera 2 | Camera Operators |
  | Propresenter | Presentation / Computer Graphics |
  | Production Director | Director (Switcher) |
  | Miscellaneous | Miscellaneous |
  | Technical Director | Technical Director |

- **Technical Directors should also be given the app's Director role.** An Admin grants it on the Users page (Stage 6). The mapping above only gives them access and highlights their Technical Director checklist. The Director role adds reset/undo. Roles are never granted automatically from Planning Center (US-03).
- **Test in the browser:** link "Camera 2" to Camera Operators and sign in as a fake Camera 2 volunteer to see it highlighted. Switch Planning Center to "down" and check the banner, the manual pick and the never-verified message.

### Stage 8 — Real Planning Center
- `RealPlanningCenter` uses the church-level token (read-only) for teams, positions, rosters and plans, with a 5-second timeout (US-04a, US-17).
- Planning Center OAuth sign-in: the code exchange happens in the Worker, the volunteer's token is discarded after identifying them, and there are clear error messages when Planning Center is down (US-01, US-04b).
- The sign-in button starts the real Planning Center flow. The developer-only test-user control stays local-only, and production builds already exclude it (Stage 2).
- You'll need: an OAuth app and a church token registered at api.planningcenteronline.com (Q7), stored in `.dev.vars`.
- **Test in the browser:** sign in with your real Planning Center account locally, link real teams and confirm your real schedule is highlighted.

### Stage 9 — Cloudflare deployment
- Create the remote D1 database and run migrations. Set Worker secrets with `wrangler secret put` (US-16). Seed the first admin.
- Connect GitHub so pushes to `main` deploy automatically (US-18).
- Write `docs/deployment.md` covering secrets and how to rotate them, seeding the first admin, the "sign in once during the week" advice (US-04b), D1 backup and point-in-time recovery, and the optional custom domain.
- **Test in the browser:** open the `*.workers.dev` URL on a phone and run a full Sunday walkthrough.

---

## 5. Decisions — Closed

Approved October 2026.

| # | Decision | Effect |
|---|----------|--------|
| D1 | **Sections are editable by admins.** | There is a `sections` table. Admins can add, rename, reorder and delete sections (hidden, not erased), the same way as tasks. Recorded in requirements US-12a. |
| D2 | **Each Planning Center team or position links to only one category.** | Enforced by the unique index on `team_links`. A category can still have many links. Recorded in requirements US-15. |
| D3 | **Newer check-off wins when a reset is undone.** | If a task was checked again after the reset, undo keeps the newer check-off and leaves the archived one archived. Recorded in requirements US-07. |
| D4 | **React front end.** | It's built by Vite into static assets, so page loads don't use Worker requests or CPU time. |
