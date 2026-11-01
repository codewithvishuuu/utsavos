# UtsavOS Dashboard — High-Fidelity Design and Implementation Handoff

**Status:** Design milestone complete. Not implemented in the application.  
**Scope:** Dashboard / Home screen only. The Create Event Wizard, Event Overview, Adaptive Planning Studio, Budget Ledger, backend, and landing page are out of scope for this milestone.  
**Brand authority:** The existing UtsavOS landing page and its token system.  
**Sample data:** Every event, person, amount, task, and date in the boards is synthetic and labelled as sample data. No production data is represented.

---

## 1. Reference and authority

The brief asks for the attached dashboard screenshot as the primary layout reference. That image was not present in the repository or the current message. The repository contains no dashboard reference image; the only public brand raster assets are the two existing PNGs. The design therefore uses:

1. the written dashboard brief as the functional and layout specification;
2. the implemented landing page as the brand authority;
3. the existing product data model and routes as the capability boundary.

This is a documented reference gap, not a claim that the screenshot was reviewed. If the screenshot is supplied later, reconcile its spacing and composition against this token system rather than introducing a second brand language.

---

## 2. Design intent

The dashboard should feel like a **calm event-operations workspace**, not a generic AI SaaS dashboard.

- Warm ivory canvas, warm-white surfaces, thin neutral borders.
- Editorial serif for welcome, event names, and section headings.
- Clean sans for interface copy, labels, and actions.
- Monospaced figures for money, dates, counts, identifiers, and technical status.
- Terracotta is the single action/accent color. Sage is used only for confirmed/positive states. Warning and danger are reserved for stale proposals and overdue work.
- The sidebar is compact and persistent on desktop. Tablet and mobile use a labelled menu trigger and a focus-managed drawer.
- No decorative controls. Every visible action has a defined destination or an explicit future-integration status.
- A pending proposal is visibly **not applied**. Inspection, approval, and rejection remain separate actions.

---

## 3. Deliverables

| File | Purpose |
| --- | --- |
| `desktop-dashboard-1440x900.svg` | Desktop dashboard, selected event, pending proposal |
| `tablet-dashboard-768x1024.svg` | Tablet adaptation with top navigation and two-column metrics |
| `mobile-dashboard-375x812.svg` | Mobile viewport: welcome, proposal, event summary and metrics |
| `mobile-milestones-375x812.svg` | Mobile continuation: stacked preparation milestones |
| `desktop-no-event-1440x900.svg` | No-event state with clear Create Event action |
| `proposal-states-1440x900.svg` | Pending, stale, no-pending, approved and rejected states |
| `design-tokens.json` | Machine-readable token sheet |
| `DASHBOARD_DESIGN.md` | This specification and handoff |
| `README.md` | Index, viewing instructions, scope and sample-data disclosure |

Open the SVGs directly in a browser at 100% zoom. The brand mark is referenced from the existing `apps/web/public/brand/utsavos-icon-light.png`; the light-surface variant is correct for the dashboard. The dark variant remains the favicon and dark-surface mark. Do not recolor, stretch, or redraw either asset.

---

## 4. Brand reconciliation

The landing page is a marketing surface: large serif display type, dark sections, pill CTAs, botanical line art, generous section spacing. The dashboard is an operational surface. The following are preserved:

| Landing-page quality | Dashboard translation |
| --- | --- |
| Ivory, cream, ink, terracotta, sage, gold | Same palette; gold is decorative only |
| Editorial serif display | Welcome, event name, section headings |
| Avenir/Segoe sans interface text | Navigation, body, labels, buttons |
| Thin warm borders | 1px `#DED5C8` card and divider borders |
| Restrained botanical line art | Very low-opacity arch motif in event/empty states |
| Pill marketing CTAs | Workspace actions use a 10px radius for precision and density; same color, weight and focus treatment |
| Generous whitespace | More compact rhythm, but section gaps stay 16–24px |

The dashboard introduces no new brand color. It adds a monospaced financial layer and documented warning/danger states because the product needs inspectable money, reserve-adjusted shortfalls, and stale-proposal communication.

---

## 5. Design tokens

