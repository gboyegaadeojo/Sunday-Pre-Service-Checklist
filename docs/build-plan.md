# Build Plan — Church Media Team Checklist App

> **Based on:** requirements.md v1.13 · **Date:** October 2026
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
| Sign-in and scheduling sources | Two interfaces (requirements C22): **`IdentityProvider`** for sign-in (Dev test users now, Planning Center OAuth in stage 8) and **`ScheduleSource`** for service types, teams, positions, membership and plans (**Fake** in stage 7, **Planning Center** in stage 8) | Planning Center becomes replaceable: nothing outside `src/worker/sources/` knows about it. Every source-dependent feature can be built and tested before real credentials exist, and the fake can simulate an outage. |

**Source cache:** short-lived schedule-source responses are stored in a D1 table, not the Workers Cache API. The Cache API does nothing on `*.workers.dev` addresses, and that's the default hostname (US-18).

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
│   ├── 0003_default_settings.sql     # starting branding, time zone, service weekday (US-11a)
│   ├── 0004–0006                     # check-off log, checklist edit log, settings log (append-only)
│   ├── 0007_service_tasks.sql        # the record of each service's checklist (US-07b)
│   ├── 0008_role_events.sql          # role change log (append-only, Stage 6)
│   ├── 0009_keep_an_admin.sql        # trigger: never zero Admins (US-03)
│   ├── 0010_team_mapping.sql         # team_links.sees_all, mapping log, dev_state (Stage 7a)
│   └── 0011_team_reviews.sql         # non_media_teams; mapping log gains 'not_media'
├── src/
│   ├── worker/
│   │   ├── index.ts          # Hono app: mounts routes and middleware
│   │   ├── middleware/       # session loading, role guards (requireAdmin, requireStaff)
│   │   ├── routes/           # auth, dev-auth, checklist, progress, admin-lists, admin-users, admin-mapping
│   │   ├── lib/              # session, time (church time zone), current-service, access, reset
│   │   ├── db/               # typed query helpers
│   │   └── sources/          # IdentityProvider and ScheduleSource interfaces; dev/, fake/, planning-center/ implementations; cache.ts
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

All IDs are integers unless noted. IDs from outside sources (e.g. Planning Center) are stored as text, next to the source's name. Timestamps are ISO 8601 UTC. Service dates are `YYYY-MM-DD` in the church's time zone (a setting).

### Users and settings

**users** — the app's own accounts (US-03a)
| Column | Notes |
|--------|-------|
| `id` INTEGER PK AUTOINCREMENT | Internal user ID: never changes, never reused. Everything else refers to this |
| `display_name`, `avatar_url` | Refreshed at each sign-in |
| `is_admin`, `is_director` | 0/1 flags (US-03) |
| `team_verified_at` | Last time membership in a linked team was confirmed (US-02, US-04a: 90-day rule) |
| `created_at`, `last_seen_at` | |

**user_identities** — sign-in accounts linked to a user (US-03a)
| Column | Notes |
|--------|-------|
| `id` | |
| `user_id` → users | |
| `provider` | `planning_center` now, `dev` for local test users; later possibly `google` |
| `subject` TEXT | The provider's ID for this person (e.g. Planning Center person ID) |
| `email` | Nullable; for later invite/approval flows |
| `created_at`, `last_used_at` | |

A unique index on `(provider, subject)` links each sign-in account to exactly one user; a user may have several. Sign-in finds the identity, or creates the user and the identity together in one batch. A Planning Center person ID lives only here (used for schedule lookups) and never reaches the browser.

