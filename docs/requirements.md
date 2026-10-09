# Church Media Team Checklist App — Requirements

> **Version:** 1.4 · **Date:** October 2026  
> **Audience:** Security Architect / Project Owner  
> **Status:** All decisions closed — ready for design

---

## 0. Changes in Version 1.4

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

A mobile-friendly web app for a church's media/production volunteers. Volunteers sign in with Planning Center, see their department's checklist for the current service, and check off tasks. Admins manage lists, link Planning Center teams to checklist categories, and track overall progress. The app must cost $0/month to host.

---

## 2. Roles

| Role | Description |
|------|-------------|
| **Volunteer** | A member of a linked media team in Planning Center (see US-15). Sees all categories, with their own shown first. Checks off tasks. |
| **Admin** | Manages task lists, categories, tasks, and team mappings. Sees full progress. Can grant/revoke Admin and Director roles. Can reset or restore a service checklist. Always has access, scheduled or not. |
| **Director** | Sees the progress view. Can reset or restore a service checklist. No list-management permissions. Always has access, scheduled or not. |
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

---

**US-03 — Admin and Director are recognized at sign-in**  
*As an admin, I want the app to recognize my elevated role without me having to do anything extra.*

**Acceptance Criteria:**
- Admin and Director status are stored as flags on the user record in the app's database, keyed by Planning Center person ID.
- The first admin is seeded at deployment time (documented in the deployment guide).
- An admin can grant or revoke Admin and Director flags for other users from within the app.
- Roles are checked on the server on every request, so revoking access takes effect on the user's next page load.
- Admin-only UI is hidden from non-admins, and admin actions are rejected by the server for non-admins even if called directly.

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
- Using the team mapping (US-15), the user's category is shown first and highlighted. Other categories are visible but collapsed or visually secondary.
- If a volunteer is scheduled on multiple teams or positions, all of their categories are shown first.
- If the user is a team member but not scheduled, or their team/position has no mapping, all categories are shown with none highlighted, and they can choose their department (remembered on that device for the day).
- If no service is published in Planning Center, the user sees the default checklist for the upcoming Sunday with a note: "No service is published in Planning Center yet — your checklist is ready when you are."

---

**US-06 — Volunteer checks off a task**  
*As a volunteer, I want to tap a task to mark it complete so the team can track progress.*

**Acceptance Criteria:**
- Each task has a tap target of at least 44×44 px.
- Tapping marks the task complete and records the volunteer's display name, Planning Center person ID, a timestamp, and a snapshot of the task text at that moment.
- The UI updates immediately (optimistic update). If the save fails, the checkmark reverts and a brief error message appears.
- A completed task can be unchecked. Unchecking records who unchecked it and when.

---

**US-07 — Each service has its own checklist**  
*As a volunteer, I want this Sunday's checklist to be clear even though last week's data is still saved.*

**Acceptance Criteria:**
- Check-off state is stored per service, not per list definition. A new service automatically starts with every task unchecked — no scheduled reset job is needed.
- **Current service** is defined as: the Planning Center plan, in the Service Type selected by an Admin (US-15), with the earliest date that is today or later. A service stays "current" until 11:59 PM on its date.
- If no plan is published, the current service is the upcoming Sunday (or today, if today is Sunday).
- All dates and times use the **America/Winnipeg** time zone, including daylight saving changes, even though the server runs in UTC.
- Admins and Directors can manually reset the current service's checklist. Volunteers cannot.
- Reset shows a confirmation prompt: "This will clear all check-offs for this service. Are you sure?"
- A reset is not destructive: cleared check-offs are archived, and an Admin or Director can restore them with an "Undo reset" option until the next reset.
- Past service check-off data is preserved and accessible to admins.

---

**US-08 — Checklist works on phones and tablets**  
*As a volunteer working in the booth or on the floor, I want the app to work well on my phone.*

**Acceptance Criteria:**
- Responsive layout tested at 375px (phone) and 768px (tablet) widths.
- Text readable without zooming; no horizontal scrolling.
- Supports a dark theme suitable for low-light booth conditions; tap targets per US-06.

---

### 3.3 Progress View

---

**US-09 — Admin sees overall service progress**  
*As an admin, I want a dashboard showing which departments are done and which have open tasks.*

**Acceptance Criteria:**
- Progress view is accessible to Admins and Directors.
- Each category shows: total tasks, completed count, and a color indicator (green = all done, yellow = in progress, grey = not started). Color is never the only indicator; counts and labels are always shown.
- Expanding a category shows which volunteer checked off each task and at what time.
- View refreshes automatically about every 30 seconds while open, and shows a "last updated" time with a manual refresh button.

---

**US-10 — Director sees progress without editing lists**  
*As the Director, I want the same progress view as admins but I don't need list management tools.*

**Acceptance Criteria:**
- Director role sees the full progress view.
- List management and team mapping UI is not visible to Directors, and the server rejects those actions from Directors.
- Director role is granted by an Admin within the app.

---

### 3.4 Task List Management (Admin)

---

**US-11 — Admin creates a new task list**  
*As an admin, I want to create named task lists for different scenarios.*

**Acceptance Criteria:**
- Admin can create a list with a name and optional description.
- One list can be set as the default for regular Sunday services.
- Lists appear in an admin management view.

---

**US-12 — Admin manages categories within a list**  
*As an admin, I want to add, rename, reorder, and delete department categories within a list.*

**Acceptance Criteria:**
- Admin can add, rename, delete (with confirmation + warning if tasks exist), and reorder categories.
- Reorder via drag-and-drop or up/down controls.
- Deleting a category hides it from current and future checklists but keeps it in the database, so past service records still display correctly. A deleted category's team mappings are removed, with a warning shown first.
- Changes are immediately live for the next volunteer who loads the checklist.