### 5.1 Color

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#FAF6F0` | Page background |
| `surface` | `#FFFDF9` | Cards, event summary, milestone cards |
| `surface-muted` | `#F4EDE3` | Neutral pills, disabled surfaces, secondary rows |
| `sidebar` | `#F2ECE2` | Desktop sidebar |
| `ink` | `#12100E` | Primary headings and high-emphasis text |
| `text-primary` | `#1E1A16` | Body text |
| `text-secondary` | `#5E574E` | Supporting copy, metadata |
| `text-tertiary` | `#7A7065` | Labels, hints, non-critical metadata |
| `border` | `#DED5C8` | Standard border |
| `border-strong` | `#C9BDAE` | Secondary button border |
| `accent` | `#C85A32` | Terracotta indicator, progress fill, focus accent |
| `accent-deep` | `#A84422` | Accessible terracotta text and primary button fill |
| `accent-soft` | `#F6E4DA` | Pending status pill |
| `accent-banner` | `#FBF0E9` | Pending proposal banner |
| `accent-border` | `#E8C9B8` | Pending proposal border |
| `positive` | `#5F6F5E` | Confirmed/active dot |
| `positive-deep` | `#3F4A3E` | Positive text |
| `positive-soft` | `#E8EEE4` | Positive status pill |
| `warning` | `#A36A1F` | Stale proposal, due-soon warning, spendable shortfall |
| `warning-soft` | `#F8EEDC` | Stale banner and warning card |
| `warning-border` | `#E4C9A4` | Stale border |
| `danger` | `#A33B2E` | Overdue/error text and dot, total-budget overrun |
| `danger-soft` | `#F7E4E0` | Overdue pill |
| `danger-border` | `#E8C4BD` | Error border |
| `gold` | `#B08D57` | Decorative accent only; never the sole status cue |
| `focus` | `#A84422` | Focus ring on light surfaces |
| `focus-on-accent` | `#12100E` | Focus ring on terracotta fills |

**Contrast rule:** use `accent-deep`, not `accent`, for small terracotta text. Use `text-secondary` or darker for body copy. Gold is not used for body text. Status is always carried by text plus a dot/background, never color alone.

### 5.2 Typography

| Token | Font | Size / line-height | Weight | Use |
| --- | --- | --- | --- | --- |
| `display.xl` | Serif | 44 / 48 | 400 | Desktop welcome |
| `display.l` | Serif | 32 / 36 | 400 | Event name, empty-state heading |
| `display.m` | Serif | 26 / 32 | 400 | Section heading |
| `display.s` | Serif | 22 / 28 | 400 | Proposal title, card heading |
| `body.l` | Sans | 14 / 22 | 400 | Main supporting copy |
| `body.m` | Sans | 13 / 20 | 400 | Standard interface copy |
| `body.s` | Sans | 12 / 18 | 400 | Dense metadata |
| `caption` | Sans | 11 / 16 | 400 | Hints, footnotes |
| `eyebrow` | Sans | 10 / 14 | 600 | Uppercase section labels, 0.16em tracking |
| `nav` | Sans | 13 / 20 | 500 | Sidebar and drawer navigation |
| `button` | Sans | 12 / 16 | 600 | Buttons |
| `mono.l` | Mono | 26 / 32 | 500 | Hero financial figures |
| `mono.m` | Mono | 22 / 28 | 500 | Metric values |
| `mono.s` | Mono | 13 / 20 | 500 | Dates, counts, IDs |
| `mono.xs` | Mono | 11 / 16 | 500 | Status metadata, technical labels |

**Production minimum:** do not render interface text below 11px, and do not render body copy below 12px. The SVG boards use a slightly tighter optical scale for dense metadata at 1x; the token sizes above are the accessible implementation values. Do not copy raw SVG `font-size` attributes into CSS.

Font stacks:

```text
display: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif
sans:    "Avenir Next", Avenir, "Segoe UI", Helvetica, Arial, sans-serif
mono:    ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace
```

No external fonts are required. This preserves the landing page's same-origin asset posture.

### 5.3 Spacing, radii, borders, shadows

| Token | Value |
| --- | --- |
| `space.1`–`space.12` | 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 |
| `page.padding.desktop` | 32px |
| `page.padding.tablet` | 32px |
| `page.padding.mobile` | 16px |
| `card.padding.desktop` | 24px |
| `card.padding.tablet` | 22px |
| `card.padding.mobile` | 16px |
| `section.gap.desktop` | 24px |
| `section.gap.tablet` | 20px |
| `section.gap.mobile` | 16px |
| `grid.gap.desktop` | 16px |
| `grid.gap.mobile` | 12px |
| `radius.sm` | 8px |
| `radius.md` | 10px (buttons) |
| `radius.lg` | 14px (milestones) |
| `radius.xl` | 16px (proposal, empty state) |
| `radius.2xl` | 20px (event summary) |
| `radius.pill` | 999px |
| `border.width` | 1px |
| `shadow.card` | `0 1px 2px rgba(18,16,14,0.04)` |
| `shadow.drawer` | `0 24px 64px rgba(18,16,14,0.18)` |

Metric cards do not get shadows. Borders carry the separation.

### 5.4 Layout dimensions

| Token | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Sidebar | 252px persistent | Drawer 320px | Drawer 320px |
| Top bar | 68px | 64px | 56px |
| Content width | 1124px | 704px | 343px |
| Button height | 36px (44px hero CTA) | 40px | 44px |
| Icon-only target | 36px | 44px | 44px |
| Event metrics | 4 columns | 2 × 2 | 1 column |
| Milestones | 2 columns | 2 columns | 1 column |
| Brand icon | 32px | 30px | 28px |

