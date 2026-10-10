# Church Media Team Checklist App — Requirements

> **Version:** 1.20 · **Date:** October 2026  
> **Audience:** Security Architect / Project Owner  
> **Status:** All decisions closed — ready for build

---

## 0. Changes in Version 1.20

| # | Change | Why |
|---|--------|-----|
| C31 | **Administrative Settings is opened from the menu under an Admin's name** instead of an Admin tab in the header, which now shows only Checklist and Progress. It has its own sections (Overview, Checklist Management, Team mapping, Users & Permissions, Activity, History, Church settings), a sidebar on wide screens, a section selector on phones and a breadcrumb. Nobody but Admins sees it, and the server still refuses everyone else. Reset and undo stay on the Progress page for Admins and Directors. | Administration is occasional work for a few people; the header stays focused on what everyone uses on Sunday. |
| C32 | **Church settings is a section of Administrative Settings** (US-11a), replacing the separate Settings item in the name menu (C26). The old address still works. | One place for everything church-wide; the name menu keeps personal items. |
| C33 | **Appearance: Dark, Light or System** (US-08a), chosen by each person on My Preferences (in the name menu) and remembered on that device. **Dark is the default**; System follows the device's light or dark setting. "Themes" is no longer out of scope; custom branding colours still are. | Dark suits the booth, but some volunteers prepare at home or in daylight, where a light theme is easier to read. |

## Changes in Version 1.19

| # | Change | Why |
|---|--------|-----|
| C30 | **Until team mapping is set up, only Admins and Directors get in** (US-02). Before an Admin has chosen the Service Type and linked at least one team or position, nobody can be confirmed as a media team member, so everyone else sees "The app is being set up. Check back soon." | The app must not be shared with volunteers half-configured, and can't tell who belongs until the mapping exists. |

## Changes in Version 1.18

| # | Change | Why |
|---|--------|-----|
| C29 | **Team mapping keeps Admins up to date** (US-15): a "Refresh from Planning Center" button fetches teams and positions straight away instead of waiting for the cache, and Admins see a notice, on the mapping screen and on its tab, when a position on a media team isn't linked to a department or a link points to something deleted in Planning Center. A team with no links shows an informational "new team" note until an Admin links it or marks it "Not a media team" (once per team; undoable). Mapping changes are logged like other admin changes. | A position added in Planning Center should be linked before Sunday, not discovered when a volunteer can't find their department. |

## Changes in Version 1.17

| # | Change | Why |
|---|--------|-----|
| C28 | **There must always be at least one Admin** (US-03). Removing the Admin role from the last Admin is refused, even when two Admins remove each other at the same moment. An Admin removing their own Admin role is asked to confirm first, even when other Admins exist. | Without an Admin, nobody could manage the checklist, people or settings, and only a developer could fix it. |

## Changes in Version 1.16

| # | Change | Why |
|---|--------|-----|
| C27 | **New: each service keeps a record of its checklist** (new US-07b): every task on it while the service was current, including tasks added, moved, renamed or hidden during it, frozen when the service ends. Service history shows "X of Y done" overall and per department, the tasks that weren't checked, and the tasks removed during the service. | Past services could only show what was checked; the record shows what was missed, matching what volunteers saw. |

## Changes in Version 1.15

| # | Change | Why |
|---|--------|-----|
| C26 | **Admins open Settings from the menu under their name** in the header, above Sign out, instead of from the Admin area (US-11a). Nobody else sees that menu item, and the server still refuses them. The old address still works and leads to the new one. | Settings are church-wide and rarely changed, so they sit with the account controls rather than among the checklist tools. |

## Changes in Version 1.14

| # | Change | Why |
|---|--------|-----|
| C24 | **A scheduled volunteer sees only their own department(s) by default** (US-05). A "Show all departments" control shows the rest, where they can also check off tasks (e.g. covering for someone). Volunteers who aren't scheduled, or whose position has no link, see all departments and choose theirs, as before. Admins, Directors and Technical Directors (a position an Admin marks "sees all departments" in the team mapping, US-15) see all departments by default. | A shorter, focused checklist for most volunteers, without stopping anyone from helping another department. Built in Stage 7. |
| C25 | **List names are unique among visible lists**, ignoring capitalization and extra spaces (US-11). | Two lists with the same name would be impossible to tell apart when copying or choosing the default. |
| — | Added to "Later": choosing a list for a specific service date, and carrying Planning Center links over to copied lists. For Version 1, admins switch the default list before a special service and switch it back afterward (US-11). | Recorded now; not built. |

## Changes in Version 1.13

| # | Change | Why |
|---|--------|-----|
| C23 | **Task lists in detail** (US-11): a new list can start empty or as a copy of another; lists can be hidden and restored, but never the default list or the one the current service uses; changing the default can also switch the current service while it has no check-offs; every list change is logged (US-13b). | Lets admins prepare special-service lists safely, and records who changed the default. |

## Changes in Version 1.12

| # | Change | Why |
|---|--------|-----|
| C21 | **New: every user has an app account with its own internal ID** (new US-03a). Sign-in accounts (Planning Center today) are *linked* to it. Roles, check-offs, resets and both activity logs refer to the internal ID, never to a Planning Center ID. | The church may stop using Planning Center. People, roles and history must survive a change of sign-in provider. |
| C22 | **Planning Center is a replaceable source** (Architecture Note, US-15): sign-in and teams/schedules each sit behind an interface, and the database stores outside references in provider-neutral columns. | The app must keep working, and be adaptable, without Planning Center. |
| — | Added to "Later": Google sign-in with admin invite or approval; a "choose your position" screen as the normal way to pick a checklist when no scheduling system is used. | Recorded now so the design leaves room for them. Not built. |

## Changes in Version 1.11

| # | Change | Why |
|---|--------|-----|
| C19 | **New: Hidden items view with Restore** (new US-13a). Admins see everything hidden from the list and can bring it back with its history, in its old position where possible. Restoring something inside a hidden department or section explains why and offers to restore the parent too. | Hiding never erases, so a mistaken hide must be easy to undo without a developer. |
| C20 | **New: append-only log of checklist edits** (new US-13b): every add, rename, edit, hide, restore, move and reorder, with who, when, and the before and after values. Admins see it in the Activity view, filtered to check-offs or checklist edits (US-07a). | A record of who changed the checklist and how, with the same protection as the check-off log. |

## Changes in Version 1.10

