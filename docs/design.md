# UI/UX REDESIGN BRIEF — IFC PRE-SERVICE CHECKLIST APP

> **How this brief is applied (project owner, October 2026)**
>
> - All UI work follows this brief. Apply it stage by stage, following `docs/build-plan.md`. Build each screen to this brief when its stage comes up, not earlier.
> - **The requirements are in `docs/requirements.md` (currently v1.20). Where this brief and the requirements disagree, the requirements win.** This brief was brought in line with them in October 2026; later requirement changes apply even before the brief catches up.
> - Build the reusable components and design tokens from section 10 as screens need them.
> - If a stage doesn't have the data yet (progress counts, user name, completion times), leave that part of the UI out rather than showing made-up numbers. Add it in the stage that provides the data.
> - The fake login and fake schedule source in the approved build plan are allowed until Stages 9–10 (real Planning Center, then deployment). "No mock data" means no made-up numbers or placeholder content in the UI.
> - **Nothing church-specific is fixed in the design.** Department names and how many there are, sections, tasks, the service day, the time zone and the branding all come from the app's data and settings, and Admins can change them. Names used as examples in this brief (e.g. "Presentation / Computer Graphics") are the current starting data, not part of the design.
> - The sign-in screen shows exactly one sign-in option, "Sign in with Planning Center". Users never choose a role. Local development may add a separate, clearly labelled developer-only test-user control, which never exists in production builds.

## Role and Expectations

Act as a Principal Software Designer, Principal Product Designer, Product Owner, and VP of Software Development with 20+ years of experience designing enterprise-grade applications.

Review the existing application running locally and redesign its UI/UX to deliver a polished, intuitive, responsive, production-quality experience for Immanuel Fellowship Church (IFC).

Think like a senior product leader. Prioritize usability, information architecture, operational reliability, accessibility, maintainability, and visual consistency over decorative design.

Do not simply make the application look prettier. Improve how volunteers complete their pre-service tasks, how the team follows readiness, and how Admins manage the application.

## 1. Start by Inspecting the Existing Application

Before making changes:

- Inspect the existing frontend framework, component structure, routing, styling system, and state management.
- Review the existing UI in the local development environment.
- Read and follow the requirements in `docs/requirements.md`.
- Identify the existing functionality, API integrations, data models, authentication flow, and role-based permissions.
- Preserve working functionality and existing integrations.
- Identify UI/UX problems before implementing the redesign.

Do not rebuild the application from scratch unless there is a compelling technical reason.

Do not invent functionality that conflicts with the existing requirements.

## 2. Design Direction

Create a premium, understated, dark operational dashboard suitable for a church media and production team working in a low-light environment.

The interface should feel like a professionally designed production-management or enterprise operations application, not a generic AI-generated dashboard or a basic to-do list.

### Color system

Use the following design tokens consistently:

- Main background: #050505
- Primary panels and navigation: #0A0A0A
- Secondary surfaces: #0F0F0F
- Cards and task groups: #141414
- Hover states: #1A1A1A
- Borders and separators: #242424
- Primary accent: #7C3AED
- Secondary accent: #A78BFA
- Primary text: #F5F5F5
- Secondary text: #A3A3A3
- Success: #22C55E
- Warning/in-progress: #EAB308
- Neutral/not started: #737373
- Error: #EF4444