Hero and empty-state primary CTAs are 44px at every breakpoint. Standard desktop controls are 36px; tablet controls are 40px with a 44px hit area.

### 5.5 Breakpoints

| Name | Width | Behavior |
| --- | --- | --- |
| `sm` | 640px | Mobile spacing, single column |
| `md` | 768px | Tablet: top bar, drawer, 2-column metrics/milestones |
| `lg` | 1024px | Desktop sidebar becomes persistent |
| `xl` | 1280px | Desktop content width settles at 1124px |
| `2xl` | 1440px | Reference desktop canvas |

### 5.6 Focus and motion

- Focus ring: 2px solid `#A84422`, 2px offset, follows the element radius.
- On terracotta fills: 2px solid `#12100E`, 2px offset.
- Use `:focus-visible`; never remove the browser focus outline without replacement.
- Hover/press: 120ms.
- Drawer: 180ms ease-out.
- Banner entry: 220ms ease-out, translate 8px + opacity.
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Reduced motion: 0ms transitions, no transforms, drawer opens instantly, no smooth scrolling. Content must never depend on animation to appear.
- Do not animate financial values, counters, or status changes.

---

## 6. Layout specification

### 6.1 Desktop — 1440 × 900

- Canvas: `#FAF6F0`.
- Sidebar: 252px, full height, `#F2ECE2`, 1px right border.
- Main top bar: 68px, breadcrumb left, actions right.
- Main content: 32px padding, 1124px width.
- Vertical rhythm:
  - Welcome block: 92–180px.
  - Pending proposal: 192–296px.
  - Event summary: 312–604px.
  - Upcoming preparation: heading 632–664px, cards 676–888px.
- Sidebar groups:
  1. Brand lockup.
  2. Workspace: Dashboard (active), Create event.
  3. Active celebration: selected event row, then event-specific navigation.
  4. Resources: Public demo.
  5. Honest local-status row.
  6. Compact profile area.
- Event summary: header, four metric columns, footer. The four metrics are separated by 1px vertical rules, not four separate heavy cards.
- Milestones: two columns, two rows, 16px gap.

### 6.2 Tablet — 768 × 1024

- No persistent sidebar. A 64px top bar carries brand, Simulate change, Create event, and a 44px menu trigger.
- Menu trigger opens a 320px drawer with the full sidebar content. The drawer is a modal dialog: labelled “Workspace navigation”, focus trapped, Escape closes, focus returns to the trigger.
- Content width: 704px, 32px side padding.
- Proposal banner wraps: text/impact left, actions right; the impact line stays clear of the action column.
- Event metrics become a 2 × 2 grid with internal dividers.
- Milestones remain two columns; each card is wide enough for the title and due date.
- The top bar must never overflow; at 768px the brand, two actions and menu trigger fit with a 6px visual gap between Create event and the menu trigger.

### 6.3 Mobile — 375 × 812

- Top bar: 56px, brand lockup and 44px menu trigger.
- Content width: 343px, 16px side padding.
- Welcome heading wraps naturally to two lines.
- A full-width 44px Create event primary action follows the welcome copy.
- Proposal banner is 164px tall:
  - status row,
  - title,
  - draft/base line,
  - projected spend,
  - spendable shortfall,
  - 36px Inspect proposal button and inline Review in Studio link.
- Event summary is a single-column card:
  - event name and Open overview link,
  - type/location/date,
  - active status and countdown,
  - four metric blocks stacked with 1px dividers,
  - footer with plan version and Open budget ledger.
- The first viewport ends after the event summary. Milestones continue below the fold in the second board.
- No horizontal scrolling. Financial values use the mono stack and must not be broken or clipped. If a value cannot fit, wrap the label, never the number.

---

## 7. Component inventory

