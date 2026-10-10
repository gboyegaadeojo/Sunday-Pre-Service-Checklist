# Stage 8 design review

Reviewed 10 October 2026 against `docs/design.md` and `docs/requirements.md` (v1.19), on the code at commit `9d967d4` (Stage 7d).

**Status: all 20 approved and fixed.** The project owner chose option a for #7 (near-black text on the red), and approved the added sentence for #3 and the new notice for #9. Two results differ from what was proposed:
- **#2:** the first task now starts at about 420 px on a 375 px phone (it was about 580). That's short of the 350 px estimate, because the slim "Show all" row is set by the switch's 44 px height. About six tasks now show on the first screen, where two did before.
- **#11:** both edges of the tab strip fade, not only the right, since scrolling to the current tab can hide tabs on the left.

The screenshots linked below were taken before the fixes and are kept locally only (`docs/design-review/` is gitignored).

## How it was reviewed

- **Screens:** sign-in and the developer box, no access ("Media team only", "Almost ready", "Couldn't confirm your team"), the checklist, Progress, the name menu, Settings, and every Admin section (Checklist, Hidden items, Lists, Team mapping, Users, Activity, History).
- **Roles:** Volunteer (on the team, not scheduled), scheduled volunteer (Test Camera Operator; Test Two Positions for two departments), Technical Director, Director, Admin and Non-member, each signed in through the developer box.
- **Widths:** 375 px, 768 px and 1280 px, in Chrome.
- **States:**
  - Normal, "Show all departments", no published plan, Planning Center down, not confirmed in 90 days during an outage, and team mapping not set up. These came from the dev schedule route and temporary local database changes, which were put back afterwards.
  - Loading, load error, failed save, connection lost, session ended mid-save and empty checklist. These were simulated in the browser by intercepting requests, with no app change.
  - The Reset, Hide and other confirmation dialogs, opened and cancelled.
- **Automatic checks on every page and width:** horizontal overflow, controls under 44 px, controls without an accessible name, and text under 12 px. Contrast was measured for every token pair in use, and a keyboard Tab pass was done through the checklist.
- **Screenshots** are in [`docs/design-review/`](design-review/).

## What already works well

