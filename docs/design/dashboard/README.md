# UtsavOS Dashboard Design

Design-only milestone for the UtsavOS Dashboard / Home screen.

**Not implemented in the application.** The landing page, app shell, API, database, auth, planning engine, and tests are unchanged.

## View the boards

Open these SVG files directly in a browser at 100% zoom:

- [Desktop — 1440 × 900](desktop-dashboard-1440x900.svg)
- [Tablet — 768 × 1024](tablet-dashboard-768x1024.svg)
- [Mobile — 375 × 812](mobile-dashboard-375x812.svg)
- [Mobile milestones — 375 × 812](mobile-milestones-375x812.svg)
- [Desktop no-event — 1440 × 900](desktop-no-event-1440x900.svg)
- [Proposal states — 1440 × 900](proposal-states-1440x900.svg)

The brand mark in the boards resolves to the existing `apps/web/public/brand/utsavos-icon-light.png`. The light-surface variant is used on the dashboard's light surfaces. The dark variant remains the favicon and dark-surface mark. Neither asset was modified.

## Read the handoff

- [Dashboard design and implementation handoff](DASHBOARD_DESIGN.md)
- [Machine-readable tokens](design-tokens.json)

The handoff covers brand reconciliation, tokens, desktop/tablet/mobile layout, component inventory, state matrix, proposal UX, navigation and interaction rules, data requirements, accessibility, and implementation guidance.

## Scope

Included:

- Dashboard / Home visual design and states.
- Pending, stale, no-pending, approved and rejected proposal states.
- No-event, single-event and multi-event behavior.
- Desktop, tablet and mobile adaptations.

Excluded:

- Dashboard implementation in React.
- Create Event Wizard, Event Overview, Adaptive Planning Studio, Budget Ledger implementation.
- Backend, API, database, auth, AI, deployment and CI changes.
- Landing-page changes.

## Sample data

Every person, event, amount, date and task in the boards is synthetic and marked as sample data. The event, budget and proposal values come from the existing flagship fixture; task titles and due dates are synthetic examples. None of it is production data. Do not seed it into the application.

## Reference limitation

The dashboard screenshot referenced in the brief was not present in the repository or the current message. The design uses the written brief and the existing landing-page token system as its authority. Reconcile against the screenshot when it is available rather than introducing a second visual language.

## Verification performed

- Rendered all six SVGs in Chromium at their exact canvas sizes.
- No failed asset requests and no console errors.
- Confirmed every text bounding box stays inside its canvas.
- Visually inspected all six boards and corrected action collisions, banner overflow, card overflow, arrow/text collisions, and the misleading “Within cap” status.
- These are design artifacts. They have not been integrated into the running app or tested against live API data.