**settings** — key/value table of church-specific values, all admin-editable (US-11a, US-15): `church_short_name`, `team_name`, `app_name` (branding, public via `GET /api/branding`), `time_zone` (IANA), `service_weekday` (0 = Sunday … 6 = Saturday), the schedule source (`schedule_source`, e.g. `planning_center`), and that source's selected service type. Starting values come from `0003_default_settings.sql`; code never supplies defaults.

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
| `plan_source`, `plan_external_id` | The schedule source's plan for this service. Null when no plan is published (Q3). Filled in if a plan appears later |
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
| `checked_by_user_id` → users, `checked_by_name`, `checked_at` | Internal user ID (US-03a), and the name as it was then |
| `unchecked_by_user_id` → users, `unchecked_by_name`, `unchecked_at` | Null while checked |
| `reset_id` → resets | Set when a reset archives this row |

A check-off is *active* when `unchecked_at IS NULL AND reset_id IS NULL`. A partial unique index on `(service_id, task_id)` for active rows stops two people from double-checking the same task at the same moment.

**Where a check-off is shown.** The *current* service's checklist and progress view place each check-off by its task's current location, joining on `task_id`. So a task moved mid-service stays checked in its new place. *Past* services and service history group check-offs by the snapshot columns, so moves and renames never rewrite history. Past records cover what was checked. Unchecked tasks in a past service aren't stored per service.

**Moves.** A move updates `tasks.section_id` or `sections.category_id` and gives the item the next `sort_order` at the end of its destination. Moves are only allowed to live destinations in the same list. Nothing in the code may assume which department owns a task; the seed is only a starting point.

**Reorder.** Up/down swaps `sort_order` with the nearest *live* sibling, skipping hidden ones. New and moved items take `MAX(sort_order) + 1` over all siblings, hidden ones included, so every item in a parent keeps a distinct `sort_order`.

**Restore (US-13a).** Restore clears `deleted_at`. The row keeps its ID, so its check-offs stay attached, and it keeps its `sort_order`, so it returns between its old neighbours unless they were reordered since. Hiding a department or section doesn't touch its children, so restoring it brings back everything that wasn't hidden on its own. An item is restored only into a live parent. "Restore with parents" clears the hidden ancestors and the item in one transaction. Team links deleted by a department hide are not recreated.

**checklist_events** (migration `0005`, Stage 5c): append-only log of checklist edits (US-13b), built like `checkoff_events`.
- Columns: `list_id`, `entity` (category/section/task), `entity_id`, `entity_name` (its name or text after the change, so the entry reads correctly after later renames), `action` (add/rename/edit/hide/restore/move/reorder), `before_json`, `after_json`, `user_id` (internal), `user_name`, `session_id`, `tab_id`, `user_agent`, `created_at`.
- `before_json`/`after_json` hold only what changed: `name` or `text`; `place` (department, section and 1-based position among live siblings) for add, move and reorder; `teamLinks` removed by hiding a department.
- Written in the same `db.batch` transaction as the edit. Triggers abort `UPDATE` and `DELETE`. No foreign keys.

**service_tasks** (migration `0007`, Stage 5d.4, US-07b): the record of each service's checklist. One row per service and task: `text`, `category_id`/`category_name`/`category_order`, `section_id`/`section_name`/`section_order`, `task_order` (as at the end of the service, or when removed), `added_at`, `removed_at` (hidden during the service; NULL = on the checklist). `services.tasks_recorded_from` says when recording started (NULL = no record: services from before `0007`). Triggers refuse inserts and updates once a service is more than a day past in UTC (a safety net; SQL can't know the church's time zone). Rows cascade-delete with their service or task, which only tests do.

**role_events** (migration `0008`, Stage 6): append-only log of Admin and Director changes (US-03). Columns: `target_user_id`/`target_name` (whose roles changed, name at the time), `before_json`, `after_json` (only the roles that changed, e.g. `{"isDirector": false}`), then the actor columns as in `settings_events`. Same transaction and triggers as the other logs.

**team_links.sees_all** (migration `0010`, Stage 7a): people scheduled in that team or position see all departments by default (US-05).