---

**US-13 — Admin manages tasks within a category**  
*As an admin, I want to add, edit, reorder, and delete individual tasks as the team streamlines its workflow.*

**Acceptance Criteria:**
- Admin can add, edit, delete (with confirmation), and reorder tasks within a category.
- No limit to the number of tasks per category.
- If a task is edited while a service is in progress, existing check-offs remain linked to the task. Past records show the task text snapshot saved at check-off time (US-06).
- Deleting a task hides it from current and future checklists but keeps it in the database, so past service records are never broken.
- No developer involvement required — all changes happen through the admin UI.

---

**US-14 — Pre-service checklist is seeded on first launch**  
*As an admin, I want the existing printed checklist already in the app when we go live.*

**Acceptance Criteria:**
- The app is deployed with the IFC Pre-Service Checklist (Section 6) pre-loaded as the default list.
- All 5 departments (Presentation/Computer Graphics, Audio Engineer, Camera Operators, Director, Miscellaneous) with their sections and tasks are present.
- The seeded list is fully editable by admins after launch.

---

**US-15 — Admin links Planning Center teams to checklist categories**  
*As an admin, I want to tell the app which Planning Center teams and positions belong to which checklist category, without a developer.*

**Acceptance Criteria:**
- Admin selects which Planning Center **Service Type** the app follows (e.g. "Sunday Service").
- The admin screen loads that Service Type's teams and positions from Planning Center and shows them in a list.
- Admin links each team, or an individual position within a team, to a category in the default list (e.g. team "Production" → position "Camera 2" → "Camera Operators").
- A position-level link overrides its team-level link.
- One category can have many teams/positions linked to it.
- Only teams with at least one link count as "media teams" for access (US-02).
- Teams or positions with no link are clearly marked as unlinked.
- If a team or position is renamed in Planning Center, the link still works (links use Planning Center IDs, not names).
- If a linked team or position is deleted in Planning Center, the admin screen flags it as missing.

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
- One service per Sunday; per-service check-off state; "current service" defined in Winnipeg time
- Manual reset (Admins/Directors only) with confirmation and undo
- Hidden-not-erased deletes; task text snapshots on check-off
- Mobile-responsive UI with dark theme
- Admin: create/edit/delete task lists, categories, and tasks
- Admin/Director: progress view per service
- Seed data: IFC Pre-Service Checklist pre-loaded at launch
- Free hosting: Cloudflare Workers + D1

### Later — Explicitly Out of Scope for V1
- Push notifications / SMS alerts when a category falls behind
- Multiple simultaneous active checklists per service
- Multiple services per Sunday
- Assigning tasks to specific individuals (not just departments)
- Comments or notes on individual tasks
- Historical reporting / analytics across multiple services
- Guest/visitor access (non-Planning-Center users)
- Emergency access code for when Planning Center sign-in is down and a user has no session
- Offline mode
- Calendar integration beyond the current service
- Custom branding / themes

---

## 5. All Decisions — Closed

| # | Question | Decision |
|---|----------|----------|
| Q1 | Admin identification | App-managed flag in D1, keyed by Planning Center person ID. First admin seeded at deploy. |
| Q2 | Director identification | Same mechanism — separate Director flag, granted by Admins in-app. |
| Q3 | No service published yet | Show the default checklist for the upcoming Sunday with a note. |
| Q4 | Multiple service times? | No — single service per Sunday. |
| Q5 | Hosting | Cloudflare Workers, Free plan ($0). Chosen over Vercel (free plan limited to personal, non-commercial use). |
| Q6 | Database | Cloudflare D1, Free plan ($0). Chosen over Supabase (free projects can pause after 7 days of low activity). |
| Q7 | Planning Center API access | Two credentials: an OAuth app for volunteer sign-in, and a church-level access token for reading teams and schedules. Both registered at api.planningcenteronline.com by someone with the right Planning Center permissions. |
| Q8 | API down during service | Never block on Sunday morning: 30-day sessions plus manual department selection for recently verified team members. |
| Q9 | Checklist reset | No automatic reset — each service has its own record. Manual reset for Admins/Directors only, with confirmation and undo. |
| Q10 | Editing tasks mid-service | Allow edits. Check-offs stay linked; history shows the task text snapshot. |
| Q11 | Seed checklist content | IFC Pre-Service Checklist (Section 6). Editable by Admins after launch. |
| Q12 | Who gets access | Members of any linked media team (roster, not just this week's schedule), plus Admins and Directors. |
| Q13 | Mapping Planning Center to categories | Admin screen links teams/positions (by Planning Center ID) to categories. Position link overrides team link. |
| Q14 | Time zone | America/Winnipeg for all service dates and times. |
| Q15 | Deleting tasks/categories | Hidden, not erased. Past records are never broken. |

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

**11. Key Reminders**
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

---
## 7. Architecture Note

Planning Center sign-in requires a server-side component to hold the OAuth client secret. A **Cloudflare Worker** provides this for free: it serves the app's pages, handles the OAuth exchange, checks sessions and roles on every request, calls Planning Center with the church-level token, and reads/writes the **D1** database through a binding. Secrets live in Cloudflare's encrypted Worker secrets and never reach the browser. A plain static host (GitHub Pages, or any host without server functions) does not satisfy this requirement.

Planning Center data is cached briefly on the server (a few minutes per service) to keep the app fast and avoid Planning Center rate limits.

---

*End of Requirements — Version 1.4*
