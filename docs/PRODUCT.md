# Product

## The problem

Event planning tools store lists. Real planning is constraint management: a guest count changes catering and stationery, consumes reserve, pushes a budget over its limit, and forces a choice between trimming, releasing reserve, cutting guests, or raising budget. Most tools either hide that arithmetic or let an AI invent it.

UtsavOS makes the trade-off explicit and reviewable.

## Persona

**Ananya, 29, Hyderabad.** Planning a three-ceremony wedding on 14 February 2027 for 180 guests with a budget of ₹18,00,000 and a ₹1,80,000 reserve. She is comfortable with spreadsheets, not with accounting software. She needs to answer "what happens if 240 people come?" without rebuilding the sheet, and she needs the answer to be right.

All demo and flagship data is synthetic.

## Flagship scenario

| Field | Value |
| --- | --- |
| Event | Ananya's wedding, Hyderabad |
| Date | 2027-02-14 |
| Ceremonies | 3 |
| Guests | 180 |
| Budget | ₹18,00,000 (180,000,000 paise) |
| Reserve | ₹1,80,000 (18,000,000 paise) |
| Committed baseline | ₹14,65,600 (146,560,000 paise) |
| Spendable | ₹16,20,000 (162,000,000 paise) |

Change: guests 180 → 240.

| Computed result | Value |
| --- | --- |
| Projected spend after | ₹17,00,800 (170,080,000 paise) |
| Remaining total budget | ₹99,200 (9,920,000 paise) |
| Spendable shortfall | ₹80,800 (8,080,000 paise) |
| Alternatives | 4 |

The ₹80,800 shortfall is measured against the ₹16,20,000 spendable budget after the ₹1,80,000 reserve. It is not a shortfall against the ₹18,00,000 total budget; ₹99,200 of that total still remains.

The four alternatives are computed from the actual snapshot, not templated:

1. **Release reserve** — free ₹80,800 of reserve (leaving ₹99,200).
2. **Trim per guest** — reduce per-guest unit costs by about 9% (unit sum ₹3,583.32).
3. **Reduce guests** — 219 guests.
4. **Increase budget** — ₹18,80,800.

These exact values are asserted in backend tests and in the public demo golden test.

## What the product does

- Creates an event with a budget, reserve, date and guest count.
- Tracks ceremonies, budget line items, guests, vendors, quotes, tasks and task dependencies.
- Simulates a change without writing anything.
- Shows exact impact lines and feasible alternatives.
- Turns an alternative into a draft proposal.
- Requires explicit approval before mutating the event.
- Records an immutable revision with before/after snapshots and increments the event version once.
- Exports the plan as versioned JSON.
- Explains the computed impact with AI when the user has enabled it and consented.
- Offers a read-only public demo with the same engine and no database, auth or AI.
- Presents a public landing page at `/` with an honest illustrative flagship preview, clear AI boundaries, and working links to sign-in and the public demo.

## Non-goals for this release

- PDF or OCR quote extraction
- File uploads
- Vendor research or marketplace
- RSVP website
- Payments
- Multi-user collaboration or sharing
- Retrieval-augmented generation, vector search, agent frameworks
- Dashboard and Studio implementation (dashboard visual design is specified in `docs/design/dashboard`; Studio visual design remains deferred)

## Success criteria

1. The core loop works end to end: create → change → simulate → compare → review → approve/reject → persist revision → verify.
2. No authoritative number originates from a language model.
3. An unapproved change never mutates the event.
4. The app remains fully usable with no AI provider available.
5. The public demo is isolated from auth, database writes and AI.
6. Tests run against real PostgreSQL, not a substitute.
