# UI/UX REDESIGN BRIEF — IFC PRE-SERVICE CHECKLIST APP

> **How this brief is applied (project owner, October 2026)**
>
> - All UI work follows this brief. Apply it stage by stage, following `docs/build-plan.md`. Build each screen (Director dashboard, Admin workspace, sign-in, reset/undo, Planning Center screens) to this brief when its stage comes up, not earlier.
> - Build the reusable components and design tokens from section 10 as screens need them.
> - If a stage doesn't have the data yet (progress counts, user name, completion times), leave that part of the UI out rather than showing made-up numbers. Add it in the stage that provides the data.
> - The fake login and fake Planning Center in the approved build plan are allowed until Stages 8–9. "No mock data" means no made-up numbers or placeholder content in the UI.
> - The requirements file is `docs/requirements.md`.
> - Department names come from the checklist data. The seed's "Director (Switcher)" is the brief's "Director".
> - **Requirements v1.7 adds a sixth department, Technical Director.** Wherever this brief says "five departments" (§3C, §6, §11, §12), read it as all departments in the checklist (currently six). Layouts must not assume a fixed count.
> - **Requirements v1.6 overrides §6 on who sees the dashboard:** the progress dashboard is for everyone with access, Volunteers included. Reset and "Undo reset" stay Admin/Director-only, and list management and Planning Center mapping stay Admin-only.
> - The sign-in screen shows exactly one sign-in option, "Sign in with Planning Center". Users never choose a role. Local development may add a separate, clearly labelled developer-only test-user control, which never exists in production builds.

## Role and Expectations

Act as a Principal Software Designer, Principal Product Designer, Product Owner, and VP of Software Development with 20+ years of experience designing enterprise-grade applications.

Review the existing application running locally and redesign its UI/UX to deliver a polished, intuitive, responsive, production-quality experience for Immanuel Fellowship Church (IFC).

Think like a senior product leader. Prioritize usability, information architecture, operational reliability, accessibility, maintainability, and visual consistency over decorative design.

Do not simply make the application look prettier. Improve how volunteers complete their pre-service tasks, how Directors monitor readiness, and how Admins manage the application.

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

- IFC Production or IFC Pre-Service Checklist branding.
- Current service date and service information.
- User avatar and display name.
- User role where appropriate.
- Access to role-authorized functions.
- A subtle connection or synchronization status when relevant.

Do not waste excessive vertical space on the header.

### B. Service overview

Display a compact service overview with:

- Service name and date.
- Overall completed task count.
- Total task count.
- Remaining task count.
- A progress bar.
- A percentage where useful.

All values must come from actual application data.

Do not hardcode progress numbers or use illustrative data in the production interface.

If Planning Center has not published a service, display the required message explaining that the default checklist is ready for the upcoming Sunday.

If Planning Center schedule data is unavailable, show the specified fallback banner and allow eligible users to select their department manually.

### C. Department navigation

The five departments are:

- Presentation / Computer Graphics
- Audio Engineer
- Camera Operators
- Director
- Miscellaneous

On desktop, use a persistent left sidebar or an equally effective department navigation pattern.

On mobile, use a compact horizontal selector or accessible department menu.

For each department, display:

- Department name.
- Completed tasks versus total tasks.
- Completion status.
- A restrained visual indication of the selected department.

Prioritize the volunteer's assigned department.

If a volunteer is assigned to multiple departments, prioritize all applicable departments.

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

## 6. Director Progress Dashboard

Create a dedicated progress dashboard for Directors and Admins.

The dashboard must make it possible to determine department readiness without manually reviewing every task.

Display all five departments with:

- Department name.
- Completed task count.
- Total task count.
- Completion percentage or progress bar.
- Explicit status: Complete, In progress, or Not started.

Use green for completed departments, yellow for in-progress departments, and grey for departments that have not started.

Always include labels and counts alongside status colors.

Allow a Director to expand a department and inspect individual task completion, including the volunteer's name and completion time.

Include:

- Last-updated timestamp.
- Manual refresh button.
- Automatic refresh approximately every 30 seconds.
- Appropriate loading and error states.
- Reset checklist action for authorized users.
- Undo reset action when restoration is available.

Do not give Directors access to task-list management or Planning Center mapping.

Do not invent readiness thresholds or declare a service ready based solely on an arbitrary completion percentage.

## 7. Admin Workspace

Create a separate, role-protected Admin area.

Organize it into clear sections:

### Overview
Current service and department progress.

### Checklist Management
Create, edit, reorder, and hide/delete task lists, categories, sections, and tasks according to the existing data model and requirements.

### Planning Center Mapping
Configure the Service Type and link Planning Center teams or positions to checklist categories.

Clearly display:

- Linked teams.
- Linked positions.
- Assigned checklist categories.
- Unlinked teams and positions.
- Missing or deleted Planning Center records.
- Position-level mappings that override team-level mappings.

### Users and Permissions
Search users and grant or revoke Admin and Director roles.

### Service History
Access previous service records, task completion snapshots, and archived reset data as supported by the existing requirements.

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

Preserve the existing Planning Center authentication and authorization requirements.

The UI must support:

- Volunteer access.
- Admin access.
- Director access.
- An explanation screen for users without linked media-team membership.
- Existing sessions when Planning Center sign-in is temporarily unavailable.
- Manual department selection when schedule lookup fails and fallback access is permitted.
- An informative message when no service has been published.

Clearly distinguish authentication failures from schedule lookup failures.

Do not expose secrets, access tokens, or database credentials in the browser.

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
- Follow `docs/requirements.md`.
- Preserve the five departments and all seeded checklist content.
- Preserve Planning Center integration.
- Preserve the current backend and database architecture.
- Preserve role-based access controls.
- Preserve service-specific task completion.
- Preserve task history, snapshots, and reset/restore behavior.
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
3. All five departments and their seeded checklist content are preserved.
4. The desktop layout uses available screen space effectively.
5. Mobile and tablet layouts work without horizontal scrolling.
6. Task controls meet the minimum touch-target requirement.
7. Directors can monitor department progress and inspect task completion details.
8. Admins can manage checklists, mappings, and roles.
9. Directors cannot manage lists or mappings.
10. Error, loading, empty, fallback, and reset states are properly designed.
11. Accessibility and keyboard navigation are verified.
12. Existing authentication, authorization, and data integrity remain intact.
13. No critical functionality is replaced by mock implementations.
14. The application builds successfully and existing tests continue to pass.

## 13. Required Working Approach

Work directly in the existing codebase.

First inspect the application and identify the relevant components and files. Then implement the redesign in manageable stages.

Prioritize the volunteer checklist first, followed by the Director dashboard and Admin workspace.

After implementation:

- Run the project's existing linting, type checks, tests, and production build.
- Fix regressions introduced by the redesign.
- Verify responsive behavior at the specified viewport widths.
- Verify task completion, failed saves, permissions, reset/undo, and fallback states.
- Summarize the files changed, design decisions, functionality implemented, tests performed, and any remaining limitations.

Do not stop after producing a visual mockup or design proposal. Implement the actual UI in the existing application.

The final result should feel cohesive, deliberate, professional, and ready for real IFC media-team volunteers to use on Sunday morning.