| # | Change | Why |
|---|--------|-----|
| C16 | **New: append-only activity log** of every check, uncheck, reset, and undo, with who, when, which task, and which sign-in session and browser tab; Admins can review it per service (new US-07a). | A permanent safety net: any unexpected check-off can be traced, and the record can't be altered. |
| C17 | **The open checklist updates itself** about every 30 seconds while visible and right after returning to the tab (US-06). | Resets and teammates' check-offs appear without reloading. |
| C18 | **Reset is refused when nothing is checked; undo applies once, to the latest reset** (US-07). | An accidental extra reset must never take away the chance to undo the real one. |

## Changes in Version 1.9

| # | Change | Why |
|---|--------|-----|
| C15 | **Church-specific settings are admin-editable** (new US-11a): time zone and service weekday (seeded America/Winnipeg and Sunday), and the branding shown in the app (short name, team name, app name). US-05, US-07 and the decisions table now refer to the configured service day and time zone instead of fixed values. | The church will keep changing; nothing church-specific may be hardcoded. |

## Changes in Version 1.8

| # | Change | Why |
|---|--------|-----|
| C14 | **Admins can restructure the checklist freely** (US-12, US-12a, US-13): move a task to any section in any department, move a whole section to another department, and reorder departments, sections, and tasks, using a "Move to…" menu that works on a phone. Check-offs now also snapshot the department and section (US-06), so past services show tasks where they were at the time. | The seeded checklist is only a starting point. Which department owns a task must be data the admins control, never fixed in code. |

## Changes in Version 1.7

| # | Change | Why |
|---|--------|-----|
| C13 | **Seed checklist matches the church's Planning Center positions** (Audio, Camera 1, Camera 2, Propresenter, Production Director, Miscellaneous, Technical Director). New sixth department **Technical Director**; **After Service** sections added to Presentation / Computer Graphics, Audio Engineer, Camera Operators, Director (Switcher), and Miscellaneous (Section 6, US-14). | Every Planning Center position now has a matching checklist department, and shutdown work is tracked. |

## Changes in Version 1.6

| # | Change | Why |
|---|--------|-----|
| C12 | **The progress view is available to everyone with access** (Volunteers, Admins, Directors), not only Admins and Directors (US-09, US-10). Reset/undo remain Admin/Director only; list management and team mapping remain Admin only. | Project owner decision. |

## Changes in Version 1.5

| # | Change | Why |
|---|--------|-----|
| C9 | **New: Admins manage sections within a category** (US-12a). | The seed checklist groups tasks into numbered sections, but no story covered editing them. |
| C10 | **Each Planning Center team or position links to only one category** (US-15). | Keeps the mapping unambiguous. A category can still have many teams/positions. |
| C11 | **Undoing a reset keeps newer check-offs** (US-07). | A task checked again after a reset must not be overwritten by the archived check-off. |

## Changes in Version 1.4

| # | Change | Why |
|---|--------|-----|
| C1 | **Hosting moved to Cloudflare Workers (free) + Cloudflare D1 database (free).** Vercel and Supabase removed. | Must be free to host. Vercel's free Hobby plan is limited to personal, non-commercial use, which makes church use a gray area. Supabase's free plan can pause projects after 7 days of low activity, which is exactly the pattern of a once-a-week app. Cloudflare's free tier has neither problem. |
| C2 | **New: Planning Center team → category mapping** (US-15). | The app had no defined way to turn a Planning Center team/position into a checklist category. |
| C3 | **US-04 split** into "schedule lookup fails" (fallback works) and "Planning Center sign-in is down" (long sessions keep people signed in). | You can't sign in with Planning Center while Planning Center sign-in is down. |
| C4 | **Access is based on team membership, not this week's schedule.** Admins and Directors always get in. | Last-minute subs, off-week admins, and troubleshooting would otherwise be locked out on Sunday morning. |
| C5 | **Automatic 9 PM reset removed; manual reset limited to Admins/Directors and made undoable.** | Per-service storage already gives every Sunday a fresh checklist. One mis-tap by anyone could erase everyone's progress. |
| C6 | **"Current service" defined; all times in America/Winnipeg.** | The server runs in UTC. |
| C7 | **Database access is server-only; schedule data read with a church-level token.** | No database credentials ever reach the browser. Volunteer accounts may not have permission to read team data. |
| C8 | **Deleted tasks/categories are hidden, not erased.** Check-offs store a snapshot of the task text. | Past service records must not break when lists change. |

---

## 1. Scope Summary

A mobile-friendly web app for a church's media/production volunteers. Volunteers sign in with Planning Center, see their department's checklist for the current service, and check off tasks. Everyone on the team can follow overall progress. Admins manage lists and link Planning Center teams to checklist categories. The app must cost $0/month to host.

---

## 2. Roles

| Role | Description |
|------|-------------|
| **Volunteer** | A member of a linked media team in Planning Center (see US-15). When scheduled, sees their own categories by default and can show all of them; otherwise sees all categories (US-05). Checks off tasks in any category. Sees the progress view. |
| **Admin** | Manages task lists, categories, tasks, and team mappings. Sees full progress. Can grant/revoke Admin and Director roles. Can reset or restore a service checklist. Reviews the activity log (US-07a). Always has access, scheduled or not. |
| **Director** | Sees the progress view. Can reset or restore a service checklist. No list-management or team-mapping permissions. Always has access, scheduled or not. |
| **Not on a media team** | Signed in with Planning Center but not a member of any linked team and has no Admin/Director role. Sees an explanation page only. |

---

## 3. User Stories & Acceptance Criteria

### 3.1 Authentication & Access

---

**US-01 — Sign in with Planning Center**  
*As a volunteer, I want to sign in using my Planning Center account so I don't need a separate password.*

**Acceptance Criteria:**
- Sign-in page shows a "Sign in with Planning Center" button.
- Clicking it redirects to Planning Center's OAuth consent screen.
- After authorization, the user is returned to the app and their name/avatar are shown.
- The OAuth code exchange (including the client secret) happens server-side in the Cloudflare Worker. The secret is never sent to the browser or stored in the code repository.
- The volunteer's Planning Center access token is used only to identify who they are (Planning Center person ID, name, avatar). It is not stored after sign-in.
- The app creates its own session: a signed, HttpOnly, Secure cookie valid for **30 days**, renewed on each visit.
- If Planning Center is unreachable during sign-in, the user sees a clear error message, not a blank screen.

---