| Component | Purpose | Inputs / data | Interactions | Responsive behavior | Empty / loading / error |
| --- | --- | --- | --- | --- | --- |
| `DashboardShell` | Page frame, landmarks, background | current user, selected event id, children | skip link, route changes | Sidebar desktop; top bar + drawer below 1024px | Shell remains during loading/error |
| `WorkspaceSidebar` | Primary, event, and resource navigation | user, events, selected event, pending proposal count | select event, navigate, create, public demo, profile menu | Persistent at ≥1024px; drawer below | No-event: empty celebration row and explanation; no fake nav |
| `WorkspaceTopbar` | Context, breadcrumb, primary actions | selected event, route | Simulate change, Create event, open menu | 68/64/56px; menu appears below 1024px | Simulate disabled when no event; no health claim |
| `WelcomeHeader` | Editorial greeting and workspace summary | display name, event count, pending count, due count | none | 44/34/30px heading; wraps on mobile | Generic greeting when name unavailable |
| `PendingProposalBanner` | Surface a draft that needs review | proposal id/base version, scenario label, impact totals, stale flag | Inspect proposal, Review in Studio, Review changes, Re-simulate | 104px desktop; 120px tablet; 164px mobile | Hidden when no draft; stale variant; no-pending inline row |
| `ActiveCelebrationCard` | Event context and budget/guest summary | event, totals, proposal impact, ceremonies/vendors counts | Open overview, Open budget ledger, View revision history | 4/2/1 metric columns | No-event: replaced by EmptyState; loading skeleton; error retry |
| `BudgetMetricCard` | One budget metric block | label, value, supporting value, progress/status | none (group is a `<dl>`) | Grid cell; stacked on mobile | No data: “Not available”; never fake zero |
| `GuestMetricCard` | Baseline guest count and list summary | event.guest_count, guests array | none | Grid cell; stacked on mobile | Empty guest list: “Guest list not started”; no RSVP field |
| `PreparationMilestoneList` | Upcoming tasks section | tasks, today, max items | View all tasks, open task | 2 columns desktop/tablet; 1 mobile | Empty state, loading skeleton, section-level error |
| `PreparationMilestoneItem` | One task/milestone | title, due date, status, is_locked, derived overdue/due-soon | Open task | Full-width card in list | No owner/priority fields; show Unassigned and derive due-soon only |
| `EmptyState` | No-event or no-content explanation | title, body, primary/secondary actions | Create event, public demo, add task | Centered, generous padding | Used for no events and empty milestones |
| `LoadingState` | Preserve layout while data loads | section label | none | Skeletons match final blocks | No fake amounts or names |
| `ErrorState` | Recoverable data failure | message, retry action | Retry | Inline card or section banner | Never replace the whole shell unless auth fails |

Supporting components: `MobileNavDrawer`, `EventSwitcher`, `ProfileMenu`, `StatusPill`, `MetricDivider`, `SectionHeader`.

---

## 8. State matrix

| State | Sidebar | Top bar | Proposal area | Event summary | Milestones | Primary action |
| --- | --- | --- | --- | --- | --- | --- |
| No events | Empty celebration row + explanation; event tools hidden | Simulate disabled; Create event enabled | None | Replaced by no-event EmptyState | Hidden | Create event |
| One event (selected) | Selected event row + event nav | Simulate enabled | Pending banner if draft exists; otherwise none | Full four-metric card | Upcoming tasks | Inspect proposal or Create event |
| Multiple events | Selected event row + event switcher; count of others | Simulate applies to selected event | Applies to selected event only | Selected event only | Selected event only | Switch event or inspect proposal |
| Pending proposal | Adaptive studio badge/count | Simulate enabled | Terracotta pending banner; “Not applied” | Committed/planned metric shows the pending delta as a distinct planned segment; total/remaining/shortfall use the draft's `proposal.impact` projection with warning text | Unchanged | Inspect proposal |
| Stale proposal | Same event context | Simulate enabled | Warning banner: baseline changed; approval blocked | Current plan only; no stale delta presented as pending | Unchanged | Review changes / Re-simulate |
| Approved proposal | Revision count updates after refresh | Simulate enabled | No pending banner; revision history shows approved | Plan version reflects the approved revision | Unchanged | Open revision history |
| Rejected proposal | Same | Simulate enabled | No pending banner; revision history shows rejected | Plan unchanged | Unchanged | Open revision history |
| No pending proposal | Same | Simulate enabled | No terracotta banner; optional slim “No proposals awaiting review” row | Current plan only | Upcoming tasks | Open Studio |
| No upcoming milestones | Same | Same | Same | Same | Empty state: “No upcoming milestones” + Add task | Add task |
| Loading | Shell + skeleton rows | Actions disabled until event loads | Skeleton block | Skeleton card | Skeleton rows | None |
| Error | Shell | Actions disabled | Section error | Error card with retry | Section error | Retry |

### 8.1 Proposal state rules

- **Pending:** `proposal.status === "draft"` and `proposal.base_version === event.version`.
- **Stale:** `proposal.status === "draft"` and `proposal.base_version < event.version`; or an approval request returned `409 baseline_changed`. Show the warning banner and block approval.
- **Approved:** `proposal.status === "approved"`; show in revision history, never as an attention banner.
- **Rejected:** `proposal.status === "rejected"`; show in revision history, plan unchanged.
- **No pending:** no draft proposals. Do not render the terracotta banner. A slim neutral row may say “No proposals awaiting review” and link to Studio.
- Inspection is not approval. Do not optimistically update the event summary after clicking Inspect. After approval, refetch the plan; do not animate or fake the new numbers.

---

## 9. Interaction and navigation specification

### 9.1 Existing routes and actions

The current application has these valid routes: `/`, `/login`, `/events`, `/events/:id`, `/demo`. The current event detail page contains the budget summary, simulate/change, proposals, guests, tasks, vendors and revisions sections. There are no separate Budget Planner, Adaptive Studio, Impact Ledger, Guests, Tasks, or Vendors routes yet.

The sidebar items in this design are therefore **implementation targets**, not existing routes:

