# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A checklist app for the IFC media team. They use it to prepare and verify the presentation station before Sunday service. It runs on Cloudflare Workers (Free) with a D1 database and must stay $0 to host.

- `docs/requirements.md` is the source of truth (user stories US-01 to US-18 and closed decisions). Cite story IDs in comments where a rule comes from a requirement.
- `docs/build-plan.md` lists the staged build plan, the database design and the approved decisions D1–D4. Build one stage at a time. Each stage must be testable in a browser, and the user approves it before it's committed.
- **All UI work must follow `docs/design.md`**, the design brief. It covers colour tokens, layout, components and states, and its preface explains how it's applied in each stage.

## Commands

```sh
npm run dev          # applies local D1 migrations, then serves the app at http://localhost:5173
npm run check        # lint + typecheck + tests + build: everything the pre-commit hook runs
npm run lint         # Biome (lint only, no formatter). Warnings count as failures
npm test             # production build, then Vitest inside the Workers runtime against a fresh local D1 (4 files at a time; TEST_WORKERS=n to change)
npx vitest run test/checklist.test.ts -t "hides deleted"   # single file / single test (no rebuild; production-build test uses the last dist/)
npx vitest run --project client   # browser-code tests only (happy-dom; test/client/*.test.tsx). --project worker for the rest
npm run typecheck    # regenerates worker-configuration.d.ts (wrangler types), then tsc on client and worker
npm run build        # production build into dist/
npm run db:migrate   # apply migrations to the local D1 only
```

Local D1 state lives in `.wrangler/state`. Delete that folder to reset the local database to schema + seed.

First-time setup: copy `.dev.vars.example` to `.dev.vars` and fill in `SESSION_SECRET` (the file explains how to generate one). The dev server only reads `.dev.vars` at startup, so restart it after changing that file.

## Everything is editable

The church will keep changing its checklist, departments, and team structure. Never hardcode church-specific content or structure in the code. This includes department names, the number of departments, sections, tasks, task text, task lists, Planning Center position or team names, service times, and church name or email. All of it must come from the database and be editable by admins in the app. The seed file is only starting data. Layouts must work with any number of departments, sections, or tasks. If a requirement seems to need something hardcoded, stop and ask the user first.

## Before every commit

Before committing, always:
1. Run the lint, type checks, tests, and production build (`npm run check`), and confirm they all pass. If anything fails, fix it or tell the user. Never commit failing code.
2. Make sure no secrets, `.dev.vars`, `.wrangler`, or `node_modules` files are included.
3. Give the user a short summary of what changed and anything not finished.
4. Wait for the user's OK before committing.

When the user says "commit", that means commit **and push** (to `origin main`).

`.githooks/pre-commit` enforces points 1 and 2 automatically. `npm install` enables it through the `prepare` script, which runs `git config core.hooksPath .githooks`. The hook blocks a commit if:
- forbidden files are staged, or
- an added line looks like a secret (a `*_SECRET`, `*_TOKEN`, `*_PASSWORD` or `*_API_KEY` name with a long value, or a private key), or
- `npm run check` fails.

Never bypass it with `--no-verify`. The hook must keep LF line endings, which `.gitattributes` enforces, or it breaks on Windows.

## Architecture

- **One Worker serves everything.** `wrangler.jsonc` sends `/api/*` to the Hono app in `src/worker/index.ts`. Every other path is a static asset from the Vite build, with SPA fallback to `index.html`. Static requests don't use Worker requests or CPU, so keep page logic in the client and keep the Worker thin. Free plan limits: 10 ms CPU per request and 100k requests a day.
- `@cloudflare/vite-plugin` runs the Worker in the real workerd runtime during `vite` dev, using the same `.wrangler/state` D1 that `wrangler d1 migrations apply --local` writes to.
- **`src/shared/types.ts`** holds the API response types imported by both `src/worker` and `src/client`. Change them together.
- **Database** (`migrations/`): plain SQL, no ORM. Queries live in `src/worker/db/`.
  - The checklist definition is task_lists → categories → sections → tasks.
  - Definition rows are never deleted. `deleted_at` hides them, so every read must filter `deleted_at IS NULL` (US-12, US-12a, US-13).
  - Section numbers ("1.", "2.") are derived from `sort_order` in the UI, not stored.
  - **The structure is data, never code.** Admins can move tasks between sections and departments, move sections between departments, and reorder everything (US-12, US-12a, US-13). Application code must never hardcode department or section names, IDs or ownership. Tests may use seed names.
  - Check-offs snapshot the task text, department and section (`*_snapshot` columns). The current service places check-offs by the task's current location (`task_id`), so a moved task stays checked. Past services and history use the snapshots.
  - `0002_seed_ifc_checklist.sql` was generated from Section 6 of the requirements.
  - Migrations that have been applied must not be edited once deployed (Stage 10). Add a new migration instead.