- **No horizontal scrolling** on any screen at any width, and **no unnamed controls**.
- **Task rows** are full-width labels at least 48 px tall. The whole row toggles, and keyboard and screen-reader behaviour comes from a native checkbox.
- **Visible keyboard focus:** a 2 px purple ring on every stop, in a sensible order (header, scope switch, department, section, tasks). See [focus-1280](design-review/focus-1280.png).
- **Status is never shown by colour alone:** dots come with labels or counts, and finished sections get a tick.
- **Text contrast passes AA everywhere:** secondary text on cards is 7.3:1, purple accent text 6.8:1, white on the purple button 5.7:1.
- **Dialogs** use the native `<dialog>`: Cancel gets focus first, Escape closes, and each says what will happen and that nothing is erased.
- **Outage and access screens** say what happened and what to do: [outage banner](design-review/checklist-volunteer-outage-375.png), [couldn't confirm your team](design-review/noaccess-unreachable-375.png).
- **Desktop and tablet** use the sidebar layout from 768 px up, with comfortable line lengths: [1280](design-review/checklist-camera2-1280.png), [768 with Show all](design-review/checklist-camera2-showall-768.png).

## Summary, by Sunday-morning impact

**Impact** means how much it would affect a volunteer getting ready on Sunday morning: in a dark booth, on a phone, in a hurry. **High:** they could lose work or not see what to do. **Medium:** it slows them down or confuses them. **Low:** polish, or Admin-only.

| # | Screen | Problem | Impact |
|---|---|---|---|
| 1 | Checklist | A failed save is easy to miss on a phone, then leaves no trace | High |
| 2 | Checklist | On a phone the first task starts below the middle of the screen | High |
| 3 | Checklist | With no published plan, a scheduled volunteer lands on someone else's department | Medium |
| 4 | Checklist | Signed out mid-save: the tick is lost without a word | Medium |
| 5 | Progress | A volunteer's own department isn't marked or first | Medium |
| 6 | Progress | An expanded department repeats "Not done" under every open task | Medium |
| 7 | Progress, Admin › Checklist | White text on the red confirm button fails contrast (3.8:1) | Medium |
| 8 | Progress | "Reset checklist" is greyed out with the reason only in a tooltip | Low |
| 9 | Checklist (Admins, Directors) | Nothing says volunteers are locked out while team mapping isn't set up | Medium |
| 10 | Almost ready | No "Try again" button | Low |
| 11 | Admin tabs | At 375 px, Users, Activity and History are cut off with no sign they scroll | Low |
| 12 | Admin › History | Unchecked tasks in a past service look like tappable checkboxes | Low |
| 13 | Admin › History | Two different summary styles in one list, unexplained | Low |
| 14 | Admin › Checklist, Activity | Two controls under 44 px | Low |
| 15 | Admin › Team mapping | "Fetched …" time is out of line at desktop width | Low |
| 16 | Admins only | No heading or way back | Low |
| 17 | Header | Logo-mark text is 11 px | Low |
| 18 | All | The focus ring flashes white for 150 ms before turning purple | Low |
| 19 | Checklist | The no-plan note names "Planning Center" in client code | Low |
| 20 | Admin › Activity | "tab —" shown when there's no tab ID | Low |

**Your decision needed on:**
- **#7** changes how a colour is used.
- **#3** adds a sentence next to a message whose wording the requirements fix.
- **#9** is a small new notice.

Everything else stays within the current design.

---

## Checklist

### 1. A failed save is easy to miss on a phone, then leaves no trace (High)

- **Where:** Checklist, 375 px (also 768 px). All roles.
- **What's wrong:** "All changes saved / Last change not saved" lives in the service overview card at the top, so it scrolls out of view as soon as the volunteer moves down the list. When a save fails, the tick reverts and a red message appears at the bottom, but it **hides itself after 7 seconds**. Someone looking at a camera or the desk while it shows comes back to a task that's simply unticked, with nothing on screen saying why. They'll probably assume they mis-tapped, or not notice at all.
- **Screenshots:** [failed save](design-review/checklist-savefail-375.png), then [7 seconds later](design-review/checklist-savefail-after-375.png). [Connection lost](design-review/checklist-offline-375.png) shows the status only because the page wasn't scrolled.
- **Falls short of:**
  - design.md §3: the user should "immediately understand … whether their changes have been saved".
  - §3E: "If saving fails, revert … and show a concise error message".
  - §5: "Clear feedback after task completion".
  - US-06.
- **Proposed fix:**
  1. Put the save status in the sticky department bar on phones, next to the department's count, so it's always in view while working.
  2. Keep a save-error message on screen until it's dismissed or the next save succeeds, instead of hiding it after 7 seconds.
  3. Mark the failed task itself: a short "Not saved, tap to try again" line under its text until it's tapped again.

### 2. On a phone the first task starts below the middle of the screen (High)

- **Where:** Checklist, 375 px. Every role.
- **What's wrong:** before the first task there are four stacked blocks:
  - the service overview card
  - the scope card ("Showing your department" and "Show all departments"), or a note
  - the department picker
  - the department name again as a 2-line heading, with its own progress bar

  The first task starts at about 580 px of an 812 px screen, so only one or two tasks show without scrolling, and fewer once the browser's own bars are counted. The department name and count appear twice, in the picker and in the heading.
- **Screenshots:** [unscheduled volunteer](design-review/checklist-volunteer-375.png), [scheduled volunteer](design-review/checklist-camera2-375.png).
- **Falls short of:**
  - design.md §5: "On mobile, prioritize the task list and keep secondary information compact".
  - §12.1: "The volunteer can identify their department and begin working immediately".
- **Proposed fix (phones only; tablet and desktop unchanged):**
  1. Hide the big department heading on phones, keeping it for screen readers. The sticky picker already names the department and shows its count.
  2. Fold the scope card into one slim row under the overview: "Your department: Camera Operators", with the "Show all" switch on the same line.
  3. Tighten the overview card's padding.

  The first task should then start at about 350 px.

### 3. With no published plan, a scheduled volunteer lands on someone else's department (Medium)

- **Where:** Checklist, all widths. A volunteer who's normally scheduled, on a day Planning Center has no plan yet.
- **What's wrong:** with no plan the app can't tell who's scheduled, so (as the requirements say) everyone sees all departments and chooses. The page opens on the first department (Presentation / Computer Graphics), though, and the only text is the small grey note "No service is published in Planning Center yet — your checklist is ready when you are." Nothing says to pick a department, so a camera operator can start reading Presentation's tasks. The "not on the schedule" and outage states both tell people to choose; this one doesn't.
- **Screenshot:** [no plan, Test Camera Operator](design-review/checklist-camera2-unpublished-375.png).
- **Falls short of:** design.md §3 item 2 ("which department they should work on"), and US-05 ("they can choose their department").
- **Proposed fix:** keep the required sentence as it is and add "Choose your department below." after it. Show it in the same blue note style as the "not on the schedule" note instead of small grey text. A department picked today is already remembered for the day. **Your call**, because it adds to a message the requirements word exactly.

### 4. Signed out mid-save: the tick is lost without a word (Medium)

- **Where:** Checklist, all widths. Rare: sessions last 30 days, but an Admin removing someone's access triggers it too.
- **What's wrong:** if the session has ended when a task is tapped, the app goes straight to the sign-in screen. Nothing says the person was signed out or that their last tick wasn't saved.
- **Screenshot:** [after tapping a task with an expired session](design-review/checklist-signedout-midsave-375.png).
- **Falls short of:** design.md §3E ("never indicate … saved if the server rejected the change"; that holds, but the person isn't told), §8 ("useful error messages"), and §9 ("clearly distinguish authentication failures").
- **Proposed fix:** when a save is refused because the session ended, show a line on the sign-in card: "You were signed out, so your last change wasn't saved. Sign in to carry on."

## Progress

### 5. A volunteer's own department isn't marked or first (Medium)

- **Where:** Progress, all widths. Scheduled volunteers, and Technical Directors and Admins scheduled in a position.
- **What's wrong:** the checklist puts the person's own department first and marks it "Yours", but Progress lists departments in the checklist's order with no marking, so a camera operator has to find Camera Operators (third) themselves.
- **Screenshot:** [Progress as Test Camera Operator](design-review/progress-camera2-375.png).
- **Falls short of:** design.md §3C (own departments shown first and highlighted, which Progress could follow) and §6 (determine readiness "without manually reviewing").
- **Proposed fix:** on Progress, list the person's own departments first, marked "Yours", the same as the checklist. Every department still shows (US-09). This is display only and uses data the page already receives.

### 6. An expanded department repeats "Not done" under every open task (Medium)

- **Where:** Progress, an expanded department card, 375 px.
- **What's wrong:** every unchecked task has a "Not done" line under it, beside an empty circle that already says the same. On a phone, Presentation's 45 tasks become a very long list, and the few done tasks, with who did them and when (the useful part), get lost.
- **Screenshot:** [expanded card](design-review/progress-expanded-375.png).
- **Falls short of:** design.md §6 ("inspect individual task completion, including the volunteer's name and completion time") and §5 ("keep secondary information compact").
- **Proposed fix:** drop the visible "Not done" line, keeping the empty circle plus a screen-reader-only "Not done", so status is still never shown by colour alone. Show the name and time line only for done tasks.

### 7. White text on the red confirm button fails contrast (Medium)

- **Where:** the Reset checklist dialog (Progress) and the Hide confirmations (Admin › Checklist, Lists). All widths.
- **What's wrong:** white on `#EF4444` is **3.76:1**. Normal-size text needs 4.5:1 under WCAG AA. This is the button that confirms a reset, in a dark booth.
- **Screenshots:** [Reset dialog](design-review/progress-reset-dialog-375.png), [Hide dialog](design-review/admin-checklist-hide-dialog-375.png).
- **Falls short of:** design.md §12.11 and the WCAG 2.1 AA target in the build plan.
- **Proposed fix (pick one; your call, because it changes how a colour is used):**
  - **a. (recommended)** Near-black text (`#050505`) on the same red: **5.42:1**. The token colours stay as they are.
  - **b.** White text on a darker red such as `#B91C1C`: 6.47:1. That adds a colour outside the design tokens, so the brief would change.

### 8. "Reset checklist" is greyed out with the reason only in a tooltip (Low)

- **Where:** Progress, Admins and Directors, while nothing is checked.
- **What's wrong:** the button is disabled, and "Nothing is checked yet" exists only as a hover tooltip, which phones never show. A faded red button reads as broken.
- **Screenshot:** [Progress as Director](design-review/progress-director-1280.png).
- **Falls short of:** design.md §8 (consistent disabled states, useful messages).
- **Proposed fix:** while nothing is checked, add "Nothing to reset yet" to the card's text line ("This service hasn't been reset · Nothing to reset yet").

## Access screens

### 9. Nothing says volunteers are locked out while team mapping isn't set up (Medium)

- **Where:** Checklist, as Admin or Director, while no Service Type is chosen or nothing is linked. This is what the first Sunday after going live will look like if mapping is skipped.
- **What's wrong:** Admins and Directors see the normal checklist, while every volunteer sees "Almost ready. The app is being set up." Nobody with the power to fix it is told.
- **Screenshots:** [Admin's checklist during setup](design-review/checklist-admin-setup-375.png), and what volunteers see: [Almost ready](design-review/noaccess-setting-up-375.png).
- **Falls short of:** requirements v1.19 (only Admins and Directors get in until mapping is set up) and design.md §9 (fallback states properly designed).
- **Proposed fix:** a slim notice at the top of the checklist and Progress, for Admins and Directors only: "Volunteers can't get in yet: team mapping isn't set up." Admins also get a "Set up team mapping" link. **Your call**, because it's a small new notice.

### 10. "Almost ready" has no Try again button (Low)

- **Where:** the "Almost ready" page, Volunteers, all widths.
- **What's wrong:** "Check back soon" offers only Sign out, so checking back means reloading the page by hand. "Couldn't confirm your team" has a Try again button.
- **Screenshot:** [Almost ready](design-review/noaccess-setting-up-375.png).
- **Falls short of:** design.md §8 (consistent patterns).
- **Proposed fix:** add a primary "Try again" button that re-checks access, the same as the unreachable page.

## Admin

### 11. At 375 px the Admin tabs cut off with no sign they scroll (Low)

- **Where:** every Admin page at 375 px.
- **What's wrong:** the tab strip scrolls sideways, but nothing shows it: Users is clipped mid-word, and Activity and History are off screen. The "ADMIN" label takes up a tab's width.
- **Screenshot:** [tab strip at 375](design-review/admin-tabs-375.png).
- **Falls short of:** design.md §5 ("responsive navigation"; no content hidden).
- **Proposed fix:** hide the "ADMIN" label below 640 px (the header's Admin tab already says where you are), fade the right edge while more tabs are off screen, and scroll the current tab into view.

### 12. Unchecked tasks in a past service look like tappable checkboxes (Low)

- **Where:** Admin › History › a past service, all widths.
- **What's wrong:** the read-only record draws unchecked tasks as empty checkbox squares, the same as the live checklist, so they look tappable. Progress uses an empty circle for the same thing.
- **Screenshot:** [History detail](design-review/admin-history-detail-375.png).
- **Falls short of:** design.md §10 (reusable components, consistency) and §7 (History is read-only).
- **Proposed fix:** use Progress's tick and empty circle for done and not done.

### 13. Two different summary styles in one History list, unexplained (Low)

- **Where:** Admin › History list.
- **What's wrong:** services with a checklist record show "0 of 114 done". Older ones, from before the record existed, show "2 tasks checked · reset once". The reason isn't stated, so it looks inconsistent.
- **Screenshot:** [History list](design-review/admin-history-1280.png).
- **Falls short of:** design.md §8 (consistency).
- **Proposed fix:** under the older summaries, add a quiet "(full list not recorded)".

### 14. Two controls under 44 px (Low)

- **Where:** Admin › Checklist: the "All lists" link, 40×17 px at every width. Admin › Activity: the "All" filter, 41 px wide.
- **Screenshot:** [Admin › Checklist](design-review/admin-checklist-375.png).
- **Falls short of:** design.md §3E and §5 (44 px minimum).
- **Proposed fix:** give "All lists" a 44 px tall padded hit area, and give the filter chips a minimum width of 44 px.

### 15. Team mapping's "Fetched …" time is out of line at desktop (Low)

- **Where:** Admin › Team mapping, 1280 px.
- **What's wrong:** the time sits under the Refresh button but is offset to the right of it.
- **Screenshot:** [Team mapping](design-review/admin-mapping-1280.png).
- **Proposed fix:** left-align it with the button.

### 16. "Admins only" page has no heading or way back (Low)

- **Where:** an Admin address opened by a Director or Volunteer, e.g. from a bookmark.
- **What's wrong:** the message is a dashed empty-state box with no page heading (screen readers find no `h1`) and no link back to the checklist. The header links are still there.
- **Screenshot:** [as Director](design-review/adminonly-director-375.png).
- **Proposed fix:** make "Admins only" the page heading and add a "Go to the checklist" link.

## Everywhere

### 17. The header logo mark's text is 11 px (Low)

- **What's wrong:** the short name in the purple mark ("IFC") is 11 px, under the 12 px the brief's smallest size implies. It's decorative and hidden from screen readers, so this is polish.
- **Proposed fix:** 12 px. The mark grows to fit as it does now.

### 18. The focus ring flashes white for 150 ms before turning purple (Low)

- **What's wrong:** `transition-colors` also animates the outline colour, so a newly focused control's ring starts white and fades to purple. Once settled it's correct.
- **Proposed fix:** leave the outline out of the colour transition so the ring is purple at once.

### 19. The no-plan note names "Planning Center" in client code (Low)

- **What's wrong:** the outage banner uses the source's own name from the server, but the "No service is published in Planning Center yet" note has "Planning Center" written into the page code. Requirements C22 keeps the schedule source replaceable.
- **Proposed fix:** fill the name in from the same server value the banner uses. The wording stays as the requirements give it while Planning Center is the source.

### 20. Activity shows "tab —" when there's no tab ID (Low)

- **Where:** Admin › Activity, entries without a browser tab ID.
- **What's wrong:** "session 285ef777 · tab —" adds noise to every such entry.
- **Screenshot:** [Activity](design-review/admin-activity-375.png).
- **Proposed fix:** leave out the "tab" part when there's no tab ID.

---

## Not problems, for the record

- **"Today's" or "Upcoming" service and the date** show on the checklist and Progress, as design.md §3B asks.
- **The volunteer's name and role** are hidden in the phone header and shown in the name menu. design.md §3A allows this, and the avatar stays.
- **Admin pages use a centred column of about 850 px at desktop width.** §4's "avoid the narrow centered column" is about the checklist workspace; forms and lists read better at this width.
- **On a Director's Progress page, the Reset card shows above the departments.** It's quiet, and it confirms before acting.