**mapping_events** (migration `0010`, Stage 7a): append-only log of mapping changes: `action` (link, unlink, sees_all, service_type), `source`, `team_external_id`, `position_external_id`, `target_name` ("Team › Position" at the time), `before_json`/`after_json`, then the actor columns. Same transaction and triggers as the other logs.

**non_media_teams** (migration `0011`, Stage 7a): teams an Admin marked "Not a media team" (`source`, `team_external_id`, `team_name`, `marked_at`). 0011 also rebuilds `mapping_events` to allow the `not_media` action, keeping its rows and triggers.

**dev_state** (migration `0010`): local development only. The fake schedule source's adjustments (positions added, renamed, removed; "down" in 7c). Production code never reads or writes it.

**settings_events** (migration `0006`, Stage 5d.2): append-only log of church settings changes (US-11a). Columns: `before_json`, `after_json` (only the fields that changed, e.g. `{"serviceWeekday": 0}`), `user_id` (internal), `user_name`, `session_id`, `tab_id`, `user_agent`, `created_at`. Same transaction and triggers as the other logs.

**checkoff_events** — append-only activity log (migration `0004`): one row per check or uncheck attempt that reaches the check-off logic.
- Columns: `service_id`, `task_id`, `action` (check/uncheck), `outcome` (applied / no_change / not_found / service_changed), `user_id` (internal), `user_name`, `session_id` (random, fixed at sign-in, kept when the cookie renews), `tab_id` (random per page load, sent as `X-Tab-Id`), `user_agent`, `created_at`.
- Written in the same transaction as the check-off itself.
- Triggers abort any `UPDATE` or `DELETE`, so entries are never edited or removed.
- No foreign keys, so the log outlives anything it mentions.

**resets** — `id`, `service_id`, `reset_by_user_id`, `reset_by_name`, `reset_at`, `undone_by_user_id`, `undone_by_name`, `undone_at`. Only the most recent, not-yet-undone reset for a service can be undone (US-07).

### Schedule source (Planning Center today)

Column names are provider-neutral (requirements C22). `source` names where an outside ID comes from (`planning_center` today).

**team_links** (US-15)
| Column | Notes |
|--------|-------|
| `id` | |
| `source` | e.g. `planning_center` |
| `team_external_id` | |
| `position_external_id` | Null means a team-level link |
| `category_id` → categories | |
| `team_name`, `position_name` | Last known names, used only for display and to show "missing" when the source no longer returns the ID |
| `sees_all` | 0/1. People scheduled in this team or position see every department by default, e.g. Technical Director (US-05, requirements C24). Added in Stage 7 |
| `created_at` | |

There's a unique index on `(source, team_external_id, IFNULL(position_external_id, ''))`, so each team or position maps to exactly one category. A category can still have many links.

**source_cache** — `key` PK, `json`, `expires_at`. Holds short-lived schedule-source responses, a few minutes per service (Architecture Note).

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
- Only changes that were applied are logged. A refused edit (hidden item, wrong list) changed nothing, so it has no before and after.
- The log row is written first, inside the batch, and the edit runs only if it was written (`changes() = 1`). So the before values are read in the same transaction as the change, and one never happens without the other.
- Restoring with parents logs one `restore` per item brought back. Hiding a department records the Planning Center links it removed, so they can be linked again.
- `GET /api/admin/lists/:listId/edits` returns the latest edits, newest first (Admins only).
- The Admin Activity view gets a filter: All, Check-offs (current service, as before) or Checklist edits. Edits show the item, who, when, and the before and after values.
- **Test in the browser:** rename a task, move it and hide it, then see the three entries with old and new values. Confirm the log rejects `UPDATE` and `DELETE`.