**US-02 — Access is based on media team membership**  
*As a volunteer, I want to get in whenever I'm part of the media team — including when I'm a last-minute sub who isn't on this week's schedule.*

**Acceptance Criteria:**
- After sign-in, the app checks whether the user is a member of any Planning Center team that an Admin has linked to a category (US-15). Membership in the team roster is enough; being scheduled this week is not required.
- Users with the Admin or Director flag always have access, regardless of team membership or schedule.
- A user who is on a linked team but not scheduled for the current service sees the full checklist with a note: "You're not on the schedule for this service, but you can still help."
- A user who is not on any linked team and has no role sees: "This app is for the media team. If you think you should have access, contact a media team admin." They cannot see checklists or admin functions.
- When the app verifies a user's team membership, it records the date of that check (used by US-04).
- **Until team mapping is set up** (no Service Type chosen, or no team or position linked yet, US-15), only Admins and Directors get in. Everyone else sees: "The app is being set up. Check back soon."

---

**US-03 — Admin and Director are recognized at sign-in**  
*As an admin, I want the app to recognize my elevated role without me having to do anything extra.*

**Acceptance Criteria:**
- Admin and Director status are stored as flags on the user record in the app's database, keyed by Planning Center person ID.
- The first admin is seeded at deployment time (documented in the deployment guide).
- An admin can grant or revoke Admin and Director flags for other users from within the app.
- **There must always be at least one Admin.** The server refuses to remove the Admin role from the last Admin ("You can't remove the last Admin. Make someone else an Admin first."), including when two Admins try to remove each other at the same moment.
- An Admin removing their own Admin role is asked to confirm first, even when other Admins exist.
- Roles are checked on the server on every request, so revoking access takes effect on the user's next page load.
- Admin-only UI is hidden from non-admins, and admin actions are rejected by the server for non-admins even if called directly.

---

**US-03a — Each person has one app account, whatever they sign in with**  
*As the project owner, I need people, roles and history to belong to the app, so changing sign-in providers never loses them.*

**Acceptance Criteria:**
- The app creates a user record with its own internal ID the first time someone signs in. The ID never changes and is never reused.
- Sign-in accounts are linked to that user: today a Planning Center person ID, later possibly others (e.g. Google). Each sign-in account links to exactly one app user; a user may have several.
- Admin and Director flags (US-03), check-offs and uncheck records (US-06), resets and undos (US-07), and both activity logs (US-07a, US-13b) refer to the internal user ID, alongside the person's name as it was at the time.
- The session identifies the internal user, not the sign-in account.
- A Planning Center person ID is used only to sign in and to look up teams and schedules. It is never sent to the browser.
- Removing or replacing a sign-in provider never orphans a user's roles or history.

---

**US-04a — Schedule lookup fails, but sign-in works**  
*As a volunteer on Sunday morning, I need to use the checklist even if Planning Center's data can't be loaded.*

**Acceptance Criteria:**
- If the user is signed in (new or existing session) but the Planning Center Services API fails or times out (within 5 seconds), the app does not block.
- Access is granted if the user has an Admin/Director flag, or was verified as a media team member within the last 90 days.
- The user sees all categories and picks their own department manually. The choice is remembered on that device for the day.
- A banner is shown: "We couldn't load your schedule from Planning Center. Please select your department."
- Check-off functionality works normally in fallback mode.
- A user who has never been verified sees: "We couldn't reach Planning Center to confirm your team. Please try again in a few minutes."

---

**US-04b — Planning Center sign-in is down**  
*As a volunteer, I don't want a Planning Center outage on Sunday morning to lock me out.*

**Acceptance Criteria:**
- Users with an existing session (30 days, US-01) are not asked to sign in again and continue working normally, using the US-04a fallback if schedule data is unavailable.
- Users without a session see: "Planning Center sign-in is temporarily unavailable. Please try again shortly."
- The deployment guide recommends that every volunteer sign in once during the week, so sessions are active on Sunday.

---

### 3.2 Running a Checklist

---

**US-05 — Volunteer sees their department's checklist**  
*As a volunteer, when I open the app on a service day, I want to immediately see the tasks for my department.*

**Acceptance Criteria:**
- The app determines the **current service** (US-07) and looks up the user's team and position assignment for it in Planning Center Services.
- **Scheduled volunteer:** using the team mapping (US-15), the checklist shows only the user's own category by default. If they're scheduled on several teams or positions, all of their categories are shown.
- A **"Show all departments"** control shows the other categories, after the user's own, and the user can check off tasks there too (e.g. covering for someone). It stays on for the rest of the day on that device until they turn it off. The control only changes what's shown: the server accepts a check-off on any task in the current service from anyone with access (US-06), so hiding other departments never blocks help.
- **Not scheduled, or no link:** if the user is a team member but not scheduled, or their team/position has no mapping, all categories are shown with none highlighted, and they can choose their department (remembered on that device for the day).
- **Admins, Directors and Technical Directors see all categories by default**, with their own scheduled categories (if any) shown first and highlighted. A Technical Director is anyone scheduled in a position an Admin has marked **"sees all departments"** in the team mapping (US-15). Which positions those are is data, never code.
- The progress view (US-09) always covers every category, whatever the checklist shows.
- If no service is published in Planning Center, the user sees the default checklist for the upcoming service day (US-07) with a note: "No service is published in Planning Center yet — your checklist is ready when you are."

---

**US-06 — Volunteer checks off a task**  
*As a volunteer, I want to tap a task to mark it complete so the team can track progress.*

**Acceptance Criteria:**
- Each task has a tap target of at least 44×44 px.
- Tapping marks the task complete and records the volunteer's display name, Planning Center person ID, a timestamp, and a snapshot of the task text, its department, and its section at that moment (US-13).
- The UI updates immediately (optimistic update). If the save fails, the checkmark reverts and a brief error message appears.
- A completed task can be unchecked. Unchecking records who unchecked it and when.
- The open checklist refreshes itself about every 30 seconds while the page is visible, and right after the user returns to it, so resets and teammates' check-offs appear without reloading. A refresh never undoes a tap that is still saving.

---

**US-07 — Each service has its own checklist**  
*As a volunteer, I want this Sunday's checklist to be clear even though last week's data is still saved.*