- **Auth** (`src/worker/middleware/auth.ts`, `src/worker/lib/session.ts`):
  - The `session` cookie is an HMAC-signed token holding only the internal app user ID (`users.id`, never a sign-in provider's ID) and a session ID. It lasts 30 days, is re-issued once it's over an hour old, and is HttpOnly and SameSite=Lax. It's Secure whenever the request is https.
  - `loadSession` runs on all `/api/*` routes. It re-reads the user and their roles from D1 into `c.var.user` on every request (US-03).
  - Guard routes with `requireUser` (signed in) or `requireAccess` (signed in and allowed in, per `hasAccess` in `lib/access.ts`). Errors carry `code: "signed_out"` (401) or `"no_access"` (403).
  - **App users (US-03a):** people are `users` rows with an internal `id` (AUTOINCREMENT, never reused). Sign-in accounts are linked in `user_identities` (`provider` + `subject`, unique), and every sign-in goes through `signInWithIdentity` (`db/users.ts`): it finds the linked user, or creates the user and the link in one batch. It never overwrites role flags; roles change only in-app.
  - Roles, check-offs (`checked_by_user_id`/`unchecked_by_user_id`), resets (`reset_by_user_id`/`undone_by_user_id`) and both logs (`user_id`) refer to the internal ID, next to the person's name at the time. Never store a provider's ID (e.g. a Planning Center person ID) anywhere else, and never send one to the browser. Tests get a test user's ID with `userIdOf(key)` (`test/helpers.ts`).
- **Fake sign-in** (`/api/dev/*`, with the test users in `src/worker/dev/fake-users.ts`; they are the `dev` sign-in provider with their key as the subject) is local-only and has two locks:
  1. **Build time.** It's mounted only inside `if (import.meta.env.DEV)` in `src/worker/index.ts`. `vite build` sets that to false and drops the code, which is why the routes are built by the `createDevAuthRoutes()` factory: no module-level side effects. The production bundle contains no test users at all. `test/production-build.test.ts` builds the app and proves this (the bundle has no test-user strings, and `/api/dev/*` returns 404 even with `DEV_AUTH=true`).
  2. **Run time, locally.** It answers only when `DEV_AUTH=true` is in `.dev.vars`.

  The client follows the same pattern. `App.tsx` picks `import.meta.env.DEV ? DevSignInPage : SignInPage`, so the developer test-user control never reaches the production client bundle. The production-build test also checks `dist/client`.

  Keep both locks. Never import from `src/worker/dev/` or `pages/DevSignInPage.tsx` outside those `DEV` branches.
- **Sign-in screen** (`components/app/SignInScreen.tsx`): exactly one option, "Sign in with Planning Center". Roles are determined after sign-in and are never chosen by the user. Locally that button signs in as the test volunteer, and the dashed "Developer only" box below the card switches test users. In production the button stays disabled with a note until Stage 9 connects Planning Center OAuth.
- **Who can do what** (requirements v1.6):
  - Progress view: everyone with access.
  - Reset and undo: Admins and Directors only.
  - List management, team mapping and role management: Admins only.

  Enforce each rule on the server, not only by hiding UI.
- **`DEV_AUTH` must never be set in Cloudflare** (Worker variables or secrets, dashboard or `wrangler secret put`). It belongs only in local `.dev.vars`. A production Worker ignores it and logs an error if it's present.
- **Tests** (`test/`):
  - Use the helpers in `test/helpers.ts`: `request()` calls the Hono app with the test bindings, and `signInAs("volunteer" | "admin" | "director" | "outsider")` returns a session cookie.
  - `vitest.config.ts` supplies `SESSION_SECRET` (random per run) and `DEV_AUTH`. Migrations are applied in `test/apply-migrations.ts`.
  - Each server test file runs in its own Workers runtime with its own D1, so `maxWorkers` is capped at 4 (`TEST_WORKERS` overrides). The default (one per core) ran this 16-core machine out of memory and broke the pre-commit hook.
  - Tests that modify data reset it in `beforeEach`.
- **UI**:
  - React + Tailwind v4, dark-only (booth use).
  - Design tokens are defined in `@theme` in `src/client/styles.css`. Tailwind's default palette is switched off, so use only the token colours.
  - Components live in `src/client/components/`: `ui/` for shared building blocks, `app/` for the header, brand and user menu, `checklist/` for checklist screen parts.
  - `App.tsx` owns the session state (loading, signed out, signed in, error) from `GET /api/auth/me`. Pages call `onAccessChanged` when an API call returns 401 or 403 (`isAuthError` in `api.ts`).
  - Use `usePopover` for menus.
  - Tap targets are at least 44 px, ideally 48. The layout must work at 375 px, 768 px and desktop widths.
- **Settings and branding.** Church-specific values live in the `settings` table (`src/worker/db/settings.ts`), seeded by `0003_default_settings.sql` and edited by admins on the Settings page (Stage 5d.2, `routes/admin-settings.ts`, `pages/admin/SettingsPage.tsx`). Settings is at `/settings` and is opened from the user menu (`UserMenu`, above Sign out), not the Admin tabs. The menu item is shown only to Admins; `App.tsx` shows "Admins only" to anyone else at that address, and the API refuses them. `GET /api/branding` is public and returns only the short name, team name and app name; an empty value is sent as null. The client shares them via `BrandingContext` (`src/client/lib/branding.ts`), and `Brand` and the tab title read from it. If a value is missing, it's left out; never add a church-specific fallback. On phones the header shows only the logo mark, so with no mark it shows no brand there.
  - Saving settings (`updateChurchSettings`) writes only the values that changed and logs them to the append-only `settings_events` (migration `0006`) in the same batch, log first (the log row reads the before values; each upsert runs `WHERE changes() = 1`). The time zone must be an IANA name (`isTimeZone`; offsets like `+05:00` are refused). Admin › Activity shows these under the Settings filter.
  - A change that moves the current service to another date is confirmed first, saying how many tasks are checked on the old date (they stay with it).
- **Current service and check-offs** (Stage 3):
  - `src/shared/service-day.ts` is pure date maths (shared so the Settings screen can preview the current service date) from the `time_zone` and `service_weekday` settings. `db/services.ts` `getCurrentService` creates the service row on first view with the default list at that moment, and the service keeps that list.
  - Invalid or missing calendar settings throw (500). Never fall back to a hardcoded value.
  - `PUT`/`DELETE /api/services/:serviceId/tasks/:taskId/checkoff` only accept the *current* service (409 `service_changed` otherwise) and tasks that are live in its list. A second check of an already-checked task keeps the first check-off.
  - Client state lives in `lib/useChecklist.ts`: optimistic toggle, revert on failure, and `SaveState` for the "All changes saved" indicator. It refreshes quietly every 30 seconds while visible and on returning to the tab (US-06, C17), but never while a save is in flight. A refresh result is dropped if a tap happened while it was loading (`tapSeq`), so a refresh can never untick a tap. `test/client/checklist-refresh.test.tsx` covers this race.
  - Sections finished at page load start collapsed, decided once so a section never closes under the user's finger.
- **Check-off activity log** (`checkoff_events`, migration `0004`):
  - Every check or uncheck attempt that reaches the check-off logic is logged in the same `db.batch` transaction as the write. The outcome is computed in SQL with `changes()`.
  - It records the user, the session ID (`sid` in the session token, kept on renewal), the tab ID (`X-Tab-Id`, a random value per page load from `api.ts`) and the user agent.
  - It is **append-only**: triggers abort `UPDATE` and `DELETE`. Never work around them, and never clear the table in tests; read only rows after a marker ID instead.
  - Reset and undo log to it as well (`action` reset/undo_reset, `task_id` NULL, `affected` = count). Any future code that changes check-offs must log here too.
  - `services.id` is `AUTOINCREMENT`, so a service ID is never reused and old log rows can never attach to a new service.
- **Roles per feature (requirements v1.6), enforced on the server first:**

  | Feature | Who | Guard |
  |---|---|---|
  | Progress view (`/progress`, data from `GET /api/checklist`) | everyone with access | `requireAccess` |
  | Reset and undo (`POST /api/services/:id/reset`, `/undo-reset`) | Admins and Directors | `requireStaff` |
  | Activity log (`/admin/activity`, `GET /api/services/:id|current/events`, `GET /api/admin/edits`) | Admins only | `requireAdmin` |
| Service history (`/admin/history`, `GET /api/admin/history`, `/api/admin/history/:id`) | Admins only | `requireAdmin` |
| Users and roles (`/admin/users`, `/api/admin/users`, `PUT /api/admin/users/:id/roles`, `/api/admin/users/events`) | Admins only | `requireAdmin` |
| Team mapping (`/admin/mapping`, `/api/admin/mapping`, `/status`, `/refresh`, `/service-type`, `/link`, `/events`) | Admins only | `requireAdmin` |
  | Checklist editor, Hidden items, Lists and Settings (`/admin/checklist`, `/admin/checklist/hidden`, `/admin/lists`, `/settings`, `/api/admin/*`) | Admins only | `requireAdmin` on each admin router |

  `GET /api/checklist` adds `service.reset` only for staff. The UI hides what a role can't use (`AppNav`, `ProgressPage`), and `test/client/stage4-roles.test.tsx` checks that it never offers what the server refuses.
- **Reset and undo** (`db/resets.ts`):
  - Reset archives active check-offs under a new `resets` row, storing `archived_count`. It's refused when nothing is checked, so an extra reset can't take away the chance to undo the real one.
  - Undo restores only the latest reset, and only once. Tasks checked since the reset keep the newer check-off (D3).
  - Both confirm first in the UI (`ConfirmDialog`, native `<dialog>`).
- **Admin workspace** (design.md §7): the header's **Admin** tab leads to sub-tabs (`AdminTabs`), currently Checklist, Lists, Team mapping, Users, Activity and History. The Team mapping tab shows a count of what needs linking (`/api/admin/mapping/status`, re-checked on section change and on the `MAPPING_CHANGED` window event). Only list sections that exist. Settings is not a tab; it's in the user menu. Hidden items is reached from the editor and keeps the Checklist tab active.
- **Checklist editor** (Stage 5):
  - The server side is `routes/admin-structure.ts` and `db/admin-structure.ts`. Every write requires the item and its whole ancestry (up to the list) to be live (`LIVE_*` guards). New items get the next `sort_order`.
  - Hiding sets `deleted_at` and never erases. Hiding a department also deletes its `team_links` in the same transaction.
  - Names and task text are trimmed, must not be empty, and are limited to `NAME_MAX` and `TASK_TEXT_MAX` in `shared/types.ts`.
  - The client is `lib/useAdminList.ts` on top of `lib/useServerFirst.ts` (server first, then reload; never optimistic; 404/409 reload quietly) and `components/admin/*` (`EditorContext`, one inline `TextEditor` open at a time, `ActionMenu` "⋯" per item, `ConfirmDialog` before any hide).
  - **Restructuring (Stage 5b):** each item's "⋯" menu has Move up/Move down (disabled at the ends) and, for tasks and sections, "Move to…" (`MoveDialog`: department, then section). Reorder swaps `sort_order` with the nearest *live* sibling; moves go to the end of the destination and must stay in the same list. The moved item is briefly highlighted and its menu button refocused.
  - **Reorder mode (5c.2):** the editor's Reorder toggle swaps each row's ⋯ menu for `ReorderButtons` (↑/↓, same endpoints) and hides the Add buttons; a sticky bar holds Done. Focus follows the moved item via `focusTarget` (an effect that retries after each render); one move at a time (`reorderBusy`).
  - **Hidden items (US-13a):** `pages/admin/HiddenItemsPage.tsx` lists rows with `deleted_at` set (`getHiddenItems`). Restore clears `deleted_at` and keeps ID and `sort_order`, so history and position come back. The server never restores into a hidden parent (409 `parent_hidden`); `withParents: true` restores the hidden ancestors in the same batch. Team links deleted by a hide are not recreated.
- **Service checklist record** (Stage 5d.4, US-07b; `service_tasks`, migration `0007`; `db/service-record.ts`): every task on a service's checklist while it was current. `getCurrentService` starts it (once per service: `tasks_recorded_from`). **Every checklist edit in `db/admin-structure.ts` ends its `db.batch` with `syncRecordStatements(db)`**, which reconciles only the *current* service's record with the live list; the list switch in `db/lists.ts` uses `restartRecordStatements`. Any new structure edit must do the same. Past services are frozen because they're no longer current; triggers back that up. Tests cleaning `services` or `tasks` rely on its cascading deletes.
- **Service history** (Stage 5d.3, design.md §7; `db/history.ts`, `routes/admin-history.ts`, `pages/admin/HistoryPage.tsx`): read-only. A service with a record shows "X of Y done" from `service_tasks` (end-of-service place; removed tasks listed apart, not counted). A service without one (before `0007`) shows only active check-offs from their `*_snapshot` columns, grouped by snapshot department and section (current `sort_order`, hidden rows included), never from the live structure. The current service is worked out without creating its row and left out of the list. `GET /api/services/:id/events` shows a past service's task text from the latest check-off snapshot of that task in that service; the current service shows today's text. The log wording shared with Activity is in `lib/activity.ts`.
- **Users and roles** (Stage 6, US-03; `db/roles.ts`, `routes/admin-users.ts`, `pages/admin/UsersPage.tsx`): roles change only here (sign-in never changes them). `setRoles` writes the `role_events` log row first (migration `0008`, append-only), guarded on the roles as read and on never removing the last Admin, then the change `WHERE changes() = 1`. The `users_keep_an_admin` trigger (migration `0009`) refuses any update that would leave no Admin, so tests can't demote the only Admin either (use Director, or make a second Admin first). 409 `last_admin` or a conflict otherwise. Activity shows these under the Roles filter. Tests reset the test users' roles in `afterEach`.
- **Task lists** (Stage 5d.1, US-11; `db/lists.ts`, `routes/admin-lists.ts`, `pages/admin/ListsPage.tsx`):
  - Create empty or as a copy (three set-based `INSERT … SELECT`s; never per-row statements: D1 Free allows 50 queries per request). Make default (one batch; optionally switches the current service only if it has no check-offs). Hide is refused for the default and the current service's list. Restore.
  - Names are unique among visible lists, ignoring case and extra spaces (`normalizeListName`, `NAME_FREE` guard inside each write; 409 when taken). Restore is refused while a visible list has the hidden list's name.
  - List changes log to `checklist_events` with entity `list`; `GET /api/admin/edits` (optional `?list=`) is the edit feed across lists.
- **Checklist edit log** (`checklist_events`, migration `0005`, Stage 5c, US-13b):
  - Every applied add, rename, edit, hide, restore, move and reorder is logged with the actor (`actorFor`), the item, its name/text after the change (`entity_name`), and `before_json`/`after_json` holding only what changed (`name`/`text`, `place` = department, section, 1-based position; `teamLinks` removed by a department hide). Refused edits change nothing and log nothing.
  - **Same transaction, log first:** in `db/admin-structure.ts` the log row is an `INSERT … SELECT` that carries the edit's guard and reads the before values; the edit itself then runs `WHERE … AND changes() = 1`. Adds are the exception: the row is inserted first and the log reads it via `last_insert_rowid()`. The actor binds as `?21–?25` (`bindWithActor`). Any new structure edit must follow this pattern.
  - Append-only like `checkoff_events` (triggers abort `UPDATE`/`DELETE`); tests read rows after a marker ID.
  - `GET /api/admin/edits` (Admin, all lists) feeds the Activity view, which merges it with the current service's check-off log behind an All / Check-offs / Checklist edits filter.
  - Tests use their own list (ID 77) so the seed checklist stays untouched: call `setUpAdminFixture()` from `test/admin-fixture.ts`.
- **Client routing:** `lib/router.ts` handles the path routes `/`, `/progress`, `/admin/checklist`, `/admin/checklist/hidden`, `/admin/lists`, `/admin/mapping`, `/admin/users`, `/admin/activity`, `/admin/history` and `/settings`, plus a query string (`navigate(route, "?list=5")`, `RouteLink search=…`; the editor and Hidden items read `?list=` via `listRefFrom`, default list when absent; History reads `?service=`), with aliases `/admin`, `/activity` and `/admin/settings` (the address bar switches to the canonical path). The Worker's SPA fallback serves them. The progress view refreshes every 30 seconds while the tab is visible (`lib/useProgress.ts`).
- **Replaceable sources (requirements C22):** Planning Center is reached only through the interfaces in `src/worker/sources/`: `IdentityProvider` (sign-in) and `ScheduleSource` (teams, positions, membership, plans). Code outside `sources/` must not know which provider is in use. Outside IDs are stored as a source name plus that source's ID (`team_links.source`/`team_external_id`/…, `services.plan_source`/`plan_external_id`, `source_cache`); never add Planning Center–named columns.
- **Schedule source in use:** `c.var.schedule` (set in `src/worker/index.ts`): the fake source (`src/worker/dev/fake-schedule.ts`, factory `createFakeScheduleSource`) only inside `import.meta.env.DEV`, so production builds drop it and its sample data (`test/production-build.test.ts` checks); `null` in production until Stage 9. Each source names itself (`label`). Its responses are cached in D1 `source_cache` (`sources/cache.ts`, 5 minutes; keys start with the source ID, which "Refresh" clears). The Workers Cache API doesn't work on `*.workers.dev`. Dev-only adjustments to the fake: `PUT /api/dev/schedule` (same two locks as the fake sign-in), stored in `dev_state`.
- **Team mapping** (Stage 7a, US-15; `db/mapping.ts`, `routes/admin-mapping.ts`, `pages/admin/MappingPage.tsx`): links in `team_links` by source + external IDs, to live departments of the default list, with `sees_all`. Never automatic. `setLink` logs to append-only `mapping_events` first, guarded on the link as read, then changes `WHERE changes() = 1`. "Unlinked" means a position on a media team (a team with any link) with no link of its own and none on its team. A team with no links is "new" until linked or marked "Not a media team" (`non_media_teams`, `setNotMediaTeam`, logged as `not_media`); marked teams can't be linked.
- **Access and the department view** (Stage 7b, US-02, US-05; `db/schedule-view.ts`): `verifyMembership` runs at sign-in and on every `GET /api/auth/me`, stamping or clearing `team_verified_at` from the source's roster against linked teams; "unknown" (no source, no Service Type or no links yet, no account in the source, source unreachable) changes nothing. **Until team mapping is set up** (`isTeamMappingReady`: Service Type chosen and at least one link), only Admins and Directors get in: `requireAccess` refuses everyone else with "The app is being set up. Check back soon.", and `/me` sends `settingUp: true` for `NoAccessPage`. The shared test setup (`test/apply-migrations.ts`) therefore maps the fake Production team to a seed department in every test file; mapping tests clear it first. `attachPlan` records the plan for the current service's date. `getChecklistView` gives `GET /api/checklist` its `view` (`own`/`all`/`choose` + note). A person's ID in a source is their sign-in subject for `PERSON_PROVIDER[source]`. The view is display only: never filter categories or check-offs by it on the server. The client remembers "Show all departments" and a picked department for the day (`lib/forToday.ts`).
- **Outages** (Stage 7c, US-04a, US-04b): every source call goes through `cached()` in `sources/cache.ts`, which times out at 5 seconds and then marks the source unreachable for a minute (`<source>:unavailable` in `source_cache`; cleared by Refresh or the dev switch). Callers turn `ProviderUnavailableError` into a fallback, never a blocked page: `verifyMembership` returns "unavailable" (the last confirmation stands for `VERIFIED_FOR_DAYS` = 90 in `lib/access.ts`), `attachPlan` reports `unavailable`, and the checklist view becomes "choose" with note `schedule_unavailable`. `/me` sends `unreachable` (the source's label) to someone not confirmed in 90 days. Fake outage: `down`/`delayMs` in `PUT /api/dev/schedule`, and the dev sign-in's main button (`viaPlanningCenter`) refuses with the US-04b message while down.
- **Planned, not built yet** (see build plan): the current service's date from plans (7d), the design review (Stage 8), the Planning Center implementations (Stage 9), and deployment (Stage 10).

## Rules from the requirements

- Secrets go only in Worker secrets or `.dev.vars` (gitignored). They must never appear in code or in browser responses (US-16).
- The browser never talks to D1 or Planning Center directly. The server checks the session and role on every request and returns only the data that role is allowed to see (US-17).
- All service dates and times use the church's time zone and service weekday from the `settings` table (US-07, US-11a; seeded America/Winnipeg and Sunday). Never write a time zone or weekday into code.