**5c.1 — App user IDs and provider-neutral schema (requirements v1.12: US-03a, C22)**
- `users` gets an internal `id`; sign-in accounts move to `user_identities` (section 3). The session token's `sub` becomes the internal ID, so existing local sessions sign in again once.
- Check-offs, resets, `checkoff_events` and `checklist_events` store `*_user_id` (internal) instead of `*_pco_id`. `CurrentUser.id` sent to the browser becomes the internal ID.
- Test sign-in becomes the first `IdentityProvider` (`dev`, subject = test-user key). Sign-in goes through one function: find the identity, or create user and identity together. Roles are still never overwritten at sign-in.
- Provider-neutral names for the not-yet-used Planning Center tables and columns: `team_links` (`source`, `team_external_id`, …), `services.plan_source`/`plan_external_id`, `source_cache`.
- `src/worker/sources/` holds the `IdentityProvider` and `ScheduleSource` interfaces (types only until Stage 7). Planning Center wording in the UI stays where it describes today's setup (the sign-in button, "No service is published in Planning Center"). In Stage 8 the sign-in screen gets its button label from the server's provider list, and the schedule-source wording follows the configured source.
- **Migration approach (to confirm):** nothing is deployed yet, so the recommended option rewrites `0001`, `0004` and `0005` in place and resets local databases once. That gives a clean schema, and the append-only logs are never rewritten. The alternative is a new `0006` that rebuilds the affected tables and keeps local data, but it has to drop and recreate the log triggers to copy the log rows.
- **Test in the browser:** sign in as each test user and confirm roles, check-offs, reset/undo and both logs work as before. The Activity view shows the same names.

**5c.2 — Reorder mode (small follow-up)**
- A "Reorder" toggle in the editor shows up/down arrow buttons (44 px) on every department, section and task row, so several moves don't need the ⋯ menu each time. While it's on, the arrows take the place of the ⋯ menus and the "Add …" buttons are hidden, so rows stay readable at 375 px. A sticky bar with Done stays in view. Outside Reorder mode the ⋯ menu's Move up/Move down stay.
- Focus stays on the moved item's arrow (its other arrow once it reaches an end), and a tap while the previous move is saving is ignored.
- Same server endpoints as 5b, and reorders are logged as in 5c.
- **Test in the browser:** at 375 px, turn on Reorder and move a task down three places with the arrows. Then turn it off.

**5d — Lists, settings and service history**, built, shown and committed one part at a time.

**5d.1 — Task lists (US-11, requirements v1.13)**
- Admin › Lists (`/admin/lists`): the default first, with which list the current service uses; New list (empty, or a copy of a live list); Rename or describe; Make default; Copy to a new list; Hide; Hidden lists with Restore.
- The editor and Hidden items work on any list: `/admin/checklist?list=ID` (no `list` = the default list).
- **Copy** is three set-based `INSERT … SELECT`s (departments, sections, tasks), matching parents by `sort_order`, so it stays within D1 Free's 50 queries per request whatever the list's size. The new list's ID is chosen first so every statement in the batch refers to it.
- **Make default** clears the old default and sets the new one in one batch. With "Also use it for this service", the current service switches too, only while it has no check-offs at all.
- **Hide** is refused for the default list and for the current service's list.
- **Unique names** among visible lists, ignoring capitalization and extra spaces (requirements C25). Names are stored with spaces collapsed, and the check is repeated inside the write, so two admins can't take the same name at once. Restoring a hidden list is refused while a visible list has its name. "Copy to a new list" suggests a free name ("… (copy 2)").
- Every list change is logged in `checklist_events` (entity `list`, action `set_default` added). The Activity feed now covers all lists (`GET /api/admin/edits`) and names the list when there's more than one.
- **Test in the browser:** copy the regular list to "Christmas Eve", edit the copy and confirm the original is unchanged; make it the default with "Also use it for this service"; check that the default list can't be hidden; hide and restore a list; see each change in Activity.

