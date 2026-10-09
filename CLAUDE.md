# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A checklist app for the IFC media team. They use it to prepare and verify the presentation station before Sunday service. It runs on Cloudflare Workers (Free) with a D1 database and must stay $0 to host.

- `docs/requirements.md` is the source of truth (user stories US-01 to US-18 and closed decisions). Cite story IDs in comments where a rule comes from a requirement.
- `docs/build-plan.md` lists the staged build plan, the database design and the approved decisions D1–D4. Build one stage at a time. Each stage must be testable in a browser, and the user approves it before it's committed.

## Commands

```sh
npm run dev          # applies local D1 migrations, then serves the app at http://localhost:5173
npm test             # Vitest inside the Workers runtime against a fresh local D1
npx vitest run test/checklist.test.ts -t "hides deleted"   # single file / single test
npm run typecheck    # regenerates worker-configuration.d.ts (wrangler types), then tsc on client and worker
npm run build        # production build into dist/
npm run db:migrate   # apply migrations to the local D1 only
```

Local D1 state lives in `.wrangler/state`. Delete that folder to reset the local database to schema + seed.

## Architecture

- **One Worker serves everything.** `wrangler.jsonc` sends `/api/*` to the Hono app in `src/worker/index.ts`. Every other path is a static asset from the Vite build, with SPA fallback to `index.html`. Static requests don't use Worker requests or CPU, so keep page logic in the client and keep the Worker thin. Free plan limits: 10 ms CPU per request and 100k requests a day.
- `@cloudflare/vite-plugin` runs the Worker in the real workerd runtime during `vite` dev, using the same `.wrangler/state` D1 that `wrangler d1 migrations apply --local` writes to.
- **`src/shared/types.ts`** holds the API response types imported by both `src/worker` and `src/client`. Change them together.
- **Database** (`migrations/`): plain SQL, no ORM. Queries live in `src/worker/db/`.
  - The checklist definition is task_lists → categories → sections → tasks.
  - Definition rows are never deleted. `deleted_at` hides them, so every read must filter `deleted_at IS NULL` (US-12, US-12a, US-13).
  - Section numbers ("1.", "2.") are derived from `sort_order` in the UI, not stored.
  - `0002_seed_ifc_checklist.sql` was generated from Section 6 of the requirements.
  - Migrations that have been applied must not be edited once deployed (Stage 9). Add a new migration instead.
- **Tests** (`test/`) call the Hono app directly with `app.request(path, init, env)`, where `env` comes from `cloudflare:test`. Migrations are applied in `test/apply-migrations.ts`. Tests that modify data reset it in `beforeEach`.
- **UI**: React + Tailwind v4, dark-only (booth use). Tap targets are at least 44 px (`min-h-11`). The layout must work at 375 px and 768 px wide.
- **Planned, not built yet** (see build plan): signed-cookie sessions with roles re-read from D1 on every request, a `PlanningCenter` interface with fake and real implementations, Winnipeg-time "current service" logic, and a D1-backed Planning Center cache. The Workers Cache API doesn't work on `*.workers.dev`.

## Rules from the requirements

- Secrets go only in Worker secrets or `.dev.vars` (gitignored). They must never appear in code or in browser responses (US-16).
- The browser never talks to D1 or Planning Center directly. The server checks the session and role on every request and returns only the data that role is allowed to see (US-17).
- All service dates and times use America/Winnipeg (US-07).
