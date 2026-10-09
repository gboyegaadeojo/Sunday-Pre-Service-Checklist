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
npm test             # production build, then Vitest inside the Workers runtime against a fresh local D1
npx vitest run test/checklist.test.ts -t "hides deleted"   # single file / single test (no rebuild; production-build test uses the last dist/)
npm run typecheck    # regenerates worker-configuration.d.ts (wrangler types), then tsc on client and worker
npm run build        # production build into dist/
npm run db:migrate   # apply migrations to the local D1 only
```

Local D1 state lives in `.wrangler/state`. Delete that folder to reset the local database to schema + seed.

First-time setup: copy `.dev.vars.example` to `.dev.vars` and fill in `SESSION_SECRET` (the file explains how to generate one). The dev server only reads `.dev.vars` at startup, so restart it after changing that file.

## Before every commit

Before committing, always:
1. Run the lint, type checks, tests, and production build (`npm run check`), and confirm they all pass. If anything fails, fix it or tell the user. Never commit failing code.
2. Make sure no secrets, `.dev.vars`, `.wrangler`, or `node_modules` files are included.
3. Give the user a short summary of what changed and anything not finished.
4. Wait for the user's OK before committing.

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
  - `0002_seed_ifc_checklist.sql` was generated from Section 6 of the requirements.
  - Migrations that have been applied must not be edited once deployed (Stage 9). Add a new migration instead.
- **Auth** (`src/worker/middleware/auth.ts`, `src/worker/lib/session.ts`):
  - The `session` cookie is an HMAC-signed token holding only the user's Planning Center person ID. It lasts 30 days, is re-issued once it's over an hour old, and is HttpOnly and SameSite=Lax. It's Secure whenever the request is https.
  - `loadSession` runs on all `/api/*` routes. It re-reads the user and their roles from D1 into `c.var.user` on every request (US-03).
  - Guard routes with `requireUser` (signed in) or `requireAccess` (signed in and allowed in, per `hasAccess` in `lib/access.ts`). Errors carry `code: "signed_out"` (401) or `"no_access"` (403).
  - `upsertSignedInUser` never overwrites existing role flags. Roles change only in-app.
- **Fake sign-in** (`/api/dev/*`, with the test users in `src/worker/dev/fake-users.ts`; IDs start with `dev-`) is local-only and has two locks:
  1. **Build time.** It's mounted only inside `if (import.meta.env.DEV)` in `src/worker/index.ts`. `vite build` sets that to false and drops the code, which is why the routes are built by the `createDevAuthRoutes()` factory: no module-level side effects. The production bundle contains no test users at all. `test/production-build.test.ts` builds the app and proves this (the bundle has no test-user strings, and `/api/dev/*` returns 404 even with `DEV_AUTH=true`).
  2. **Run time, locally.** It answers only when `DEV_AUTH=true` is in `.dev.vars`.

  The client follows the same pattern. `App.tsx` picks `import.meta.env.DEV ? DevSignInPage : SignInPage`, so the developer test-user control never reaches the production client bundle. The production-build test also checks `dist/client`.

  Keep both locks. Never import from `src/worker/dev/` or `pages/DevSignInPage.tsx` outside those `DEV` branches.
- **Sign-in screen** (`components/app/SignInScreen.tsx`): exactly one option, "Sign in with Planning Center". Roles are determined after sign-in and are never chosen by the user. Locally that button signs in as the test volunteer, and the dashed "Developer only" box below the card switches test users. In production the button stays disabled with a note until Stage 8 connects Planning Center OAuth.
- **Who can do what** (requirements v1.6):
  - Progress view: everyone with access.
  - Reset and undo: Admins and Directors only.
  - List management, team mapping and role management: Admins only.

  Enforce each rule on the server, not only by hiding UI.
- **`DEV_AUTH` must never be set in Cloudflare** (Worker variables or secrets, dashboard or `wrangler secret put`). It belongs only in local `.dev.vars`. A production Worker ignores it and logs an error if it's present.
- **Tests** (`test/`):
  - Use the helpers in `test/helpers.ts`: `request()` calls the Hono app with the test bindings, and `signInAs("volunteer" | "admin" | "director" | "outsider")` returns a session cookie.
  - `vitest.config.ts` supplies `SESSION_SECRET` (random per run) and `DEV_AUTH`. Migrations are applied in `test/apply-migrations.ts`.
  - Tests that modify data reset it in `beforeEach`.
- **UI**:
  - React + Tailwind v4, dark-only (booth use).
  - Design tokens are defined in `@theme` in `src/client/styles.css`. Tailwind's default palette is switched off, so use only the token colours.
  - Components live in `src/client/components/`: `ui/` for shared building blocks, `app/` for the header, brand and user menu, `checklist/` for checklist screen parts.
  - `App.tsx` owns the session state (loading, signed out, signed in, error) from `GET /api/auth/me`. Pages call `onAccessChanged` when an API call returns 401 or 403 (`isAuthError` in `api.ts`).
  - Use `usePopover` for menus.
  - Tap targets are at least 44 px, ideally 48. The layout must work at 375 px, 768 px and desktop widths.
- **Planned, not built yet** (see build plan): a `PlanningCenter` interface with fake and real implementations, Winnipeg-time "current service" logic, and a D1-backed Planning Center cache. The Workers Cache API doesn't work on `*.workers.dev`.

## Rules from the requirements

- Secrets go only in Worker secrets or `.dev.vars` (gitignored). They must never appear in code or in browser responses (US-16).
- The browser never talks to D1 or Planning Center directly. The server checks the session and role on every request and returns only the data that role is allowed to see (US-17).
- All service dates and times use America/Winnipeg (US-07).
