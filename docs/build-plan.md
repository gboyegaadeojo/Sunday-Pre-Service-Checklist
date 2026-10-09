# Build Plan — Church Media Team Checklist App

> **Based on:** requirements.md v1.6 · **Date:** October 2026
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
| Time zone | `Intl.DateTimeFormat` with `America/Winnipeg` | Built into Workers and handles daylight saving (US-07). |
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
│   └── 0002_seed_ifc_checklist.sql   # Section 6 of requirements (US-14)
├── src/
│   ├── worker/
│   │   ├── index.ts          # Hono app: mounts routes and middleware
│   │   ├── middleware/       # session loading, role guards (requireAdmin, requireStaff)
│   │   ├── routes/           # auth, dev-auth, checklist, progress, admin-lists, admin-users, admin-mapping
│   │   ├── lib/              # session, time (Winnipeg), current-service, access, reset
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

All IDs are integers unless noted. Planning Center IDs are stored as text. Timestamps are ISO 8601 UTC. Service dates are `YYYY-MM-DD` in Winnipeg time.

### Users and settings

**users**
| Column | Notes |
|--------|-------|
| `pco_person_id` TEXT PK | Planning Center person ID (US-03) |
| `display_name`, `avatar_url` | Refreshed at each sign-in |
| `is_admin`, `is_director` | 0/1 flags (US-03) |
| `team_verified_at` | Last time membership in a linked team was confirmed (US-02, US-04a: 90-day rule) |
| `created_at`, `last_seen_at` | |

**settings** — key/value table. Holds the selected Planning Center Service Type ID and name (US-15).

### Checklist definition

Deletes set `deleted_at` instead of removing the row (US-12, US-13).

**task_lists** — `id`, `name`, `description`, `is_default` (only one row can be 1, enforced with a partial unique index), `deleted_at`, `created_at`

**categories** — `id`, `list_id` → task_lists, `name`, `sort_order`, `deleted_at`

**sections** — `id`, `category_id` → categories, `name` (e.g. "Power & Initial System Check"), `sort_order`, `deleted_at`

**tasks** — `id`, `section_id` → sections, `text`, `sort_order`, `deleted_at`

### Services and check-offs

**services** — one row per service (single service per Sunday, Q4)
| Column | Notes |
|--------|-------|
| `id` | |
| `service_date` UNIQUE | Winnipeg date |
| `pco_plan_id` | Null when no plan is published (Q3). Filled in if a plan appears later |
| `list_id` → task_lists | List used for this service (the default list at creation time) |
| `created_at` | |

Rows are created lazily the first time someone opens that service. No scheduled job is needed (US-07).

**checkoffs** — each check is one row. Unchecking updates that row rather than deleting it.
| Column | Notes |
|--------|-------|
| `id`, `service_id`, `task_id` | |
| `task_text_snapshot` | Task text at the moment of check-off (US-06, C8) |
| `checked_by_pco_id`, `checked_by_name`, `checked_at` | |
| `unchecked_by_pco_id`, `unchecked_by_name`, `unchecked_at` | Null while checked |
| `reset_id` → resets | Set when a reset archives this row |

A check-off is *active* when `unchecked_at IS NULL AND reset_id IS NULL`. A partial unique index on `(service_id, task_id)` for active rows stops two people from double-checking the same task at the same moment.

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
- Calculate the current service in Winnipeg time (stages 3–6 use upcoming Sunday or today; Planning Center plans come in stage 7). Show the "No service is published…" note (US-05).
- Tap to check or uncheck with an optimistic update and revert on error. Record who and when, plus the task text snapshot (US-06).
- **Test in the browser:** check tasks as the Volunteer, then sign in as the Admin and see the same ticks with names and times. Stop the dev server mid-tap to see the checkmark revert and the error appear.

### Stage 4 — Progress view, reset and undo
- A progress page for everyone with access (US-09, requirements v1.6): per-category counts, a colour plus a text label, and expandable rows showing who checked each task and when. It auto-refreshes every ~30 seconds and has a "last updated" time and a refresh button (US-09, US-10).
- Reset with a confirmation prompt that archives check-offs, plus "Undo reset" (US-07). These controls show only for Admins and Directors, and the server returns 403 to Volunteers.
- **Test in the browser:** use two browser profiles, one as Volunteer checking tasks and one as Director watching progress update. Confirm the Volunteer sees progress but no reset controls. Reset, then undo. Call the reset API as the Volunteer and confirm it's rejected.

### Stage 5 — Admin list management
- Lists: create, edit, delete and set the default (US-11).
- Categories, sections and tasks: add, rename or edit, reorder with up/down controls, and hidden delete with a confirmation prompt and warnings (US-12, US-13).
- Server rejects all of these for non-admins, including Directors.
- **Test in the browser:** edit a task that's already checked and confirm the progress history still shows the old text. Delete a category and confirm it disappears from the checklist but past data still displays.

### Stage 6 — Admin user management
- Users page: grant or revoke Admin and Director (US-03). Revoking takes effect on the user's next page load.
- **Test in the browser:** as Admin, make the fake Volunteer a Director. Reload as that Volunteer and see the reset controls appear.

### Stage 7 — Team mapping and access, with the fake Planning Center
- The Fake Planning Center provides sample Service Types, teams, positions, rosters, plans and schedules, and it can be switched to "down" from the dev login page.
- Admin mapping screen: pick a Service Type, then link teams or positions to categories. Unlinked items are marked, position links override team links, and items that have gone missing are flagged (US-15).
- Access is based on linked-team membership and the `team_verified_at` stamp (US-02). Scheduled categories are highlighted first, and users who aren't scheduled see a note (US-05).
- Manual department pick is remembered on the device for the day. Fallback banner and 90-day rule when Planning Center is "down" (US-04a). Current service now comes from Planning Center plans (US-07).
- `pco_cache` is used here.
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
