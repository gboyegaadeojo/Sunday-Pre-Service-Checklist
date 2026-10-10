# Sunday Pre-Service Checklist

A checklist app for the IFC media team. Volunteers use it to get the presentation station, audio, cameras and the rest of the booth ready before each service, and to wrap up afterwards, department by department. Everyone can see at a glance what's done and what's still open.

It's built for phones in a dark booth: a dark screen, large tap targets, and changes saved as you go.

## Who uses it

- **Volunteers** see their own department's checklist for the current service (or all departments, if they choose), check off tasks, and follow the whole team's progress.
- **Directors** can do everything volunteers can, plus reset the current service's checklist and undo a reset.
- **Technical Directors** see every department by default, with their own first. An Admin sets this up by marking their position "sees all departments", and usually gives them the Director role too.
- **Admins** run the app: they edit the checklist, task lists, team mapping, users and roles, and settings, and can review activity and service history.

Who someone is (Admin, Director or volunteer) is set inside the app by an Admin. Volunteers get in by being on a media team in the church's schedule. There must always be at least one Admin.

## What it does

- **Department checklists.** Tasks grouped by department and section. Scheduled volunteers see their own department first, with "Show all departments" to help elsewhere.
- **A fresh checklist for every service.** Check-offs belong to one service, so each new service starts unchecked and past ones are kept.
- **Progress dashboard.** Every department's progress at a glance, with who checked what and when. It refreshes itself every 30 seconds.
- **Reset and undo.** Admins and Directors can clear the current service's check-offs, and undo that if it was a mistake.
- **Everything is editable without a developer.** Admins add, rename, reorder, move and hide departments, sections and tasks. Hidden items can be restored with their history.
- **Task lists.** Separate lists (for example, for a special service), created empty or as a copy, with one chosen as the default.
- **Church settings.** The time zone, the service day, and the names shown in the app.
- **Team mapping.** Admins link the schedule's teams and positions to checklist departments. This decides who can use the app and which department each person sees first.
- **Service history.** Each past service: what was done and what wasn't ("X of Y done"), resets, and its activity.
- **Activity logs.** A permanent record of every check-off, reset, checklist edit, settings change, role change and mapping change, with who and when. Entries can never be edited or deleted.

## Sign-in

People will sign in with their **Planning Center** account, and the schedule comes from Planning Center Services. Planning Center sits behind replaceable interfaces, so another sign-in provider or scheduling system could be used later without losing people, roles or history.

Today the Planning Center connection isn't built yet (Stage 9; see Status). Locally, you sign in as built-in test users instead.

## Hosting

One Cloudflare Worker serves the app, with a Cloudflare D1 database, all on Cloudflare's **free plan**, so it costs nothing to host.

## Status

Built so far:

- **Stages 1–4:** the checklist, sign-in and roles, check-offs per service, the Progress dashboard, and reset and undo.
- **Stage 5:** the checklist editor, task lists, church settings, service history, and the record of each service's checklist.
- **Stage 6:** users and roles.
- **Stage 7:** team mapping (7a), access by team membership with each person's department view (7b), carrying on when Planning Center can't be reached (7c), and taking the current service's date from Planning Center plans (7d).

Next: a design review of every screen (Stage 8), the real Planning Center connection (Stage 9), and going live on Cloudflare (Stage 10).

The full plan is in [docs/build-plan.md](docs/build-plan.md).

## For developers

You need Node.js and npm.

```sh
npm install                      # also turns on the pre-commit checks
cp .dev.vars.example .dev.vars   # then fill in SESSION_SECRET (the file explains how)
npm run dev                      # sets up the local database and serves http://localhost:5173
npm run check                    # lint, type checks, tests and production build
```

`.dev.vars` holds local secrets. It's ignored by git and must never be committed.

Start with these:

- [CLAUDE.md](CLAUDE.md): how the code is organised, conventions, and the rules every change follows.
- [docs/requirements.md](docs/requirements.md): what the app must do (the user stories). It's the source of truth.
- [docs/design.md](docs/design.md): the design brief every screen follows.
- [docs/build-plan.md](docs/build-plan.md): the staged plan and database design.
