# Running the live app (Stage 10)

How the live checklist is hosted, deployed, backed up and looked after. It's written for whoever maintains the app
for the IFC media team. Planning Center setup (the token and the OAuth application) is in `docs/planning-center.md`.

## What runs where

- **Cloudflare Workers (Free)**: one Worker, `checklist`, serves the pages (static files, which
  cost nothing) and the `/api/*` routes. Free plan limits: 100,000 requests a day, 10 ms CPU per request.
- **Cloudflare D1 (Free)**: one database, `sunday-pre-service-checklist`, bound to the Worker as `DB`. Its ID is in
  `wrangler.jsonc` (not a secret). Local development uses a separate local database (`preview_database_id`), so
  nothing you do locally touches the live data.
- **GitHub**: every push to `main` builds and deploys automatically (below).
- **Cost**: $0. Nothing here needs a paid plan.

**Live address:** `https://checklist.media-5f7.workers.dev` (the Worker `checklist` on the account's workers.dev
subdomain, `media-5f7`, which it shares with other Workers on the account, so don't change it).

## Secrets

Secrets are set on the Worker, never in code, GitHub or chat (US-16). Each one is typed in by a person, either in a
terminal or in the dashboard.

| Secret | What it is | Where it comes from |
|---|---|---|
| `SESSION_SECRET` | Signs everyone's sign-in cookie | Generate a new random one (below). Never reuse the local one |
| `PCO_PAT_ID` | Planning Center token, Application ID (reads the schedule) | api.planningcenteronline.com › Personal Access Tokens |
| `PCO_PAT_SECRET` | Planning Center token, Secret | Same place. Shown once when the token is created |
| `PCO_CLIENT_ID` | OAuth application, Client ID (sign-in) | api.planningcenteronline.com › OAuth Applications |
| `PCO_CLIENT_SECRET` | OAuth application, Secret | Same place |

**Never set `DEV_AUTH` or `SCHEDULE_SOURCE` on the Worker.** They are local-only switches. The live build doesn't
contain the test users or the sample schedule at all, and a live Worker that finds `DEV_AUTH` ignores it and logs an
error. Check with `npx wrangler secret list`: it should list exactly the five names above.

### Setting or changing a secret

Either way, the value is typed by you and never shown again.

- **Terminal** (in the project folder, signed in with `npx wrangler login`):
  `npx wrangler secret put SESSION_SECRET`, then type or paste the value at the prompt and press Enter.
- **Dashboard**: Workers & Pages › `checklist` › Settings › Variables and Secrets › Add.
  Choose type **Secret**, enter the name and the value, then **Deploy**.

A new value takes effect within a few seconds, with no redeploy needed. Deploys from GitHub keep the secrets.

To make a new `SESSION_SECRET`, run this in your own terminal and copy the output straight into the prompt:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### Rotating secrets

- **`SESSION_SECRET`**: set a new value. **Everyone is signed out** and signs in again with Planning Center. Do it
  if it might have leaked, and never on a Sunday morning.
- **Planning Center token** (`PCO_PAT_*`): create a new Personal Access Token (with Services), set both secrets,
  check Team mapping loads, then revoke the old token in Planning Center.
- **OAuth application secret** (`PCO_CLIENT_SECRET`): reset it on the OAuth application in Planning Center, then
  set the new value straight away. Sign-in fails in between, while existing sessions keep working.

## Automatic deploys (Cloudflare Workers Builds)

The Worker is connected to the GitHub repository in Workers & Pages › `checklist` › Settings ›
Build. The settings:

| Setting | Value |
|---|---|
| Git repository | `gboyegaadeojo/Sunday-Pre-Service-Checklist` |
| Production branch | `main` (Disable builds: off) |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Enable Preview builds | **Off**: preview versions of other branches would use the live database |
| Path | `/` |
| API token | Created automatically when connecting ("Workers Builds – <date>") |
| Build variables | None. Never `DEV_AUTH` or `SCHEDULE_SOURCE` |

`npm run deploy` first applies any new database migrations to the live database (`npm run db:migrate:remote`),
then deploys the new version. If a migration fails, nothing is deployed. A failed build leaves the previous version
running. Connecting the repository doesn't start a build by itself; the next push to `main` does.

The checks (lint, types, tests) run before every commit on your machine (`.githooks/pre-commit`), so the build only
builds.

## Rules for releasing

1. **No pushes to `main` from Saturday 6 PM until after the Sunday service**, in the church's time zone (Church
   settings), unless it's an urgent fix. Every push to `main` goes live within minutes.
2. **Migrations are append-only.** Never edit, rename or delete an existing file in `migrations/`: the live database
   has already applied it. Every database change is a new migration (the next number). The pre-commit hook refuses
   changes to existing migration files.
3. **Export the live database before pushing a new migration** (below), and keep the file until the change has been
   live through a Sunday.

## Backups

### Point-in-time recovery (Time Travel)

D1 keeps every change for **7 days** on the Free plan, so the database can be put back as it was at any moment in
that time. Nothing needs setting up.

```sh
# What the database looked like at a moment (shows a bookmark for that point):
npx wrangler d1 time-travel info DB --timestamp="2026-10-18T08:00:00-05:00"

# Put the whole live database back to that moment (asks to confirm):
npx wrangler d1 time-travel restore DB --timestamp="2026-10-18T08:00:00-05:00"
```