**Acceptance Criteria:**
- Check-off state is stored per service, not per list definition. A new service automatically starts with every task unchecked — no scheduled reset job is needed.
- **Current service** is defined as: the Planning Center plan, in the Service Type selected by an Admin (US-15), with the earliest date that is today or later. A service stays "current" until 11:59 PM on its date.
- If no plan is published, the current service is the next **service weekday** (or today, if today is that weekday).
- All dates and times use the church's **time zone**, including daylight saving changes, even though the server runs in UTC.
- The service weekday and time zone are settings an Admin can change in the app (US-11a). They are seeded as Sunday and America/Winnipeg; neither is fixed in code.
- Admins and Directors can manually reset the current service's checklist. Volunteers cannot.
- Reset shows a confirmation prompt: "This will clear all check-offs for this service. Are you sure?"
- A reset is not destructive: cleared check-offs are archived, and an Admin or Director can restore them with an "Undo reset" option until the next reset.
- If a task was checked again after the reset, undoing the reset keeps the newer check-off; the archived one for that task is not restored.
- Reset is refused when nothing is checked, so an accidental extra reset can never take away the chance to undo an earlier one. Undo applies once, to the latest reset.
- Past service check-off data is preserved and accessible to admins.

---

**US-07a — Admin reviews the activity log**  
*As an admin, I want a permanent record of every check-off change, so I can see exactly who changed what if something looks wrong.*

**Acceptance Criteria:**
- Every check, uncheck, reset, and undo that reaches the server is logged, including attempts that changed nothing or were refused (e.g. the service had ended), with: who, when, which task (or how many check-offs a reset/undo affected), the outcome, the sign-in session, and the browser tab.
- Each log entry is written in the same transaction as the change it describes.
- The log is append-only: entries can never be edited or deleted, by anyone, through the app or directly in the database.
- Admins can view the log for the current service, newest first; past services' logs are part of service history. Directors and Volunteers cannot see it, and the server rejects their requests.
- The Activity view also shows checklist edits (US-13b), with a filter to show check-offs, checklist edits, or both.

---

**US-07b — Each service keeps a record of its checklist**
*As an admin, I want to see what was and wasn't done at a past service, so we can spot what keeps getting missed.*

**Acceptance Criteria:**
- While a service is current, the app records every task on its checklist: the tasks there when the service starts, plus any added, moved, renamed or hidden during it. Each change to the record happens in the same transaction as the checklist edit that caused it.
- The record stops changing when the service ends, at midnight after the service date in the church's time zone (US-11a). Later checklist edits never change a past service's record.
- Service history shows, for a recorded service, "X of Y done" overall and per department, and every task on the checklist when the service ended, where it was then, checked or not. A checked task whose text changed afterwards also shows the text it was checked under.
- Tasks hidden during the service are listed separately ("Removed during the service"), with when, and are not counted. A task restored before the service ended counts again.
- If the current service switches to another list (allowed only before anything is checked, US-11), its record starts over from the new list.
- Services from before this feature have no record: history shows their checked tasks only, without totals, and says why. For the service that was current when the feature arrived, the record starts at that moment, and history says so.
- Only Admins can see service history; the server rejects anyone else.

---

**US-08 — Checklist works on phones and tablets**  
*As a volunteer working in the booth or on the floor, I want the app to work well on my phone.*

**Acceptance Criteria:**
- Responsive layout tested at 375px (phone) and 768px (tablet) widths.
- Text readable without zooming; no horizontal scrolling.
- Supports a dark theme suitable for low-light booth conditions; tap targets per US-06.

---

**US-08a — Each person chooses Dark, Light or System appearance** *(v1.20)*  
*As a volunteer, I want to pick how the app looks on my device, so it's comfortable in the booth and in daylight.*