**5d.2 — Church settings (US-11a)**
- **Settings** (`/settings`), opened from the menu under the user's name in the header, above Sign out. Only Admins see the menu item; anyone else who reaches the address sees "Admins only", and the server refuses them. The page has no Admin tabs. The old `/admin/settings` address redirects to `/settings`.
- The page has the time zone (a list of IANA names grouped by region, with the current time there), service weekday, and branding (short name up to 8 characters, team name and app name up to 60; empty fields are left out of the display), with a live preview of the header and tab title. One Save for the whole form; Discard changes.
- `PUT /api/admin/settings` saves only what changed. The time zone must be an IANA name (offsets like `+05:00` are refused, since they ignore daylight saving).
- **Logged** in a new append-only `settings_events` table (migration `0006`, so local data is kept): who, when, and the before/after values of only the fields that changed, in the same transaction. Admin › Activity gets a **Settings** filter.
- **Moving the current service:** a time zone or weekday change that changes the current service's date is confirmed first. The dialog names the old and new dates and how many tasks are checked on the old one; those stay with that date (and come back if the setting is changed back). The calendar maths moved to `src/shared/service-day.ts` so the screen previews the new date.
- After a branding change the header and tab title update straight away; other people see it on their next page load.
- **Test in the browser:** open Settings from the user menu; change the team name and see the preview, header and tab title follow; clear the short name; change the service day and confirm the move (the checklist shows the new date); see the three entries under Activity › Settings; confirm a Director has no Settings item, gets 403 and sees "Admins only" at `/settings`; confirm `/admin/settings` lands on `/settings`.

**5d.3 — Service history (design.md §7)**
- Admin › **History** (`/admin/history`): every service except the current one, newest first, with its list (marked if since hidden), how many tasks were checked and how many times it was reset. `GET /api/admin/history`, Admins only.
- Each service (`/admin/history?service=ID`, `GET /api/admin/history/:id`) shows, read-only:
  - the tasks still checked at the end, grouped by the department and section **snapshots** (text, department and section as at check-off time), so later edits, moves and hides never change them. Departments and sections keep their current order, hidden ones included.
  - every reset, with who, when, how many check-offs it cleared, and any undo.
  - its activity log (`GET /api/services/:id/events`). For a past service, task text comes from the check-off snapshot, not today's text.
- No "X of Y" totals: the app doesn't record which tasks a past service's checklist held, so only what was checked is shown (design.md preface: no made-up numbers).
- Nothing in the admin area can edit or delete history or log entries.
- **Test in the browser:**
  - Edit a task that's already checked and confirm the service history still shows the old text.
  - Delete a category and confirm it disappears from the checklist but past data still displays.
  - Move a checked task to another section and confirm the past service still shows it where it was.
  - Confirm a Director has no History tab and gets 403 / "Admins only".

**5d.4 — A record of each service's checklist (US-07b, requirements v1.16)**
- **When:** the record starts the first time a service loads (`getCurrentService`): every live task in its list. Every checklist edit (add, rename, edit, move, reorder, hide, restore) then reconciles the *current* service's record with the live list in the same `db.batch`, after the edit and its log entry: new and changed tasks are upserted (only rows that changed are written), and tasks no longer live are marked `removed_at`; a restored task comes back. Switching the current service's list (5d.1) starts the record over.
- **Freeze:** after midnight in the church's time zone the service isn't current, so no edit reaches its record; nothing runs at midnight (no Cron Trigger). "During the service" means the whole time the service is current, so Saturday prep counts.
- **History:** "X of Y done" overall and per department, every task where it was at the end, checked or not ("checked as '…'" when its text changed afterwards); tasks removed during the service listed apart and not counted. Services without a record keep the 5d.3 view. The service current when this ships records from that moment and is marked as such.
- **Test in the browser:** check a task, add a task, hide another, then end the service (local SQL: set its date in the past) and confirm history shows X of Y, the unchecked tasks and the removed one; edit the list afterwards and confirm the past service doesn't change.