| Control | Target | Status |
| --- | --- | --- |
| Dashboard | Future dashboard route (this design) | Design target; not implemented |
| Create event | `/events` (existing create form) | Existing destination; future wizard can replace |
| Overview | `/events/:id` top / `#overview` | Existing page; anchor to add |
| Budget planner | `/events/:id#budget` | Existing budget section; anchor to add |
| Adaptive studio | `/events/:id#studio` | Existing simulate section; anchor to add |
| Impact ledger | `/events/:id#ledger` | Existing proposals/revisions section; anchor to add |
| Guests | `/events/:id#guests` | Existing guests panel; anchor to add |
| Timeline & tasks | `/events/:id#tasks` | Existing tasks panel; anchor to add |
| Vendors | `/events/:id#vendors` | Existing vendors panel; anchor to add |
| Public demo | `/demo` | Existing route |
| Profile menu / Sign out | existing auth sign-out | Existing action; Account is future |
| Simulate change | `/events/:id#studio` | Existing action; disabled when no event |
| Create event (top bar) | `/events` | Existing destination |
| Inspect proposal | `/events/:id#proposals` | Existing proposal section; anchor to add |
| Review in Studio | `/events/:id#studio` | Existing simulate section |
| Open overview | `/events/:id` | Existing page |
| Open budget ledger | `/events/:id#budget` | Existing budget section |
| View revision history | `/events/:id#revisions` | Existing revisions data; anchor to add |
| View all tasks | `/events/:id#tasks` | Existing tasks panel |
| Open task | `/events/:id#tasks` + task focus | Existing task list; deep-link target to add |

Do not render a nav item as a working link until its anchor/route exists. If an item is shown before implementation, mark it clearly as future or use a non-link disabled treatment. Do not invent a working approval, payment, export, search, notification, or AI action.

### 9.2 Top bar

- Breadcrumb: non-interactive context. “Workspace / Dashboard”.
- “SAMPLE” pill: visible only in design/demo data. Do not show it for real user data.
- “Simulate change”: secondary button, 36/40px. Opens the Studio section for the selected event. Disabled with an accessible explanation when no event is selected.
- “Create event”: primary terracotta, 36/40/44px. Current destination `/events`; future wizard can replace it without changing the visual contract.
- Menu trigger (tablet/mobile): 44px hit area (36px visual circle), label “Open navigation”. Opens the drawer; `aria-expanded`, `aria-controls`.

### 9.3 Sidebar and drawer

- Dashboard is the active item: terracotta left rule, warm-white surface, dark text. Active state is not color-only; it also has a rule and surface.
- Event row is a contextual navigation item, not a decorative card. Selecting it opens the event overview. A separate chevron/switcher opens the event list when multiple events exist.
- Event navigation is grouped under the selected event. It must not appear as if it applies to a different event.
- Adaptive studio shows a small pending count when a draft exists. The count is not a fake notification; it comes from `proposals.filter(status === "draft").length`.
- “Public demo” is a real link to `/demo`.
- “Local workspace / Engine status not monitored” is static context, not a health claim. Do not show a green “All systems operational” state until a real status endpoint is wired and the UI can confirm it.
- Profile area is a button that opens a menu. Menu items: Sign out (existing), Account (future, mark as future or omit). Do not hardcode a fake identity in production; use the authenticated `User.display_name`.
- Drawer behavior: scrim, focus trap, Escape closes, focus returns to trigger, body scroll lock, `role="dialog"` + `aria-modal="true"` + labelled title. Do not use a hover-only menu.

### 9.4 Proposal banner

- Pending: terracotta banner, status pill “AWAITING REVIEW”, title from the proposal scenario, “Draft · base v{n} · Not applied”, deterministic impact summary, primary “Inspect proposal”, secondary “Review in Studio”.
- Stale: warning banner, “BASELINE CHANGED”, title “Review the new baseline before approving”, explanation that approval is blocked and the saved plan is unchanged, primary “Review changes”, secondary “Re-simulate”.
- No pending: no terracotta banner. Use a slim neutral row only if the page needs an explicit all-clear; otherwise let the event card move up.
- Approved/rejected: no attention banner. Show the decision in revision history.
- Approval must remain a separate action in the proposal detail. The dashboard banner never approves directly.

### 9.5 Event summary

- “Open overview” and “Open budget ledger” are text links with arrows; 44px touch targets on tablet/mobile.
- “View revision history” is a text link in the footer. If the revision list is not yet a dedicated view, anchor to the existing revisions section.
- The four metrics are a description list (`<dl>`), not four unrelated cards. Each metric has a label, a value, and one or two supporting lines.
- The event status pill maps the API's `planning`, `approved`, `cancelled` statuses to Planning, Approved, Cancelled. Do not show a generic “Active” status; the API has no such event status.
- The event summary has two data modes:
  - **No pending draft:** all four metrics come from `plan.totals` and describe the saved plan.
  - **Pending draft:** the total-budget, projected-spend, reserve, remaining-total and spendable-shortfall figures are the draft's deterministic projection (`proposal.impact`); the committed/planned metric still shows current `plan.totals.committed_minor` plus the pending delta. The banner's “Not applied” and the accessible description must make the projection explicit. Never present the draft projection as the saved plan.
