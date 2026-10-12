# Sunday Pre-Service Checklist

A checklist app for the IFC media team. Volunteers use it to get the presentation station, audio, cameras and the rest of the booth ready before each service, and to wrap up afterwards, department by department. Everyone can see at a glance what's done and what's still open.

It's built for phones in a dark booth: a dark screen (Light and System too), large tap targets, and changes saved as you go.

**Live at [checklist.media-5f7.workers.dev](https://checklist.media-5f7.workers.dev).** Sign in with your Planning Center account.

## Install it on your phone

The app can live on your home screen like any other app, with no app store:

- **Android, or a computer (Chrome or Edge):** open the app, tap your name (top right), then **Install app**.
- **iPhone or iPad:** open the app in Safari, tap your name, then **Add to Home Screen** for the steps (Share › Add to Home Screen › Add).

It opens full screen and stays signed in. It's the same app underneath, so it updates by itself and still needs an internet connection.

## Who uses it

- **Volunteers** see their own department's checklist for the current service (or all departments, if they choose), check off tasks, and follow the whole team's progress.
- **Directors** can do everything volunteers can, plus reset the current service's checklist and undo a reset. An Admin makes someone a Director permanently, or marks a position (such as Technical Director) so that whoever is scheduled in it is a Director for that service only.
- **Technical Directors** see every department by default, with their own first. An Admin sets this up by marking their position "sees all departments".
- **Admins** run the app: they edit the checklist, task lists, team mapping, users and roles, and settings, and can review activity and service history.

Who someone is (Admin, Director or volunteer) is set inside the app by an Admin; the only role that can come from the schedule is Director, and only for positions an Admin has chosen. Volunteers get in by being on a media team in the church's schedule. There must always be at least one Admin.

## What it does

- **Department checklists.** Tasks grouped by department and section. Scheduled volunteers see their own department first, and the department picker says whether it's "Your checklist" or you're helping out elsewhere.
- **A fresh checklist for every service.** Check-offs belong to one service, so each new service starts unchecked and past ones are kept.
- **Progress dashboard.** Every department's progress at a glance, with who checked what and when. It refreshes itself every 30 seconds.
- **Reset and undo.** Admins and Directors can clear the current service's check-offs, and undo that if it was a mistake.
- **Everything is editable without a developer.** Admins add, rename, reorder, move and hide departments, sections and tasks. Hidden items can be restored with their history.
- **Task lists.** Separate lists (for example, for a special service), created empty or as a copy, with one chosen as the default.
- **Church settings.** The time zone, the service day, and the names shown in the app.
- **Team mapping.** Admins link the schedule's teams and positions to checklist departments. This decides who can use the app and which department each person sees first.
- **Service history.** Each past service: what was done and what wasn't ("X of Y done"), resets, and its activity.
- **Activity logs.** A permanent record of every check-off, reset, checklist edit, settings change, role change and mapping change, with who and when. Entries can never be edited or deleted.
- **A calm, modern look.** Frosted-glass header, menus and dialogs over a soft colour backdrop, with task lists kept solid and easy to read. Every text colour passes accessibility contrast checks. Anyone can turn **Glass effects** off in the menu under their name.

## Sign-in

People sign in with their **Planning Center** account, and the schedule comes from Planning Center Services. Planning Center sits behind replaceable interfaces, so another sign-in provider or scheduling system could be used later without losing people, roles or history.

Planning Center sign-in and the schedule are connected ([docs/planning-center.md](docs/planning-center.md)). Locally the app still starts with built-in test users and a sample schedule, and can be switched to the real Planning Center.

## Hosting

One Cloudflare Worker serves the app, with a Cloudflare D1 database, all on Cloudflare's **free plan**, so it costs nothing to host. Every change pushed to the `main` branch on GitHub goes live automatically within a couple of minutes. Running it (secrets, backups, rolling back a bad update, release rules): [docs/deployment.md](docs/deployment.md).

## Status

Built so far:

- **Stages 1–4:** the checklist, sign-in and roles, check-offs per service, the Progress dashboard, and reset and undo.
- **Stage 5:** the checklist editor, task lists, church settings, service history, and the record of each service's checklist.
- **Stage 6:** users and roles.
- **Stage 7:** team mapping (7a), access by team membership with each person's department view (7b), carrying on when Planning Center can't be reached (7c), and taking the current service's date from Planning Center plans (7d).
- **Stage 8:** a design review of every screen, role and state ([docs/design-review.md](docs/design-review.md)), with all 20 findings fixed.
- **Stage 9:** the real Planning Center: sign-in, and the schedule read with the church's token ([docs/planning-center.md](docs/planning-center.md)).
- **Stage 10:** live on Cloudflare, with automatic deploys from GitHub, backups and rollback ([docs/deployment.md](docs/deployment.md)).
- **Stage 11:** the glass look, with a Glass effects switch.
- **Stage 12:** Scheduled Director: a position can give whoever is scheduled in it the Director role for that service.
- **Stage 13:** installable on phones and computers, named and iconed from Church settings.
- Also: a flag when someone is scheduled under a position name that matches nothing (e.g. after a rename in Planning Center), and a redesigned department picker on phones and tablets.

Next: the trial Sunday (October 18, 2026), then fixes from what the team finds.

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

Pushing to `main` deploys to the live app, so the release rules in [docs/deployment.md](docs/deployment.md) apply: no pushes from Saturday 6 PM until after the Sunday service unless it's urgent, existing database migrations are never changed, and the live database is exported before a push that adds one.

Start with these:

- [CLAUDE.md](CLAUDE.md): how the code is organised, conventions, and the rules every change follows.
- [docs/requirements.md](docs/requirements.md): what the app must do (the user stories). It's the source of truth.
- [docs/design.md](docs/design.md): the design brief every screen follows.
- [docs/build-plan.md](docs/build-plan.md): the staged plan and database design.