### Stage 6 — Admin user management
- Admin › **Users** (`/admin/users`): everyone who has signed in, by name, with a search box. Each shows what they can do (Admin, Director, Volunteer, or "No access: not on a media team"), when they were last seen, and Admin and Director switches. No sign-in provider IDs are sent (US-03a).
- `PUT /api/admin/users/:id/roles` `{ isAdmin, isDirector }` saves only what changed. Takes effect on that person's next request (roles are re-read every time). Giving someone a role also gives them access (US-02).
- **Never without an Admin** (requirements v1.17): removing Admin from the last Admin is refused (409 `last_admin`, "You can't remove the last Admin. Make someone else an Admin first."); the screen disables that switch and says why. The role change's own guard does this, and a trigger on `users` (migration `0009`) makes it impossible however the change is attempted. D1 runs writes one at a time, so two Admins removing each other at the same moment can't both succeed. An Admin removing their own Admin role always confirms first, even with other Admins, then leaves the Admin area.
- **Logged** in a new append-only `role_events` table (migration `0008`), in the same transaction, guarded so a change made meanwhile by someone else is refused (409) rather than overwritten. Activity gets a **Roles** filter.
- **Test in the browser:** as Admin, make the fake Volunteer a Director. Reload as that Volunteer and see the reset controls appear. Try to remove the only Admin; see the change under Activity › Roles; confirm a Director has no Users tab and gets 403.

### Stage 7 — Team mapping and access, with the fake schedule source
Built, shown and committed in parts: **7a** the fake schedule source and the mapping screen, **7b** access and the department view, **7c** outage fallbacks, and **7d** the current service's date from plans. The bullets below the parts are the whole stage.

**7a — Fake schedule source and team mapping (US-15, requirements v1.18)**
- `src/worker/dev/fake-schedule.ts` (dev-only, dropped from production builds like the test users): Service Types "Sunday Service" and "Special Events"; a Production team with the church's real position names and a Worship Band (not a media team). Developers and tests adjust it through `PUT /api/dev/schedule` (positions added, renamed, removed), stored in `dev_state`.
- The source in use is `c.var.schedule`: the fake one under `import.meta.env.DEV`, none in production until Stage 8 (the mapping screen says Planning Center isn't connected yet). Responses are cached in `source_cache` for 5 minutes (`sources/cache.ts`).
- Admin › **Team mapping** (`/admin/mapping`): choose the Service Type (settings `schedule_source` + `schedule_service_type`), then link the whole team and/or each position to a department of the default list, and mark "Sees all departments". Statuses: Linked, Follows the team, Not linked. Links are stored by the source's IDs; names are only kept for display.
- **Refresh from Planning Center** clears the source's cache and fetches again. A **notice** lists positions on media teams that lead to no department, and links to things gone from the source (with Remove link); the Team mapping tab shows the count from anywhere in the Admin area.
- **New teams:** a team with no links that nobody has reviewed gets an informational note ("New team in Planning Center: …") and a quiet "new" on the tab. "Not a media team" marks it once (the Worship Band, say) and folds it to one line with Undo; marked teams can't be linked, and linked teams can't be marked. Fake teams can be added through `PUT /api/dev/schedule` (`addedTeams`).
- Logged in `mapping_events`; Activity gets a **Mapping** filter.
**7b — Access and the department view (US-02, US-05)**
- The fake source gains rosters, plans and assignments for the test users: Test Volunteer (on Production, not scheduled), Test Admin (Production Director), Test Camera Operator (Camera 2), Test Two Positions (Audio and Propresenter), Test Technical Director, and Test Non-member (Worship Band only). A person's ID in a source comes from their sign-in account for it (`PERSON_PROVIDER` in `sources/schedule.ts`; the fake uses the test users' "dev" keys). `PUT /api/dev/schedule` `{ unpublished: true }` publishes no plan.
- **Membership (US-02)** is checked at sign-in and on every `GET /api/auth/me` (each page load; the roster is cached 5 minutes): on a linked team stamps `team_verified_at`, not on one clears it. Scheduling doesn't matter; Admins and Directors always get in. **Until team mapping is set up** (no Service Type or no links; `isTeamMappingReady`), only Admins and Directors get in, and everyone else sees "The app is being set up. Check back soon." (requirements v1.19).
- **The plan:** the source's plan for the current service's date is recorded on the service (`plan_source`, `plan_external_id`), so it's "published" and its assignments say who is scheduled.
- **The view (US-05):** `GET /api/checklist` adds `view` (`db/schedule-view.ts`): `own` (scheduled, positions linked: only those departments, with "Show all departments"), `all` (Admins, Directors, "sees all" positions: everything, theirs first, marked "Yours"), or `choose` (everything; a note says "not on the schedule" or "position not linked"). A position's own link wins over its team's. Every department is always sent, so the progress view covers them all, and check-offs are never limited by department.
- "Show all departments" and a hand-picked department are remembered on the device for the day (`lib/forToday.ts`, keyed by today's date in the church's time zone).
- While a scheduled volunteer sees only their own department(s), the service overview leads with their progress ("Camera Operators: 0 of 16 done") and shows the whole service's on a smaller line; with "Show all departments" on, and for everyone else, it shows the whole service.
- **Test in the browser:** with the expected mapping, sign in as Test Camera Operator: only Camera Operators shows; turn on "Show all departments", check a task in Audio Engineer and see it in Progress. Test Two Positions sees both departments; Test Volunteer sees all with the not-scheduled note; Test Technical Director, Test Admin and Test Director see everything, their own first; Test Non-member is kept out. Remove every link: Test Volunteer sees "The app is being set up", Admins and Directors still get in.

