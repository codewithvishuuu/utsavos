# Frontend design

## Scope

This release ships a public landing page at `/` and the functional application shell behind it. The landing page follows the approved Gemini art direction: warm ivory, obsidian, terracotta and sage, an editorial serif display face, botanical line art, and tilted planning previews.

The dashboard visual design is now specified in [design/dashboard/](design/dashboard/README.md); its implementation remains deliberately deferred. The Studio visual language remains deferred. The working application screens keep their existing compact slate shell so this milestone does not redesign functionality that was already verified.

The saved Gemini reference is a conversation export, not a standalone artifact: its preview iframes (`shim.html`, `shim(1).html`) and `_files` directory were unavailable. The implementation follows the embedded design brief and implementation summary. Pixel-level comparison with the missing preview was not possible.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/login` | Sign up and log in |
| `/events` | List events, create an event |
| `/events/:id` | The working screen: budget summary, simulation, alternatives, proposals, revisions, ceremonies, guests, vendors, quotes, budget items, tasks and dependencies |
| `/demo` | Public read-only scenario, no account |

`App.tsx` uses a pathless layout route for the application shell, so `/` renders the landing page outside the shell while `/login`, `/events`, `/events/:id` and `/demo` keep the existing header and max-width main area. `main.tsx` mounts the router.

## Dashboard design (design-only)

The dashboard/home visual design is in [design/dashboard/](design/dashboard/README.md): desktop, tablet, mobile, no-event and proposal-state boards, plus tokens, component inventory, state matrix and implementation handoff. It is a design milestone only. No dashboard route, React component, backend change or landing-page change was made.

## Landing page

The page is a single route with local sections:

1. Hero and primary navigation.
2. The problem: a single guest-count change and its exact budget consequences.
3. The Adaptive Planning Studio: the flagship 180 → 240 scenario, six separate budget figures and four computed alternatives.
4. How it works: create, change, compare, approve.
5. Product capabilities: budget, guests, ceremonies and timeline, vendors and quotes, simulations, alternatives, revisions and export.
6. Intelligent assistance: AI explains and suggests; the deterministic engine owns every authoritative number.
7. Trust and control: draft proposals, explicit approval, immutable revisions and stale-approval refusal.
8. Final call to action and footer.

Every visible control is real: `Start Planning` goes to `/login`, `Explore the Experience` and the demo links go to `/demo`, and section links scroll to their real sections. The planning preview is a static, clearly labelled illustrative fixture; it does not pretend to be a live calculation or a working simulator.

## Visual system

- Landing colours: `#12100E` ink, `#FAF6F0` ivory, `#F2ECE2` cream, `#C85A32` terracotta, `#5F6F5E` sage and `#B08D57` gold. Darker and lighter variants are used where contrast requires them.
- Display type uses a system serif stack; body copy uses a system sans stack. No external fonts are loaded.
- The hero and footer use original inline SVG botanical line art and an abstract celebration arch. There is no photography or third-party image asset; the strict same-origin CSP is unchanged.
- The existing `utsavos-icon-dark.png` is used in the dark navbar and footer, where its near-black background and cream mark fit. The existing `utsavos-icon-light.png` is not needed on this page. The dark icon is also the favicon.
- The application shell keeps the existing Tailwind `.card`, `.btn`, `.input` and `.label` classes, slate neutrals, white cards, red errors and amber synthetic-data disclosure.
- Money is always formatted from integer paise with `Intl.NumberFormat("en-IN", {style: "currency", currency: "INR"})`.

## Interaction and accessibility

- One `<main>`, one `<h1>`, section `<h2>`s and card `<h3>`s; the footer and both navigation areas have labels.
- A skip link is the first focus stop and becomes visible on focus.
- Every link and button has a visible `focus-visible` outline. The mobile menu button exposes `aria-expanded`, opens a labelled navigation panel, closes on Escape, and returns focus to the button.
- The mobile menu is keyboard-operable; anchor links close it.
- The page respects `prefers-reduced-motion`: smooth scrolling is only enabled when reduced motion is not requested, and the menu icon transitions are disabled under reduced motion.
- Decorative SVGs and the footer watermark are hidden from assistive technology. The brand icon is decorative because the adjacent text already names UtsavOS.
- `@axe-core/playwright` 4.14.0 audits the landing page at 1440x900, 768x1024 and 375x812. The current run reports zero serious or critical violations, no CSP violations and no horizontal overflow.

A manual screen-reader walkthrough has not been performed. That remains a known gap.

## Application states

Every asynchronous application view handles loading, empty and error states in text. Buttons disable while a request is in flight. Errors render in a `role="alert"` block with the API's message and code.

The event screen separates:

1. **Committed plan** — six separate figures: total budget, reserve, spendable after reserve, projected spend, remaining total budget, and spendable shortfall (or remaining spendable when the plan fits).
2. **Simulate** — change controls and a projected budget summary plus computed impact.
3. **Alternatives** — one card per computed option, each with its trade-offs.
4. **Proposals** — draft, approve, reject.
5. **Revisions** — before/after summaries.
6. **Setup** — ceremonies, guests, vendors, quotes, budget items, tasks and dependencies, each with a creation form.
7. **AI** — provider status, consent, explain, preferences, directions.

The event screen uses `BudgetSummary` for both the persisted plan and the simulation's projected result. The projected card is labelled separately so the two cannot be confused.

## Application interaction rules

- Event headcount is not editable in setup. Headcount changes go through simulation and an approved proposal; adding a guest-list entry does not change the event headcount.
- Approval is a deliberate click on a specific draft proposal. There is no auto-approve.
- Destructive actions (delete event, delete account) require confirmation.
- AI output is labelled with its provider and a fallback reason when deterministic.
- The demo page states that data is synthetic before showing figures.

## Known UI limitations

- The landing page uses original SVG art instead of photography because no licensed celebration photography exists in the repository and external images are blocked by CSP.
- The Gemini conversation's generated preview assets are missing, so the page cannot be checked against the original preview at pixel level.
- No optimistic updates, offline support, drag-and-drop, or keyboard shortcuts.
- No pagination for large event lists.
- No dark mode.
- No file upload, PDF import, or vendor search.
- The browser E2E requires PostgreSQL and a built SPA; it is not wired into CI.
- The event screen is dense on mobile. It stacks without horizontal overflow at 375px, but it is not a designed mobile experience.

These are recorded rather than hidden.