Restore replaces the **whole** database, including check-offs and log entries made after that moment. It prints a
bookmark for the state just before the restore, so a restore can itself be undone with
`npx wrangler d1 time-travel restore DB --bookmark=<that bookmark>`.

### Exports (copies you keep)

An export is a `.sql` file of the whole live database. Take one before every deploy that includes a new migration,
and from time to time (say monthly) for a copy older than 7 days.

```sh
npm run db:export -- backups/2026-10-18-before-0012.sql
```

Exports go in `backups/`, which git ignores and the pre-commit hook refuses: they contain real names. Keep the
important ones somewhere safe and private as well.

### Restoring from an export

An export can't be loaded over the live database (the logs are append-only, and the rows already exist). It goes into
a **new** database, which the app is then switched to:

1. `npx wrangler d1 create sunday-pre-service-checklist-restore`, and note the new database ID it prints.
2. `npx wrangler d1 execute sunday-pre-service-checklist-restore --remote --file backups/<file>.sql`
3. In `wrangler.jsonc`, change `database_name` and `database_id` to the new database's.
4. Commit and push. The deploy points the app at the restored database.
5. Once everything checks out, the old database can be deleted in the dashboard (Workers & Pages › D1).

## Rolling back a deploy

If a deploy breaks something, put the previous version back. It takes seconds and needs no build.

- **Dashboard**: Workers & Pages › `checklist` › Deployments. Find the last good version, open
  its **⋯** menu and choose **Rollback**. The "Rollback checklist" dialog shows the current version and the one you're
  going back to; add a message (e.g. what broke) and click the blue **Rollback** button. The Active deployment box
  shows the old version within seconds.
- **Terminal**: `npx wrangler deployments list --name checklist` shows recent versions;
  `npx wrangler rollback <version-id> --name checklist --message "what broke"` deploys that version to all traffic
  (it asks you to confirm). Without a version ID it goes back to the previous one.

Rolling forward again is the same thing: roll back to the newer version. Both directions were practised when the app
went live (October 2026).

A rollback changes only the code. **It doesn't undo database migrations**, which is fine as long as migrations only
add things (new tables or columns) that the older code ignores. Data can be put back with Time Travel. The next push to
`main` deploys again, so fix the problem (or revert the commit) before pushing.

## The first Admin

Roles never come from Planning Center (US-03), so the very first Admin is set once in the database:

1. They sign in on the live site with Planning Center. They see "The app is being set up", which is expected.
2. List the people who have signed in (names and internal IDs only):
   `npx wrangler d1 execute DB --remote --command "SELECT id, display_name, is_admin FROM users"`
3. Make the right person Admin, logged like any role change (replace `<id>`):

   ```sh
   npx wrangler d1 execute DB --remote --command "INSERT INTO role_events (target_user_id, target_name, before_json, after_json, user_id, user_name) SELECT id, display_name, '{\"isAdmin\":false}', '{\"isAdmin\":true}', id, 'First Admin (set at deployment)' FROM users WHERE id = <id> AND is_admin = 0; UPDATE users SET is_admin = 1 WHERE id = <id>;"
   ```

4. They refresh the page. Every other role is then given in the app (Administrative Settings › Users & Permissions).

## Before volunteers use it

1. **Team mapping** (Administrative Settings › Team mapping): choose the Service Type and link each media position to
   its department. Until then only Admins and Directors can get in; everyone else sees "The app is being set up"
   (US-02).
2. **Directors**: each person who needs reset and undo (e.g. Technical Directors) signs in once; an Admin then gives
   them Director on Users & Permissions.
3. **Ask every volunteer to sign in once during the week** (US-04b). A session lasts 30 days, so on Sunday they're
   already signed in, even if Planning Center sign-in has a problem that morning.

## Custom domain (optional)

The app works on its workers.dev address. To use the church's own address (e.g. `checklist.example.org`), the
domain must be on Cloudflare (free plan). Then: Worker › Settings › Domains & Routes › Add › Custom domain. Add the new
callback URL (`https://<new address>/api/auth/planning-center/callback`) to the OAuth application in Planning Center
**before** telling people the new address.

## Troubleshooting

| What you see | Likely cause |
|---|---|
| Build fails at "migrations apply" with an authentication or permission error | The build's API token can't edit D1: add **D1 Edit** to it (My Profile › API Tokens, the Workers Builds token) |
| Every page of the API says something went wrong; the Worker log mentions the session secret | `SESSION_SECRET` isn't set |
| "Planning Center sign-in isn't set up yet" on the sign-in screen | `PCO_CLIENT_ID` or `PCO_CLIENT_SECRET` isn't set |
| Planning Center shows an error about the callback or redirect address | The live callback URL isn't on the OAuth application, or doesn't match exactly |
| Team mapping says it couldn't reach Planning Center | The token is wrong, revoked or lacks Services; see `docs/planning-center.md` |
| A volunteer sees "The app is being set up" | Team mapping isn't finished (Service Type and at least one link) |
| The Worker log says "DEV_AUTH is set on a production Worker" | Delete `DEV_AUTH` from the Worker's Variables and Secrets |

Worker logs: Workers & Pages › `checklist` › Logs (observability is on in `wrangler.jsonc`).