**Light theme** (requirements v1.20, US-08a; Dark stays the default, Light and System are each person's choice on My Preferences):

- Main background: #F7F7F9
- Primary panels and navigation: #FFFFFF
- Secondary surfaces: #F1F2F5
- Cards and task groups: #FFFFFF (cards keep their border: white on #F7F7F9 alone barely separates)
- Hover states: #ECECF1
- Borders and separators: #E2E4E9
- Primary accent: #6D28D9
- Secondary accent: #7C3AED
- Primary text: #18181B
- Secondary text: #52525B
- Success: #15803D · Warning/in-progress: #A16207 · Neutral/not started: #71717A · Error: #DC2626 (darker than Dark's so each passes WCAG AA on white)

System isn't a third look: it shows Dark or Light to match the device, and follows it when it changes.

Avoid excessive gradients, neon effects, glowing borders, bright blue/indigo accents, unnecessary shadows, and decorative elements without a functional purpose.

Use purple selectively for primary actions, selected navigation, focus states, and important interactive elements.

Use status colors consistently. Never communicate task status through color alone; include text labels, counts, or icons.

### Typography

Use Inter or the application's existing high-quality sans-serif font.

Recommended hierarchy:

- Page headings: 22–28px
- Section headings: 16–18px
- Task text: 14–16px
- Secondary metadata: 12–13px
- Buttons and navigation: 13–15px

Maintain readable line heights, consistent spacing, clear visual hierarchy, and adequate contrast.

## 3. Redesign the Volunteer Checklist

The volunteer checklist is the highest-priority screen.

The user should immediately understand:

1. Which service the checklist belongs to.
2. Which department they should work on.
3. How much work remains.
4. Which tasks are incomplete.
5. Whether their changes have been saved.

### A. Application header

Create a compact, professional header containing:

- The church's branding: short name (logo mark), team name and app name, as set by Admins in Settings (US-11a). Leave out any value that isn't set; never fall back to built-in church names. On phones, show the logo mark only.
- Current service date and service information.
- User avatar and display name.
- User role where appropriate.
- Access to role-authorized functions: Checklist and Progress for everyone with access. Nothing else in the header (requirements v1.20).
- A menu under the user's name: who they are (avatar, name, role), then **Administrative Settings (Admins only)**, then **Sign out**, set apart with an icon. It's a keyboard menu (arrow keys, Home/End, Escape returns focus) and stays within the viewport.
- A subtle connection or synchronization status when relevant.

Do not waste excessive vertical space on the header.

### B. Service overview

Display a compact service overview with:

- Service name and date (the church's service day and time zone come from Settings; never assume a weekday).
- Overall completed task count.
- Total task count.
- Remaining task count.
- A progress bar.
- A percentage where useful.

All values must come from actual application data.

Do not hardcode progress numbers or use illustrative data in the production interface.

If the schedule source (Planning Center today) has not published a service, display the required message explaining that the default checklist is ready for the upcoming service day (US-05).

If schedule data is unavailable, show the specified fallback banner and allow eligible users to select their department manually (US-04a).

### C. Department navigation

Departments come from the checklist data. There can be any number of them; there are currently six (Presentation / Computer Graphics, Audio Engineer, Camera Operators, Director (Switcher), Miscellaneous and Technical Director). Admins add, rename, reorder and hide departments, so layouts must never assume a fixed count or fixed names.

On desktop, use a persistent left sidebar or an equally effective department navigation pattern. (As built, October 2026: each department is a card-style button with its name and "X of Y tasks", the selected one outlined in purple; the workspace starts with a header card for the selected department, "X of Y complete · Z remaining" and a purple bar; each section sits in its own card with a small "SECTION 1" label above its name. Phones keep the sticky department picker, and hide the header card because the picker already names the department.)

On mobile, use a compact horizontal selector or accessible department menu.

For each department, display:

- Department name.
- Completed tasks versus total tasks.
- Completion status.
- A restrained visual indication of the selected department.

Which departments show by default follows US-05 (requirements v1.14):

- A **scheduled volunteer** sees only their own department, or all of theirs if they're scheduled in more than one. A **"Show all departments"** control adds the others after theirs, and they can check off tasks there too.
- Volunteers who aren't scheduled, or whose position has no link, see all departments and choose theirs.
- **Admins, Directors and Technical Directors** (a position an Admin marks "sees all departments") see all departments, their own first and highlighted.

Keep other departments accessible without making them visually compete with the volunteer's own work.

### D. Checklist sections

Preserve the existing section-based organization of the checklist.

Each section header should display:

- Section name.
- Completed task count.
- Total task count.
- Expand/collapse control.

Make the entire section header interactive.

Automatically expand the first incomplete section when appropriate.

Allow completed sections to be collapsed to reduce scrolling.

Maintain a clean visual distinction between section headers and individual tasks.

Avoid placing every section inside a heavily bordered card. Use subtle surfaces, separators, and spacing to establish hierarchy.

### E. Task rows

Each task should have:

- A clearly visible checkbox.
- The complete task description.
- A comfortable click/tap target.
- A distinct completed state.
- Completion metadata where appropriate.

Make the entire task row clickable, not just the checkbox.

Target at least 44 × 44px interactive areas, preferably approximately 48px or more for mobile touch interactions.

When a task is checked:

- Update the interface immediately.
- Update the department and overall progress.
- Persist the change through the existing backend.
- Display the volunteer's name and completion time where appropriate.

When a task is unchecked, record the action according to the existing requirements.

If saving fails, revert the optimistic UI change and show a concise error message.

Never indicate that a task was successfully saved if the server rejected the change.

Preserve all existing task descriptions and operational instructions.

## 4. Desktop Layout

Redesign the desktop experience using three primary areas:

1. A compact top navigation bar.
2. A persistent department navigation sidebar.
3. A flexible main checklist workspace.

Use the available screen width effectively.

Target a content area of approximately 1200–1400px on large desktop screens, with responsive margins and comfortable task-reading widths.

Avoid the narrow, centered column shown in the current implementation.

Do not stretch task descriptions across excessively wide lines.

Use consistent spacing, alignment, borders, and component sizing.

Ensure the layout remains usable at standard laptop resolutions and larger desktop displays.

## 5. Mobile and Tablet Layout

Treat mobile as a first-class experience rather than a compressed desktop interface.

Test at:

- 375px mobile width.
- 768px tablet width.
- Standard laptop widths.
- Large desktop widths.

Requirements:

- No horizontal scrolling.
- No text that requires zooming.
- Touch-friendly controls.
- Readable task descriptions.
- Responsive department navigation.
- Compact service information.
- Properly sized dialogs and menus.
- No content hidden behind sticky navigation.
- Clear feedback after task completion.

On mobile, prioritize the task list and keep secondary information compact.

Use a bottom navigation bar only if it improves navigation without consuming excessive space.

## 6. Progress Dashboard

Create a dedicated progress dashboard. **It is for everyone with access: Volunteers, Directors and Admins** (US-09, requirements v1.6). People who aren't on a media team can't see it.

The dashboard must make it possible to determine department readiness without manually reviewing every task.

As built (October 2026): a summary card leads with three figures (tasks completed of the total, departments in progress, departments not started), each with its words, then the overall bar. Each department card shows "X of Y tasks completed", its status in words on the right, and a bar coloured by status.

Display every department in the checklist (whatever the user's checklist view shows) with:

- Department name.
- Completed task count.
- Total task count.
- Completion percentage or progress bar.
- Explicit status: Complete, In progress, or Not started.

Use green for completed departments, yellow for in-progress departments, and grey for departments that have not started.

Always include labels and counts alongside status colors.

Allow anyone viewing the dashboard to expand a department and inspect individual task completion, including the volunteer's name and completion time.

Include:

- Last-updated timestamp.
- Manual refresh button.
- Automatic refresh approximately every 30 seconds.
- Appropriate loading and error states.
- Reset checklist action, for Admins and Directors only.
- Undo reset action when restoration is available, for Admins and Directors only.

Volunteers never see the reset and undo controls. Directors never get list management, team mapping, user management, the activity log or Settings.

Do not invent readiness thresholds or declare a service ready based solely on an arbitrary completion percentage.

## 7. Admin Workspace

Create a separate, role-protected Admin area, reached from **Administrative Settings** in an Admin's name menu (not a header tab), with its own navigation for each section. Only list sections that exist.

As built (October 2026, requirements v1.20): **Administrative Settings** in an Admin's name menu opens an **Overview** with the current service at a glance (the same three figures as Progress, each department's status in one line, and the service's status), a link to Progress for task details, reset and undo, and a shortcut card for each section with a line about it. The section navigation is described under Church settings below.

Organize it into clear sections:

### Checklist
Edit the checklist's departments, sections, and tasks according to the existing data model and requirements: add, rename, edit, reorder, move between sections and departments, and hide (US-12, US-12a, US-13). Hidden items are listed separately and can be restored (US-13a). Hiding never erases anything.

### Lists
Create, copy, rename, hide and restore task lists, and choose the default list (US-11).

### Team mapping
Configure the schedule's Service Type and link teams or positions to checklist departments (US-15). **The schedule source is replaceable:** it is Planning Center today, and screens should say "Planning Center" where that's what the person is linking, without building the design around Planning Center itself (requirements C22).

Clearly display:

- Linked teams.
- Linked positions.
- Assigned checklist departments.
- Unlinked teams and positions.
- Missing or deleted records in the schedule source.
- Position-level mappings that override team-level mappings.
- Teams or positions marked "sees all departments".

### Users
Search users and grant or revoke Admin and Director roles (US-03). There must always be at least one Admin (requirements v1.17): the last Admin's role can't be removed, and Admins confirm before removing their own.

### Activity
The append-only logs, read-only: check-offs, resets and undos for the current service (US-07a), checklist edits (US-13b), settings changes and role changes, with a filter.

### History
Previous services: what was done and what wasn't ("X of Y done" per department), tasks removed during the service, resets, and each service's activity log, as supported by the requirements (US-07, US-07b).

**Church settings** (time zone, service day, branding; US-11a) is a section of Administrative Settings since requirements v1.20. As built: the sections are grouped (Service: Overview, Activity, History; Setup: Checklist Management, Team mapping, Church settings; People: Users & Permissions) in a compact sidebar from 1024px (one row per section, icon and label, a purple bar on the current one), a section selector on phones and tablets, and a breadcrumb (Home / Administrative Settings / section) over each page. Checklist Management covers the editor and Lists, with a switch between them. The Overview's shortcut cards carry a line about each section.

Current service progress is on the Progress dashboard (§6), which Admins use like everyone else. The Overview shows only a compact summary of it and links there.

Use confirmation dialogs for destructive or consequential actions.

Preserve historical records when tasks or categories are deleted. Follow the existing soft-deletion and task-snapshot requirements.

The server must enforce authorization. Hiding a button in the frontend is not sufficient security.

## 8. Interaction and Feedback

Use consistent interaction patterns across the application.

- Immediate visual feedback for task completion.
- Optimistic updates with proper error recovery.
- Subtle loading indicators.
- Clear empty states.
- Useful error messages.
- Accessible dropdowns and dialogs.
- Visible keyboard focus.
- Consistent hover, active, selected, disabled, and loading states.
- Minimal, non-disruptive success feedback.

Avoid excessive toast notifications, unnecessary animations, and modal dialogs for routine checkbox interactions.

Resetting a service must require explicit confirmation. Explain that the action clears the service's check-offs, and provide the required undo functionality.

## 9. Authentication, Permissions, and Fallback States

Preserve the existing authentication and authorization requirements. People sign in with Planning Center today; the app keeps its own user accounts, so the sign-in provider can change without losing people, roles or history (US-03a).

The UI must support:

- Volunteer access.
- Admin access.
- Director access.
- An explanation screen for users without linked media-team membership.
- Existing sessions when sign-in is temporarily unavailable (US-04b).
- Manual department selection when schedule lookup fails and fallback access is permitted (US-04a).
- An informative message when no service has been published.

Clearly distinguish authentication failures from schedule lookup failures.

Do not expose secrets, access tokens, database credentials, or sign-in provider IDs in the browser.

Do not weaken server-side authorization to simplify the UI.

## 10. Design System and Code Quality

Build reusable components for:

- Buttons.
- Inputs.
- Checkboxes.
- Task rows.
- Section headers.
- Department navigation.
- Progress indicators.
- Status labels.
- Cards.
- Dialogs.
- Toasts or inline feedback.
- Empty states.
- Loading states.

Define shared design tokens for colors, spacing, typography, borders, radii, and interaction states.

Reuse the application's existing component library when appropriate.

Avoid unnecessary dependencies, duplicated styling, inconsistent one-off components, and oversized component files.

Use semantic HTML, accessible labels, appropriate ARIA attributes, and keyboard-operable interactions.

Keep business logic separate from presentation wherever practical.

## 11. Implementation Constraints

This is a redesign of the existing application, not permission to change the product requirements.

- Preserve the existing application framework and working integrations.
- Follow `docs/requirements.md`; where this brief disagrees, the requirements win.
- Preserve the seeded checklist content as starting data. Departments, sections and tasks are data that Admins edit; never hardcode them, their number, or their names.
- Keep Planning Center behind the replaceable sign-in and schedule-source interfaces (requirements C22).
- Preserve the current backend and database architecture.
- Preserve role-based access controls.
- Preserve service-specific task completion.
- Preserve task history, snapshots, service records, and reset/restore behavior.
- Do not introduce paid services or subscriptions.
- Do not add out-of-scope functionality.
- Do not replace real data with mock data.
- Do not leave placeholder buttons or nonfunctional interactions.
- Do not remove existing functionality without an explicit reason.

The specified hosting architecture remains Cloudflare Workers and Cloudflare D1 on the free plan.

## 12. Acceptance Criteria

The redesign is complete when:

1. The volunteer can identify their department and begin working immediately.
2. Task progress updates accurately and saves reliably.
3. The seeded checklist content is preserved as starting data, and layouts work with any number of departments, sections and tasks.
4. The desktop layout uses available screen space effectively.
5. Mobile and tablet layouts work without horizontal scrolling.
6. Task controls meet the minimum touch-target requirement.
7. Everyone with access can follow department progress and inspect task completion details; only Admins and Directors can reset and undo.
8. Admins can manage the checklist, lists, team mapping, users and roles, and Settings, and can review activity and service history.
9. Directors cannot manage the checklist, lists, mapping, users or Settings.
10. Error, loading, empty, fallback, and reset states are properly designed.
11. Accessibility and keyboard navigation are verified.
12. Existing authentication, authorization, and data integrity remain intact.
13. No critical functionality is replaced by mock implementations.
14. The application builds successfully and existing tests continue to pass.

## 13. Required Working Approach

Work directly in the existing codebase.

First inspect the application and identify the relevant components and files. Then implement the redesign in manageable stages.

Prioritize the volunteer checklist first, followed by the Progress dashboard and Admin workspace.

After implementation:

- Run the project's existing linting, type checks, tests, and production build.
- Fix regressions introduced by the redesign.
- Verify responsive behavior at the specified viewport widths.
- Verify task completion, failed saves, permissions, reset/undo, and fallback states.
- Summarize the files changed, design decisions, functionality implemented, tests performed, and any remaining limitations.

Do not stop after producing a visual mockup or design proposal. Implement the actual UI in the existing application.

The final result should feel cohesive, deliberate, professional, and ready for real IFC media-team volunteers to use on Sunday morning.
