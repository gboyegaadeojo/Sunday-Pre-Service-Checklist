# Planning Center setup

How the checklist app connects to Planning Center, and how to set it up or change it. For whoever manages the church's Planning Center account, and for developers. Requirements: US-01, US-02, US-04a/b, US-05, US-07, US-15, US-16, US-17 and Q7 in `docs/requirements.md`.

## What the app uses

The app needs two separate things from Planning Center. Both are created at **https://api.planningcenteronline.com** by someone who manages the church's Planning Center account.

| | Personal Access Token | OAuth application |
|---|---|---|
| **For** | Reading the church's schedule: Service Types, teams, positions, who's on which team, plans and who's scheduled | Volunteers signing in with their own Planning Center account |
| **Values** | Application ID and Secret | Client ID and Secret |
| **Settings** | `PCO_PAT_ID`, `PCO_PAT_SECRET` | `PCO_CLIENT_ID`, `PCO_CLIENT_SECRET` |
| **What it can do** | Whatever its owner can do in Planning Center, but the app only ever **reads** with it (GET requests) | Only **People**: who the person is (name, photo, Planning Center ID). Their token is used once and thrown away |

All four values are secrets:
- **Locally**, they go in `.dev.vars`, which is gitignored. `.dev.vars.example` lists them with notes. The dev server reads `.dev.vars` only at startup, so restart `npm run dev` after changing it.
- **In the live app**, they're Cloudflare Worker secrets (Stage 10, `docs/deployment.md`).
- They're never committed, pasted into chats or issues, or sent to the browser. The pre-commit hook refuses lines that look like secrets.

### Whose token it is

For now, the Personal Access Token belongs to the Admin who manages the church's Planning Center account. A token acts with its owner's Planning Center permissions, and stops working if that person's access changes. It could later move to a dedicated **"Media App"** Planning Center account with **view-only Services access**, so it doesn't depend on one person. To switch:
1. Create a token on that account (with Services enabled; see below).
2. Replace `PCO_PAT_ID` and `PCO_PAT_SECRET`.
3. Delete the old token.

Nothing else changes.

## Creating the Personal Access Token

1. At api.planningcenteronline.com, open **Personal Access Tokens** → **New Personal Access Token**.
2. Description: `IFC Pre-Service Checklist – schedule (read only)`.
3. **Make sure Services is included.** A token limited to People works for People but gets **401 Unauthorized** from Services, and the app then can't read teams or plans. This happened during setup. The fix was a new token with Services enabled.
4. Copy the **Application ID** into `PCO_PAT_ID` and the **Secret** into `PCO_PAT_SECRET`.

The token's owner needs access to **Services** in Planning Center: Viewer is enough.

## Creating the OAuth application

1. At api.planningcenteronline.com, open **OAuth Applications** → **New Application**.
2. Fill in:
   - **Name:** `IFC Pre-Service Checklist`.
   - **Description:** `Sign-in for the IFC media team's pre-service checklist. It only reads who you are.`
   - **Support URL:** the church's website.
   - **Application type: Confidential.** The secret stays on the server and the code exchange happens in the Worker.
   - **Authorization callback URLs**, one per line:
     - Local: `http://localhost:5173/api/auth/planning-center/callback`
     - Live (Stage 10): `https://<the app's address>/api/auth/planning-center/callback`
3. Copy the **Client ID** into `PCO_CLIENT_ID` and the **Secret** into `PCO_CLIENT_SECRET`.

The callback URL must match exactly: `http` vs `https`, the port, and no slash at the end. Callback URLs can be added later, so the live one doesn't need to exist yet when the app is created.

## Using the real schedule locally

Locally the app uses a **sample schedule** and **test users** by default, and the tests always do. To use the real Planning Center on your computer:
1. Set `SCHEDULE_SOURCE=planning_center` in `.dev.vars`.
2. Restart `npm run dev`.
3. In **Administrative Settings › Team mapping**, choose the Service Type (e.g. *479 Sunday Service*) and link the positions.

To go back, remove that line and restart. Mappings for the sample and the real schedule are kept separately.

The live app always uses Planning Center when the token is set. The sample schedule, the test users and the `SCHEDULE_SOURCE` switch don't exist in the live app (the production-build test checks this).

## Signing in and roles

- **"Sign in with Planning Center"** works once the OAuth application is configured. The person approves the app on Planning Center's page and comes back signed in.
- **Roles never come from Planning Center.** Someone signing in for the first time is a Volunteer if they're on a linked team, and has no access otherwise. Admins grant Admin or Director on **Users & Permissions**.
- **Access** is decided by the team roster (being on a linked team), not by being scheduled this week (US-02).
- **The very first Admin:**
  - Locally, an existing Admin (the developer "Test Admin") grants it.
  - In the live app, it's set once in the database after that person's first sign-in (Stage 10, `docs/deployment.md`).

## How people are matched to positions

- **Team mapping links** are stored by Planning Center's **IDs**, so renaming a team or position in Planning Center doesn't break a link. The mapping screen shows the new name on its next refresh: within 5 minutes, or straight away with **Refresh from Planning Center**.
- **Team membership** (who can get in) is also read by ID.
- **Who's scheduled where on a plan** is the exception. Planning Center gives the person's team by ID but their position **only by name**, so the app matches that name (ignoring capitals and extra spaces) to a position in that team, then uses its link.
- **If a position is renamed:**
  - People scheduled afterwards carry the new name and match once the app's cached position list refreshes.
  - People scheduled before the rename may still carry the old name in Planning Center. If so, it matches nothing. They then follow the team's link if the team has one; otherwise they see "Your position isn't linked to a checklist department yet, so choose yours below." They can still get in and check off tasks; they pick their department by hand (remembered for the day).
  - Re-saving that person's assignment in Planning Center refreshes the name.
- **This isn't flagged to Admins yet:** the mapping screen's warnings are by ID. A "Needs attention" item for unmatched position names has been proposed.

## When Planning Center is down

- **Schedule:**
  - Every call gives up after 5 seconds, and the app then leaves Planning Center alone for a minute.
  - People confirmed on a team in the last 90 days carry on.
  - The checklist asks everyone to pick their department.
  - Check-offs, Progress, reset and undo all keep working (US-04a).
- **Sign-in:** people without a session see "Planning Center sign-in is temporarily unavailable. Please try again shortly." Existing sessions (30 days) carry on (US-04b).

## Troubleshooting

| What you see | Likely cause |
|---|---|
| Team mapping says it couldn't reach Planning Center; the server log says "refused the schedule token (401)" | The token is wrong, revoked, or **doesn't include Services** |
| Planning Center shows an error about the redirect or callback address when signing in | The callback URL isn't registered on the OAuth application, or doesn't match exactly |
| "Planning Center sign-in isn't set up yet" on the sign-in screen | `PCO_CLIENT_ID`/`PCO_CLIENT_SECRET` aren't set (or the dev server wasn't restarted) |
| Someone gets "Media team only" | They aren't on a team linked in Team mapping (check the team's roster in Planning Center Services) |
| Someone scheduled sees "choose your department" | Their position isn't linked (Team mapping), or its name on the plan doesn't match (see above) |