**7d — The current service's date from plans (US-07)**: when a plan is published on a day other than the service day, it becomes the current service. Kept apart from 7b because it changes how the history, the service record and the activity log find "the current service".

- **Test in the browser:** choose Sunday Service, enter the expected mapping below (Technical Director "sees all departments"), add a position through the dev route and see it appear as unlinked after Refresh, with the notice and tab count; mark the Worship Band "Not a media team"; add a team through the dev route and see the new-team note after Refresh; rename and delete positions and see links keep working or get flagged.

- The fake `ScheduleSource` (standing in for Planning Center) provides sample Service Types, teams, positions, rosters, plans and schedules, and it can be switched to "down" from the developer-only box on the sign-in page. Its sample data, including the church's real position names (below), lives in a **dev-only data file** under `src/worker/dev/`. Production builds drop it, as with the test users, and the production-build test checks those names are absent. **Nothing is mapped automatically:** admins link every team or position in the mapping screen, with the fake data as with real data.
- Admin mapping screen: pick a Service Type, then link teams or positions to categories. Unlinked items are marked, position links override team links, and items that have gone missing are flagged (US-15).
- Access is based on linked-team membership and the `team_verified_at` stamp (US-02).
- **Which departments the checklist shows (US-05, requirements v1.14, C24):**
  - A scheduled volunteer sees only their own department by default, or all of their departments if they're scheduled in more than one.
  - A "Show all departments" control adds the other departments after theirs, and they can check off tasks there (e.g. covering for someone). It stays on for the day on that device until turned off.
  - Volunteers who aren't scheduled, or whose position has no link, see all departments and choose theirs (remembered on the device for the day), with a note, as now.
  - Admins, Directors, and people scheduled in a position marked "sees all departments" (`team_links.sees_all`, set by an Admin in the mapping screen; e.g. Technical Director) see all departments by default, their own first and highlighted.
  - This is a view choice only. The check-off endpoints stay as they are and accept any live task in the current service from anyone with access. The progress view always shows every department.
- Manual department pick is remembered on the device for the day. Fallback banner and 90-day rule when Planning Center is "down" (US-04a). Current service now comes from Planning Center plans (US-07).
- `source_cache` is used here.
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