- Distinguish three financial states using the domain definitions:
  - If `committed_minor > budget_minor` (total budget overrun), use danger text + dot + “Over total budget” and the exact overrun.
  - Else if `over_budget` is true (API definition: `committed_minor > spendable_minor`, reserve-adjusted), use warning text + dot + “Spendable shortfall” and `spendable_shortfall_minor`. This is the flagship pending scenario: the total cap still has ₹99,200, but the reserve leaves a spendable shortfall of ₹80,800.
  - Else use sage text + dot + “Within spendable budget” or “Within total cap”.
- Do not use `over_budget` to mean “over total budget”; the API defines it against spendable. Never show a green “Within cap” when a spendable shortfall exists.
- The guest metric must not show an RSVP percentage because the current model has no RSVP field. Show baseline guest count and guest-list entries/seats instead.
- The committed/planned metric must keep the definitions explicit: committed = current saved plan `committed_minor`; planned = pending draft delta (`proposal.impact.committed_minor - plan.totals.committed_minor`), not applied. If no draft exists, show “No pending change”.
- The footer plan version comes from the event/revision data. Do not invent a version.

### 9.6 Milestones

- Section header: “Upcoming preparation”, concise count/summary, “View all tasks”.
- Each card: status pill, due date, title, owner/unassigned line, optional due-soon dot, arrow.
- Status values come from `PlanTask.status` (`todo`, `in_progress`, `done`, `cancelled`). Display labels: Upcoming, In progress, Done, Cancelled. “Overdue” is derived from `due_date < today` and status not done/cancelled. “Due soon” is derived from the due date; it is not a stored priority field.
- Owner is not in the current task model. Show “Owner unassigned” as an honest state. Do not invent a vendor/owner relationship. A future owner field can fill this line without changing the layout.
- Priority is not in the current model. The small terracotta dot is a derived “due soon” indicator, not a stored priority. If a priority field is added later, map it to the same dot/label slot.
- Empty: “No upcoming milestones” with “Add task” and a short explanation. Do not fill with fake tasks.
- Loading: skeleton cards matching the final height. Error: section-level error with Retry; the event summary remains usable.

---

## 10. Data requirements and assumptions

### 10.1 Available data

| UI value | Source |
| --- | --- |
| User greeting/name | `User.display_name`; fall back to “there” or a neutral greeting |
| Event name/type/city/date | `EventDto.name`, `event_type`, `city`, `event_date` |
| Event status/version | `EventDto.status`, `EventDto.version`; display mapping: `planning` → Planning, `approved` → Approved, `cancelled` → Cancelled |
| Total budget cap | `EventDto.budget_minor` / `Totals.budget_minor`; if a pending draft changes budget, use `proposal.impact.budget_minor` and label the projection |
| Reserve | `Totals.reserve_minor`; if a pending draft changes reserve, use `proposal.impact.reserve_minor` and label the projection |
| Spendable after reserve | `Totals.spendable_minor`; same rule for a draft that changes budget/reserve |
| Current committed | `Plan.totals.committed_minor` |
| Pending draft projection | `Proposal.impact` (`committed_minor`, `remaining_budget_minor`, `remaining_spendable_minor`, `spendable_shortfall_minor`, `over_budget`); shown only while a draft is pending |
| Remaining total budget | `Plan.totals.remaining_budget_minor` (saved) or `proposal.impact.remaining_budget_minor` (pending projection) |
| Remaining spendable / shortfall | `Plan.totals.remaining_spendable_minor` / `spendable_shortfall_minor` (saved) or the same fields on `proposal.impact` (pending projection) |
| Guest baseline | `EventDto.guest_count` |
| Guest list entries/seats | `Plan.guests.length`, sum of `guest.party_size` |
| Ceremonies/vendors counts | `Plan.ceremonies.length`, `Plan.vendors.length` |
| Tasks | `Plan.tasks` (`title`, `due_date`, `status`, `is_locked`) |
| Proposals | `Plan.proposals` (`status`, `base_version`, `scenario`, `impact`, `created_at`) |
| Revisions | `Plan.revisions` (`version`, `created_at`, `proposal_id`) |
| Pending count | drafts in `Plan.proposals` |

`over_budget` is defined as `committed_minor > spendable_minor`; it is reserve-adjusted, not a total-budget overrun. A total-budget overrun is `committed_minor > budget_minor` and needs its own label if shown.

### 10.2 Derived display values