**Acceptance Criteria:**
- **My Preferences**, opened from the menu under the person's name, offers **Dark**, **Light** and **System**. A choice applies at once, with no Save button.
- **Dark is the default** on any device that hasn't chosen. **System** follows the device's light or dark setting and changes with it, without a reload.
- The choice is remembered on that device only (it's not sensitive and needs no server). It's applied before the page first draws, so there's no flash of the wrong theme.
- Every screen follows it, and both themes meet WCAG 2.1 AA contrast, including status colours.

---

### 3.3 Progress View

---

**US-09 — The team sees overall service progress**  
*As a media team member, I want a dashboard showing which departments are done and which have open tasks.*

**Acceptance Criteria:**
- Progress view is accessible to everyone with access (US-02): Volunteers, Admins, and Directors. Users who are not on a media team cannot see it.
- Each category shows: total tasks, completed count, and a color indicator (green = all done, yellow = in progress, grey = not started). Color is never the only indicator; counts and labels are always shown.
- Expanding a category shows which volunteer checked off each task and at what time.
- View refreshes automatically about every 30 seconds while open, and shows a "last updated" time with a manual refresh button.

---

**US-10 — Director resets and restores without editing lists**  
*As the Director, I want to reset or restore the service checklist from the progress view, but I don't need list management tools.*

**Acceptance Criteria:**
- Director role sees the full progress view (as does everyone with access, US-09), plus the reset and "Undo reset" controls (US-07).
- Reset and "Undo reset" are visible only to Admins and Directors, and the server rejects them from anyone else.
- List management and team mapping UI is not visible to Directors, and the server rejects those actions from Directors.
- Director role is granted by an Admin within the app.

---

### 3.4 Task List Management (Admin)

---

**US-11 — Admin creates a new task list**  
*As an admin, I want to create named task lists for different scenarios.*

**Acceptance Criteria:**
- Admin can create a list with a name and optional description, starting empty or as a copy of another live list (its departments, sections and tasks in order; hidden items and Planning Center links are not copied).
- Admin can rename a list and change its description.
- List names are unique among visible lists, ignoring capitalization and extra spaces. A name that's taken is refused with a clear message. A hidden list's name is free to reuse, so restoring a hidden list is refused while a visible list has its name; the admin renames that list first.
- One list can be set as the default for regular services. New services use the default; a service keeps the list it started with. When changing the default, the admin may also switch the current service to it, but only while that service has no check-offs.
- Lists appear in an admin management view, the default first, with which list the current service uses.
- Admin can hide a list and restore it. The default list and the list the current service uses can't be hidden. A hidden list can't be edited or copied; past services that used it keep their records.
- Every list change (create, rename, set default, hide, restore) is logged like other checklist edits (US-13b).

---

**US-11a — Admin edits church settings**  
*As an admin, I want to change the church's settings in the app, so nothing church-specific needs a developer.*

**Acceptance Criteria:**
- Admin can edit the **time zone** (validated as a real IANA time zone, e.g. America/Winnipeg) and the **service weekday** (US-07).
- Admin can edit the **branding** shown in the header, on the sign-in screen, and in the browser tab: short name (logo mark), team name, and app name. Empty values are simply left out of the display.
- Seeded starting values: America/Winnipeg, Sunday, "IFC", "IFC Production", "Pre-Service Checklist".
- Changes take effect on the next page load. Only Admins can change settings; the server rejects anyone else.
- Admins open **Church settings** in Administrative Settings, from the menu under their name in the header (v1.20). Nobody else sees it.
- The branding values are readable without signing in (the sign-in screen shows them); no other setting is exposed publicly.

---

**US-12 — Admin manages categories within a list**  
*As an admin, I want to add, rename, reorder, and delete department categories within a list.*

**Acceptance Criteria:**
- Admin can add, rename, delete (with confirmation + warning if tasks exist), and reorder categories.
- Reorder with up/down controls or a "Move to…" menu that work on a phone. Drag-and-drop may be added on desktop but is never the only way.
- Deleting a category hides it from current and future checklists but keeps it in the database, so past service records still display correctly. A deleted category's team mappings are removed, with a warning shown first.
- Changes are immediately live for the next volunteer who loads the checklist.

---

**US-12a — Admin manages sections within a category**  
*As an admin, I want to add, rename, reorder, move, and delete the numbered sections inside a department so the checklist matches how we actually work.*

**Acceptance Criteria:**
- Admin can add, rename, delete (with confirmation + warning if tasks exist), and reorder sections within a category.
- Admin can move a whole section, with all its tasks, to a different department in the same list using a "Move to…" menu that works on a phone. The section is placed at the end of the destination department and can then be reordered.
- Reorder with up/down controls or the "Move to…" menu. Drag-and-drop may be added on desktop but is never the only way.
- Moving a section never changes past service records, and existing check-offs on its tasks stay attached (US-13).
- Deleting a section hides it and its tasks from current and future checklists but keeps them in the database, so past service records still display correctly.
- Changes are immediately live for the next volunteer who loads the checklist.

---

**US-13 — Admin manages tasks within a category**  
*As an admin, I want to add, edit, reorder, move, and delete individual tasks as the team streamlines its workflow.*

**Acceptance Criteria:**
- Admin can add, edit, delete (with confirmation), and reorder tasks within a section.
- Admin can move a task to any other section in the same list, including a section in a different department, using a "Move to…" menu (choose department, then section) that works on a phone. The task is placed at the end of the destination section and can then be reordered. Drag-and-drop may be added on desktop but is never the only way.
- Tasks, sections, and departments can only be moved to live (not deleted) destinations.
- No limit to the number of tasks per category.
- **History rule:** moving a task or section never changes past records. Each check-off stores a snapshot of the task text, department, and section at check-off time (US-06), so past services show tasks where they were back then.
- Moving a task during a live service keeps any existing check-off on it. The current service's checklist and progress view show the task, still checked, in its new place; the check-off record keeps the department and section it was checked in.
- Which department or section a task belongs to is data that admins control. Nothing about it is hardcoded in the application; the seeded checklist (US-14) is only a starting point.
- If a task is edited while a service is in progress, existing check-offs remain linked to the task. Past records show the task text snapshot saved at check-off time (US-06).
- Deleting a task hides it from current and future checklists but keeps it in the database, so past service records are never broken.
- No developer involvement required — all changes happen through the admin UI.

---

**US-13a — Admin restores hidden items**  
*As an admin, I want to bring back a department, section, or task that was hidden by mistake.*

**Acceptance Criteria:**
- A "Hidden items" view lists every hidden department, section, and task in the list, newest first, showing where each one was and when it was hidden.
- Restore brings the item back as it was. It's the same item, so its check-off history stays attached, and it returns to its old position among its siblings where possible.
- Restoring a department or section also brings back everything inside it that wasn't hidden on its own. Items hidden on their own stay hidden until restored separately.
- Restoring a task or section whose department or section is still hidden explains that the parent must come back first, and offers to restore the parent too in the same step. The server never restores an item into a hidden parent.
- Planning Center links removed when a department was hidden (US-12) are not restored; admins link the teams again.
- Restored items are live immediately for the next volunteer who loads the checklist. Admins only; the server rejects anyone else.

---

**US-13b — Checklist edits are logged**  
*As an admin, I want a permanent record of changes to the checklist, so I can see who changed what and what it was before.*

**Acceptance Criteria:**
- Every add, rename, edit, hide, restore, move, and reorder of a department, section, or task, and every change to a task list or the default list (US-11), is logged with who, when, the sign-in session and browser tab, the item, and its before and after values (e.g. old and new text, old and new section).
- Each entry is written in the same transaction as the change it describes.
- The log is append-only: entries can never be edited or deleted, by anyone, through the app or directly in the database.
- Admins see it in the Activity view (US-07a), filtered to check-offs, checklist edits, or both. Directors and Volunteers cannot see it, and the server rejects their requests.

---

**US-14 — Pre-service checklist is seeded on first launch**  
*As an admin, I want the existing printed checklist already in the app when we go live.*

**Acceptance Criteria:**
- The app is deployed with the IFC Pre-Service Checklist (Section 6) pre-loaded as the default list.
- All 6 departments (Presentation/Computer Graphics, Audio Engineer, Camera Operators, Director, Miscellaneous, Technical Director) with their sections and tasks are present.
- The seeded list is fully editable by admins after launch.

---

**US-15 — Admin links Planning Center teams to checklist categories**  
*As an admin, I want to tell the app which Planning Center teams and positions belong to which checklist category, without a developer.*

**Acceptance Criteria:**
- Admin selects which Planning Center **Service Type** the app follows (e.g. "Sunday Service").
- The admin screen loads that Service Type's teams and positions from Planning Center and shows them in a list.
- Admin links each team, or an individual position within a team, to a category in the default list (e.g. team "Production" → position "Camera 2" → "Camera Operators").
- A position-level link overrides its team-level link.
- Admin can mark a team or position as **"sees all departments"** (e.g. Technical Director). People scheduled in it see every category by default (US-05).
- One category can have many teams/positions linked to it, but each team or position links to only one category.
- Only teams with at least one link count as "media teams" for access (US-02).
- Teams or positions with no link are clearly marked as unlinked.
- If a team or position is renamed in Planning Center, the link still works (links use Planning Center IDs, not names).
- If a linked team or position is deleted in Planning Center, the admin screen flags it as missing.
- A **"Refresh from Planning Center"** button fetches the teams and positions again at once, so a position just added in Planning Center shows up without waiting for the cache to expire.
- Admins see a **notice**, on the mapping screen and on its tab in the Admin area, while any position on a media team leads to no department (no link of its own and none on its team), or a link points to a team or position deleted in Planning Center. Teams with no links at all are not media teams and are not counted.
- A team with no links that nobody has reviewed shows an **informational note** (not a warning): "New team in Planning Center: link it if it's a media team." An Admin can mark such a team **"Not a media team"** once (e.g. a worship band), which stops the note. A marked team can't be linked until the mark is undone, and a team with links can't be marked.
- Every mapping change (link, unlink, "sees all departments", "Not a media team", Service Type) is logged with who and when, append-only, like other admin changes.
- Links are stored with their source (Planning Center today) and that source's IDs, in provider-neutral columns, so another scheduling source could be added without changing the rest of the app (C22).

---

### 3.5 Security & Data

---

**US-16 — Secrets are never in the codebase or the browser**  
*As the project owner, I need every credential kept out of the repository and out of the browser so it can't be leaked.*

**Acceptance Criteria:**
- These secrets are stored as encrypted **Cloudflare Worker secrets** (set in the Cloudflare dashboard or with `wrangler secret put`), never in code:
  - Planning Center OAuth client ID and client secret (for sign-in)
  - Planning Center church-level access token (Application ID + secret) for reading teams, positions, and schedules
  - Session signing key
- Local development uses a `.dev.vars` file, which is listed in `.gitignore` and never committed.
- The deployment guide documents exactly where and how to set each secret, and how to rotate them.

---

**US-17 — The database is reachable only from the server**  
*As the project owner, I need to know that no one can read or change data by going around the app.*

**Acceptance Criteria:**
- The browser never connects to the database directly. All reads and writes go through the Cloudflare Worker, which checks the user's session and role on every request.
- The database is connected to the Worker through a Cloudflare binding, so no database password or key exists that could leak to the browser.
- The church-level Planning Center token is used only on the server, only for reading data (teams, positions, people's team membership, and schedules), and is never sent to the browser.
- Responses only include data the user's role is allowed to see.

---

### 3.6 Hosting & Cost

---

**US-18 — The app costs nothing to host**  
*As the project owner, I need hosting to be free, with no surprise bills and no features that stop working on the free plan.*

**Acceptance Criteria:**
- The app (pages and server code) runs on **Cloudflare Workers, Free plan**.
- Data is stored in **Cloudflare D1, Free plan** (SQLite database).
- No credit card is required on any service. If a free-tier limit is reached, the service stops temporarily rather than billing.
- Expected usage stays well inside free limits: Workers Free allows 100,000 requests per day (static page files are free and unlimited); D1 Free allows up to 500 MB per database. A media team of ~20 people is a tiny fraction of this.
- Server code stays light, because the Workers Free plan allows 10 ms of CPU time per request (time spent waiting on Planning Center does not count).
- The app is deployed automatically from the GitHub repository's `main` branch using Cloudflare's GitHub integration.
- The app is available at a free `*.workers.dev` address. A church domain (e.g. `checklist.ifcwpg.com`) is optional and free if the domain's DNS is managed by Cloudflare.
- The deployment guide includes how to back up the D1 database (D1 Free includes 7 days of point-in-time recovery).

---

## 4. Version 1 vs. Later

### Version 1 — Must Have
- Planning Center OAuth sign-in (server-side in a Cloudflare Worker) with 30-day sessions
- Access based on media team membership; Admins and Directors always have access
- Admin-managed links from Planning Center teams/positions to checklist categories
- Roles: Volunteer, Admin, Director, Not on a media team
- Admin and Director flags in the app database, manageable by Admins in-app
- Fallback when Planning Center data is unavailable (manual department selection)
- One service per service day; per-service check-off state; "current service" defined in the church's time zone (both admin-editable settings)
- Manual reset (Admins/Directors only) with confirmation and undo
- Append-only activity log of every check-off change; Admin-only activity view (US-07a)
- A record of each service's checklist; service history with "X of Y done" and what wasn't checked (US-07b)
- Checklist and progress view refresh themselves about every 30 seconds while open
- Hidden-not-erased deletes; task text snapshots on check-off
- Hidden items view with Restore (US-13a)
- Append-only log of checklist edits, shown in the Admin activity view (US-13b)
- Mobile-responsive UI with a dark theme by default, and Light or System per device (US-08a)
- Admin: create/edit/delete task lists, categories, sections, and tasks
- Progress view per service for everyone with access; reset/undo for Admins/Directors
- Seed data: IFC Pre-Service Checklist pre-loaded at launch
- Free hosting: Cloudflare Workers + D1

### Later — Explicitly Out of Scope for V1
- Push notifications / SMS alerts when a category falls behind
- Multiple simultaneous active checklists per service
- Multiple services per service day
- Assigning tasks to specific individuals (not just departments)
- Comments or notes on individual tasks
- Historical reporting / analytics across multiple services
- Guest/visitor access (non-Planning-Center users)
- Emergency access code for when Planning Center sign-in is down and a user has no session
- Offline mode
- Calendar integration beyond the current service
- Custom branding colours (Dark, Light and System appearance are in scope: US-08a)
- **Google sign-in** as an alternative to Planning Center, linked to the same app account (US-03a). A new Google user gets no access until an Admin invites them (by email) or approves them; approval and roles stay in the app.
- **A list for a specific service date** (e.g. Christmas): choosing which list a given date uses, instead of only switching the default. For Version 1, admins switch the default list before a special service and switch it back afterward (US-11).
- **Planning Center links on copied lists:** when a list is copied, its team/position links come with it (copied, or matched by department name), so volunteers still get their department highlighted on the copy. In Version 1 a copy starts with no links.
- **"Choose your position" screen** as the normal way to pick a checklist when no scheduling system is used: the user picks their position(s) for the service and sees those departments first. The US-04a fallback (manual department pick, remembered for the day) is the starting point.
- **The last known schedule during an outage:** when Planning Center can't be reached, use the last successfully loaded schedule for the current service, with a note saying when it was loaded, so scheduled volunteers keep their own department view. In Version 1 everyone picks their department during an outage (US-04a).

---

## 5. All Decisions — Closed

| # | Question | Decision |
|---|----------|----------|
| Q1 | Admin identification | App-managed flag in D1, keyed by Planning Center person ID. First admin seeded at deploy. |
| Q2 | Director identification | Same mechanism — separate Director flag, granted by Admins in-app. |
| Q3 | No service published yet | Show the default checklist for the upcoming service day with a note. |
| Q4 | Multiple service times? | No — single service per service day (weekday is an admin setting, seeded Sunday). |
| Q5 | Hosting | Cloudflare Workers, Free plan ($0). Chosen over Vercel (free plan limited to personal, non-commercial use). |
| Q6 | Database | Cloudflare D1, Free plan ($0). Chosen over Supabase (free projects can pause after 7 days of low activity). |
| Q7 | Planning Center API access | Two credentials: an OAuth app for volunteer sign-in, and a church-level access token for reading teams and schedules. Both registered at api.planningcenteronline.com by someone with the right Planning Center permissions. |
| Q8 | API down during service | Never block on Sunday morning: 30-day sessions plus manual department selection for recently verified team members. |
| Q9 | Checklist reset | No automatic reset — each service has its own record. Manual reset for Admins/Directors only, with confirmation and undo. Reset is refused when nothing is checked; undo applies once, to the latest reset. |
| Q10 | Editing tasks mid-service | Allow edits. Check-offs stay linked; history shows the task text snapshot. |
| Q11 | Seed checklist content | IFC Pre-Service Checklist (Section 6). Editable by Admins after launch. |
| Q12 | Who gets access | Members of any linked media team (roster, not just this week's schedule), plus Admins and Directors. |
| Q13 | Mapping Planning Center to categories | Admin screen links teams/positions (by Planning Center ID) to categories. Position link overrides team link. |
| Q14 | Time zone | The church's time zone, an admin setting (seeded America/Winnipeg), for all service dates and times. |
| Q15 | Deleting tasks/categories | Hidden, not erased. Past records are never broken. |
| Q16 | Editing sections | Admins can add, rename, reorder, and delete (hide) sections within a category (US-12a). |
| Q17 | One team in several categories? | No — each team or position links to exactly one category. |
| Q18 | Undo reset after a task was re-checked | The newer check-off wins; the archived one is not restored for that task. |
| Q19 | Who sees the progress view | Everyone with access (Volunteers, Admins, Directors). Reset/undo: Admins and Directors only. List management and team mapping: Admins only. |
| Q20 | Restructuring the checklist | Admins can move tasks between sections (any department) and sections between departments, and reorder everything, using a phone-friendly "Move to…" menu. Moves stay within the same list. Drag-and-drop is optional on desktop. |
| Q21 | History after a move | Check-offs snapshot task text, department, and section. Past services show tasks where they were at check-off time. A task moved mid-service keeps its check-off. |
| Q22 | Church-specific values | Nothing church-specific is hardcoded: structure, content, Planning Center names, service day, time zone and branding all come from the database and are admin-editable (US-11a). The seed is only starting data. |
| Q23 | Auditing check-offs | Append-only activity log of every check, uncheck, reset, and undo (who, when, task, outcome, session, tab), written in the same transaction as the change. Admins only can view it. Never edited or deleted. |
| Q24 | Seeing others' changes | The checklist and the progress view refresh about every 30 seconds while visible and on returning to the tab. No push notifications (out of scope). |
| Q25 | Undoing a hide | A Hidden items view lists hidden departments, sections and tasks. Restore brings one back with its history, in its old position where possible. Restoring inside a hidden parent explains why and offers to restore the parent too (US-13a). |
| Q26 | Auditing checklist edits | Append-only log of every add, rename, edit, hide, restore, move and reorder, with who, when, and before/after values. Admins see it in the Activity view with a filter for check-offs vs. checklist edits (US-13b). |
| Q27 | How users are identified | By an internal app user ID. Sign-in accounts (Planning Center now, others later) are linked to it; roles, check-offs, resets and logs refer to the internal ID (US-03a). |
| Q28 | Dependence on Planning Center | Planning Center is one replaceable source for sign-in and for teams/schedules, each behind an interface. Outside references are stored in provider-neutral columns (C22). |
| Q29 | Which departments a volunteer sees | Scheduled volunteers see only their own department(s) by default, with "Show all departments" to see and check off the rest. Not scheduled or no link: all departments, and they choose theirs. Admins, Directors and positions marked "sees all departments" (e.g. Technical Director): all departments by default. A view choice only; the server never limits check-offs by department (US-05, C24). |
| Q30 | Lists for special services | Version 1: admins switch the default list before the service and back afterward. Choosing a list per service date, and carrying links over to copied lists, are "Later" (US-11). |

---

## 6. Seed Checklist — IFC Pre-Service Checklist

*Source: IFC_PreService_Checklist_By_Department.docx. Pre-loaded at launch. All content is editable by Admins in-app with no developer involvement.*

---

### Presentation / Computer Graphics

**1. Power & Initial System Check**
- Verify all server rack devices are powered on, including the Mac and supporting hardware
- Wake up the Presentation Station Mac using the mouse or keyboard

**2. Launch Required Software**
- Open ProPresenter
- Open the music software (Tidal, Spotify, or YouTube) — confirm it is copyright-free
- Close unnecessary apps and enable Do Not Disturb so no notifications appear on screen

**3. Prepare Worship Lyrics (Highest Priority)**
- Check the media email (media@ifcwpg.com) for song lists
- Import all lyrics into ProPresenter
- Format lyrics: maximum two lines per slide, break slides based on how the song is sung
- Review each song a second time for accuracy, spelling, formatting, and pacing
- Confirm song order and arrangement (repeats, bridges, tags) with the worship leader

**4. Prepare Scriptures & Sermon Notes**
- Check the media email for Bible verses, sermon notes, and pastor requests
- Format and load all content into ProPresenter using correct themes and layouts
- Verify all macros function properly
- Confirm which Bible translation the pastor is preaching from

**5. Check Announcements**
- Confirm whether announcements are live or video
- If video announcements are required, confirm we have the file; contact the announcement team if missing
- Import any requested images or videos from pastors and choir
- Ensure all images are horizontal

**6. Check Order of Service & WhatsApp Requests**
- Review the Order of Service sent on the Media Team WhatsApp group
- Save it to the computer and understand the flow
- Review WhatsApp messages for special instructions or cues
- Share any changes to the order of service with the Director and Audio Engineer

**7. Copyright & Quality Check**
- Check the Copyrights folder in the media email
- Do NOT use videos unless confirmed copyright-safe, licensed, or approved
- If anything is unclear or missing, notify the media team immediately
- Confirm song credits and license number show on lyric slides if required

**8. Final Pre-Service Checks**
- Recheck all media emails to ensure nothing was missed
- Confirm readiness of lyrics, sermon notes, verses, videos, images, and announcements
- Verify the correct ProPresenter theme is applied
- Have a blank or logo slide ready to switch to if something goes wrong

**9. Service Start Procedures**
- 9:55 AM — Start livestream and coordinate with streaming personnel
- Begin looping introduction images
- Start non-copyright background music
- 10:04 AM — Play the 1-minute online welcome video

**10. During Service**
- Stay calm and focused
- Follow the service flow smoothly
- Keep ProPresenter cues ready and respond quickly

**11. After Service**
- Clear the stage display
- Shut down or sleep the Mac as agreed

**12. Key Reminders**
- Audio MUST be tested
- Videos MUST be tested
- Images MUST be horizontal
- Lyrics MUST be clean and properly formatted
- Emails MUST be checked fully
- No copyrighted media unless explicitly approved

---

### Audio Engineer

**1. Power On**
- Power on the console and stage boxes first, then amplifiers and powered speakers last
- Load the correct scene or show file for this service

**2. Microphones & Batteries**
- Put fresh batteries in all wireless mics and bodypacks; keep spares at the desk
- Line-check every input on stage
- Test the pastor's mic and confirm it is handed off before service

**3. Soundcheck & Monitors**
- Soundcheck with the worship team and confirm monitor and in-ear mixes
- Check for feedback at service volume

**4. Verify Audio Functionality**
- Test computer audio with the Presentation / Computer Graphics operator
- Ensure Tidal/Spotify playback is clear
- Check video playback audio levels from ProPresenter

**5. Livestream & Recording**
- Confirm the livestream mix is reaching the stream at the right level
- Start the audio recording before service begins

**6. Communication**
- Test headsets or intercom with the Director

**7. During Service**
- Mute mics that are not in use
- Follow the order of service for mic and music cues

**8. After Service**
- Power down amplifiers and powered speakers first, then the console
- Return all microphones

---

### Camera Operators

**1. Camera Setup**
- Power on cameras and check batteries or power supply
- Clean the lenses
- Level the tripod; check that pan and tilt move smoothly and lock

**2. Picture Check**
- Set white balance and exposure so all cameras match (with the Director)
- Set focus and test the full zoom range

**3. Shots & Order of Service**
- Review the order of service and your shot assignments
- Practice key shots: pulpit, worship leader, choir, and wide shot

**4. Communication**
- Put on your headset and test intercom with the Director
- Confirm your tally light works

**5. Video & Visual Testing (with the Director)**
- Play through all videos to confirm correct display, audio, and smooth playback
- Check all image slides for proper formatting and orientation

**6. During Service**
- Hold a steady shot while live; reframe only after the Director cuts away
- Follow church guidelines on filming the congregation, especially children

**7. After Service**
- Power down cameras
- Put camera batteries on charge
- Cap the lenses

---

### Director (Switcher)

**1. Power & Systems**
- Power on the switcher, multiview monitor, and streaming encoder

**2. Inputs**
- Confirm every camera appears on the multiview
- Confirm ProPresenter graphics and lower thirds reach the switcher and key correctly
- Confirm audio from the Audio Engineer is present and in sync with video

**3. Video & Visual Testing (with Camera Operators)**
- Play through all videos to confirm correct display, audio, and smooth playback
- Check all image slides for proper formatting and orientation
- Match camera color and exposure with the Camera Operators

**4. Livestream**
- Check the internet connection
- Confirm the stream title, thumbnail, and destination are correct
- Coordinate the 9:55 AM stream start with the Presentation / Computer Graphics operator
- Start a backup recording

**5. Team Briefing**
- Walk the Camera Operators through the order of service and key moments
- Confirm intercom with every operator

**6. During Service**
- Call shots ahead of time ("Ready camera 2. Take 2.")
- Watch the stream output for audio or video problems

**7. After Service**
- End the livestream and confirm it has stopped on the streaming platform
- Stop the backup recording and confirm the file saved
- Power down the switcher, multiview, and encoder

---

### Miscellaneous

**1. Verify All Screens**
- Test the altar-facing screens with a lyric slide or video
- Test the main sanctuary screens
- Confirm proper ProPresenter output on all displays
- Check that the stage display (confidence monitor) shows lyrics and the clock

**2. Room & Equipment**
- Set stage lighting and house lights to the service preset
- Tidy or tape down cables in walkways
- Restock spare batteries, adapters, and cables

**3. After Service**
- Collect all batteries and return them to charging
- Turn off all TVs and screens
- Power down servers and equipment in the correct order
- Tidy the booth and stage cables

---

### Technical Director

**1. Before Service**
- Confirm the order of service with the pastor
- Check in with the worship leader and band on any changes
- Confirm all departments are staffed
- Review the progress dashboard before 9:55 AM and follow up with any department that's behind

**2. During Service**
- Be the point of contact for pastors, band, and volunteers
- Watch for problems and coordinate fixes

**3. After Service**
- Confirm all departments have completed their After Service tasks

---
## 7. Architecture Note

Planning Center sign-in requires a server-side component to hold the OAuth client secret. A **Cloudflare Worker** provides this for free: it serves the app's pages, handles the OAuth exchange, checks sessions and roles on every request, calls Planning Center with the church-level token, and reads/writes the **D1** database through a binding. Secrets live in Cloudflare's encrypted Worker secrets and never reach the browser. A plain static host (GitHub Pages, or any host without server functions) does not satisfy this requirement.

Planning Center data is cached briefly on the server (a few minutes per service) to keep the app fast and avoid Planning Center rate limits.

**Replaceable sources (C22).** Planning Center plays two separate roles, and each sits behind its own interface in the Worker:
- **Sign-in** (`IdentityProvider`): sends the user to the provider and returns who they are (the provider's ID for them, name, avatar). The app then finds or creates the app user linked to that account (US-03a). Planning Center is one provider; local test sign-in is another; Google could be added later.
- **Teams and schedules** (`ScheduleSource`): service types, teams and positions, team membership, plans and who is scheduled. Planning Center is one source; a fake source is used for development and tests.

Nothing outside these modules knows it is talking to Planning Center. The database stores outside references as a source name plus that source's ID, so removing Planning Center leaves users, roles, checklists and history intact.

---

*End of Requirements — Version 1.19*