- **Technical Directors should also be given the app's Director role.** An Admin grants it on the Users page (Stage 6). The mapping above gives them access and highlights their Technical Director checklist, and marking the Technical Director position "sees all departments" shows them every department. The Director role adds reset/undo. Roles are never granted automatically from Planning Center (US-03).
- **Test in the browser:**
  - Link "Camera 2" to Camera Operators and sign in as a fake Camera 2 volunteer: only Camera Operators shows. Turn on "Show all departments", check off a task in another department, and see it in the progress view.
  - Sign in as a volunteer scheduled in two positions and see both departments. Sign in as an unscheduled volunteer and see all departments with the choose-your-department note.
  - Mark Technical Director "sees all departments" and sign in as a fake Technical Director: all departments show, Technical Director first. Do the same as the Admin and the Director.
  - Switch Planning Center to "down" and check the banner, the manual pick and the never-verified message.

### Stage 7b — Design review
Every screen is built by now, with the fake sources, so this is the point to look at the app as a whole before real Planning Center and deployment. Numbered 7b so Stages 8 and 9 keep their numbers.
- **Review every screen against `docs/design.md`** at **375px, 768px and desktop** widths: sign-in and the developer box, no access, checklist (scheduled, unscheduled, "Show all departments", fallback banner, no published service), Progress (as Volunteer and as Director/Admin, with reset and undo), the name menu and Settings, and each Admin section (Checklist, Hidden items, Lists, Users, Team mapping, Activity, History). Include loading, empty, error and confirmation states.
- **Look for:**
  - **Consistency:** the same components, spacing, wording and states for the same things across screens.
  - **Accessibility:** WCAG 2.1 AA contrast, keyboard use and visible focus, screen-reader labels, tap targets of at least 44px, status never shown by colour alone.
  - **Ease of use on Sunday morning:** in a dark booth, on a phone, in a hurry. How quickly a volunteer finds their department and the next open task, whether saving is obvious, and whether anything can be tapped by mistake.
- **List the problems and propose fixes before changing anything.** Each problem gets the screen, the width, what's wrong, which part of `design.md` or the requirements it falls short of, how much it matters, and the proposed fix, with screenshots. The project owner chooses which fixes to make; they're then built, shown and committed like any other stage.
- No new features here, and no change to the design direction, colours or typography without the project owner's say-so.

### Stage 8 — Real Planning Center
- The Planning Center `ScheduleSource` uses the church-level token (read-only) for teams, positions, rosters and plans, with a 5-second timeout (US-04a, US-17).
- Planning Center OAuth sign-in, as an `IdentityProvider`: the code exchange happens in the Worker, the volunteer's token is discarded after identifying them, and there are clear error messages when Planning Center is down (US-01, US-04b).
- The sign-in button starts the real Planning Center flow. The developer-only test-user control stays local-only, and production builds already exclude it (Stage 2).
- You'll need: an OAuth app and a church token registered at api.planningcenteronline.com (Q7), stored in `.dev.vars`.
- **Test in the browser:** sign in with your real Planning Center account locally, link real teams and confirm your real schedule is highlighted.

### Stage 9 — Cloudflare deployment
- Create the remote D1 database and run migrations. Set Worker secrets with `wrangler secret put` (US-16). Seed the first admin: a `users` row with Admin set, plus a `user_identities` row linking their Planning Center person ID (US-03a).
- **Set up team mapping before sharing the app with volunteers.** Until an Admin has chosen the Service Type and linked the teams and positions (Admin › Team mapping), only Admins and Directors can get in; everyone else sees "The app is being set up" (US-02).
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
| D5 | **Users have internal app IDs; sign-in accounts are linked to them.** | `users.id` plus `user_identities`. Roles, check-offs, resets and both logs refer to the internal ID. Recorded in requirements US-03a. |
| D6 | **Planning Center is a replaceable source.** | `IdentityProvider` and `ScheduleSource` interfaces under `src/worker/sources/`, and provider-neutral columns for outside IDs. Recorded in requirements C22. |