- **Countdown:** days from today to `event_date`; display only when the date is in the future. Do not show negative countdowns.
- **Overdue:** `due_date < today` and task status not done/cancelled.
- **Due soon:** due within 7 days and not done/cancelled; used for the small dot/label.
- **Pending delta:** `proposal.impact.committed_minor - plan.totals.committed_minor` for display only. Never use it as the authoritative total; the proposal detail shows the full deterministic impact.
- **Total budget overrun:** `committed_minor > budget_minor`. This is distinct from the API's reserve-adjusted `over_budget`; do not merge the two labels.
- **Stale:** client-side `base_version < event.version` check, or a `409 baseline_changed` response. Re-fetch the plan before showing the current numbers.
- **Plan version:** `event.version` or the latest revision version; label it “Plan v{n}”.

### 10.3 Fields that do not exist

Do not invent these in the dashboard:

- RSVP status, confirmed count, or RSVP percentage.
- Task owner, vendor assignment, or priority.
- Payment status, invoices, or actual spend.
- A planning-engine health status.
- A separate approved-spend field.
- A search index, notifications, or AI chat.

If a future milestone adds them, extend the existing components without changing the visual hierarchy.

### 10.4 Sample data disclosure

The boards use the existing synthetic flagship scenario: Ananya & Rohan, Hyderabad, 14 Feb 2027, 180 → 240 guests, ₹18,00,000 budget, ₹1,80,000 reserve, projected spend ₹17,00,800, pending delta ₹2,35,200, spendable shortfall ₹80,800. The desktop, tablet and no-event top bars carry a “SAMPLE” pill; every board also marks the welcome/context area as “SAMPLE” or “SAMPLE WORKSPACE”. Do not ship these values as real user data.

The main boards show the event in `planning` status, the saved plan as `PLAN V1`, and the pending draft as `base v1`, which is why the draft is pending rather than stale. The state sheet's approved and stale cards show the later `v2` baseline. The task titles and due dates in the milestone boards are synthetic examples; they are not seeded production records.

### 10.5 Multi-event support

- The selected event is the only event whose budget, proposal, guests and milestones appear in the main content.
- The sidebar event row is a switcher when more than one event exists; selecting another event changes the whole event context.
- Do not merge budgets or proposals from multiple events.
- The no-event state is a first-class state, not an empty card with zeros.

---

## 11. Accessibility checklist

- [x] One `<h1>` per screen: the welcome heading.
- [x] Section headings in logical order: event summary and upcoming preparation are `<h2>`; milestone titles are `<h3>`.
- [x] Landmarks: `<aside aria-label="Workspace navigation">`, `<header>`, `<main>`, `<section aria-labelledby>`.
- [x] Skip link to main content; visible on focus.
- [x] Keyboard access for every link, button, menu trigger, event switcher and drawer.
- [x] Drawer: `aria-expanded`, `aria-controls`, `role="dialog"`, `aria-modal="true"`, labelled title, focus trap, Escape, focus return.
- [x] Visible focus ring on light and terracotta surfaces.
- [x] Active navigation state is not color-only: terracotta rule + surface + text.
- [x] Status pills include text, not just a dot or color.
- [x] Budget metrics use a semantic description list; values are not read as one unstructured paragraph.
- [x] Financial figures use tabular numerals and the mono stack; labels can wrap, numbers cannot be clipped.
- [x] Financial status is not color-only: “Spendable shortfall” or “Over total budget” text accompanies the dot.
- [x] A pending projection is announced as not applied; accessible descriptions distinguish saved-plan totals from `proposal.impact`.
- [x] Touch targets: 44px minimum hit area on tablet/mobile. Tablet controls are 40px visual with a 44px hit area; mobile primary actions are 44px. Desktop pointer controls are 36px.
- [x] No horizontal scrolling at 375px; long titles wrap; amounts stay on one line.
- [x] Reduced-motion support: no transform-based drawer animation, no smooth scroll, no value animation.
- [x] Color contrast: body text uses `text-secondary`/`text-primary`; terracotta text uses `accent-deep`; gold is not body text.
- [x] Empty/loading/error states are announced with text, not only skeletons.
- [x] Sample data is labelled; no fake user identity in production.
- [x] No decorative controls with undefined behavior.
- [ ] Manual screen-reader testing — not performed for these design artifacts. Do this during implementation with at least one desktop and one mobile screen reader.

---

## 12. Implementation handoff

### 12.1 Suggested component mapping

These are responsibilities, not mandatory file names. Reuse the project's existing React/TypeScript/Tailwind conventions.

```text
DashboardPage
  DashboardShell
    WorkspaceSidebar (desktop)
    MobileNavDrawer (tablet/mobile)
    WorkspaceTopbar
    WelcomeHeader
    PendingProposalBanner
    ActiveCelebrationCard
      BudgetMetricCard × 3
      GuestMetricCard
    PreparationMilestoneList
      PreparationMilestoneItem × n
    EmptyState
    LoadingState
    ErrorState
```

### 12.2 Data loading

1. Load the authenticated user and event list.
2. Choose the selected event from the route/query, or use the first event in the existing event-list order when no selection exists.
3. Load `GET /api/v1/events/{id}/plan` for the selected event.
4. Derive the pending proposal, stale flag, metric values, countdown, and milestone states in a small selector layer.
5. If a pending draft exists, build the projected event-summary figures from `proposal.impact` and keep current committed from `plan.totals`; label the projection as not applied. Without a draft, use `plan.totals`.
6. Do not mutate the plan optimistically after inspect/approve/reject. Refetch after a successful approval/rejection.

If the plan request fails, keep the shell and show a recoverable error; do not replace real values with sample values.

### 12.3 Tailwind / CSS tokens

Use the existing Tailwind names where possible:

```text
bg-ivory, bg-cream
text-ink, text-ink-soft
border-line
bg-terracotta, text-terracotta-deep
bg-sage, text-sage-dark
font-display, font-sans
```

Add only the missing semantic aliases (`surface`, `surface-muted`, `text-secondary`, `text-tertiary`, `accent-soft`, `accent-banner`, `warning`, `warning-soft`, `danger`, `focus`) rather than inventing a second palette. Add a `font-mono` stack for financial data.

### 12.4 Responsive implementation

- `lg` and up: persistent 252px sidebar; four-column metric row.
- `md` to `lg`: top bar + drawer; two-column metrics; two-column milestones.
- Below `md`: top bar + drawer; single-column metrics; stacked milestones.
- Use CSS grid, not fixed pixel positioning, for the metric and milestone layouts.
- Preserve the 44px touch targets on mobile. Do not shrink the menu trigger to an icon-only 24px control.

### 12.5 What not to do

- Do not implement the dashboard as part of this design milestone.
- Do not modify the landing page to match the dashboard.
- Do not add a second frontend app, duplicate brand assets, or a new icon library.
- Do not add dependencies for icons, charts, dates, or formatting; the existing stack is sufficient.
- Do not invent RSVP, owner, priority, health, payment, or AI-chat data.
- Do not render a green “healthy” indicator unless a real status endpoint is wired.
- Do not auto-approve a proposal or apply a draft change on inspection.
- Do not commit, push, deploy, or alter Git history as part of the design handoff.

### 12.6 Implementation test checklist

- [ ] `/` landing page unchanged; no dashboard code leaks into it.
- [ ] Dashboard route renders only for an authenticated user.
- [ ] No-event state shows Create event and no fake financial data.
- [ ] One-event and multi-event selection work.
- [ ] Pending banner shows only for a draft with `base_version === event.version`.
- [ ] Pending summary uses `proposal.impact` for projected figures and `plan.totals` for current committed; it is not presented as applied.
- [ ] Spendable shortfall is labelled as reserve-adjusted; `over_budget` is not presented as a total-budget overrun.
- [ ] Stale banner shows for an older base version or `409 baseline_changed`.
- [ ] Approval remains a separate action and refetches the plan.
- [ ] Rejected proposals do not change the plan.
- [ ] Empty milestones and empty guest list are honest empty states.
- [ ] 1440×900, 768×1024, 375×812: no horizontal overflow, no clipped text, no overlapping controls.
- [ ] Keyboard: skip link, sidebar, top bar, banner actions, event links, milestone cards, drawer.
- [ ] Focus returns to the menu trigger after the drawer closes.
- [ ] Reduced motion: drawer and banner appear without motion.
- [ ] Axe or equivalent: no serious/critical issues; verify contrast manually for all status colors.
- [ ] Screen-reader smoke test on desktop and mobile.

---

## 13. Design QA performed for these boards

- Rendered all six SVGs in Chromium at their exact canvas sizes.
- Confirmed no failed requests and no console errors; the existing brand PNG resolves from `apps/web/public/brand/`.
- Checked every text bounding box against the canvas bounds: no text outside the board.
- Visually inspected all boards at 1440×900, 768×1024 and 375×812.
- Corrected tablet proposal/action collisions, mobile banner overflow, mobile event-card overflow, arrow/text collisions, and an empty-state mid-word break.
- Replaced a misleading green “Within cap” status with a warning “Spendable shortfall ₹80,800” treatment, because the flagship scenario is within the total cap but short against the spendable amount after reserve.
- These are design artifacts only. They have not been implemented in the running React app and have not been tested against live API data.

---

## 14. Open items

1. **Missing dashboard screenshot:** reconcile when supplied; do not treat this document as a pixel match to an unseen reference.
2. **Current app lacks separate dashboard and event sub-routes:** the handoff lists anchor targets. Add anchors or routes before turning sidebar items into links.
3. **No RSVP/owner/priority/health fields:** the design deliberately uses baseline guests, guest-list entries/seats, “Owner unassigned”, derived due-soon, and a neutral local-status label.
4. **No manual screen-reader testing** of these design boards. Add it during implementation.
5. **Production typography:** the SVG boards use a compact optical scale; use the token sizes in Section 5.2 for accessible production text.

---

*End of dashboard design handoff.*
