export type Money = number;

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

export interface EventDto {
  id: string;
  name: string;
  event_type: string;
  city: string;
  event_date: string;
  guest_count: number;
  budget_minor: Money;
  reserve_minor: Money;
  currency: string;
  status: string;
  version: number;
}

export interface Totals {
  guest_count: number;
  budget_minor: Money;
  reserve_minor: Money;
  spendable_minor: Money;
  fixed_minor: Money;
  per_guest_minor: Money;
  committed_minor: Money;
  remaining_budget_minor: Money;
  remaining_spendable_minor: Money;
  per_guest_average_minor: Money;
  over_budget: boolean;
  spendable_shortfall_minor: Money;
  category_totals: Record<string, Money>;
}

export interface Ceremony {
  id: string;
  name: string;
  ceremony_date: string;
  guest_count: number;
  venue: string | null;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
}

export interface Quote {
  id: string;
  vendor_id: string;
  budget_item_id: string | null;
  amount_minor: Money;
  inclusions: string | null;
  exclusions: string | null;
  status: string;
  valid_until: string | null;
}

export interface Guest {
  id: string;
  full_name: string;
  party_size: number;
  dietary_tags: string | null;
  accessibility_notes: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export interface PlanItem {
  id: string;
  label: string;
  category: string;
  basis: "fixed" | "per_guest";
  unit_amount_minor: Money;
  quantity: number;
  vendor_id: string | null;
  quote_minor: Money | null;
  is_optional: boolean;
}

export interface PlanTask {
  id: string;
  title: string;
  status: string;
  due_date: string;
  offset_days: number | null;
  is_locked: boolean;
}

export interface Revision {
  id: string;
  version: number;
  proposal_id: string | null;
  before_json: Record<string, unknown>;
  after_json: Record<string, unknown>;
  created_at: string;
}

export interface Proposal {
  id: string;
  status: "draft" | "approved" | "rejected";
  base_version: number;
  baseline_hash: string | null;
  scenario: Record<string, unknown>;
  impact: Totals;
  alternatives: Alternative[];
  created_at: string;
  decided_at: string | null;
  revision_id: string | null;
}

export interface Plan {
  event: EventDto;
  baseline_hash: string;
  totals: Totals;
  ceremonies: Ceremony[];
  items: PlanItem[];
  tasks: PlanTask[];
  dependencies: { predecessor_id: string; successor_id: string }[];
  vendors: Vendor[];
  quotes: Quote[];
  guests: Guest[];
  proposals: Proposal[];
  proposal_total?: number;
  revisions: Revision[];
  revision_total?: number;
}

export interface Page<T> {
  items: T[];
  total?: number;
  limit?: number;
  offset?: number;
}

export interface Change {
  kind: "guest_count" | "budget" | "date" | "quote" | "items";
  guest_count?: number;
  budget_minor?: number;
  reserve_minor?: number;
  event_date?: string;
  item_units?: Record<string, number>;
  quote_totals?: Record<string, number>;
}

export interface ImpactLine {
  kind: string;
  label: string;
  before: number | string;
  after: number | string;
  delta: number | string;
  value_type: "money" | "count" | "date";
}

export interface Alternative {
  id: string;
  title: string;
  summary: string;
  changes: {
    guest_count?: number;
    budget_minor?: number;
    reserve_minor?: number;
    item_units?: Record<string, number>;
  };
  cost_impact_minor: Money;
  budget_after_minor: Money;
  committed_after_minor: Money;
  feasible: boolean;
  trade_offs: string[];
  assumptions: string[];
}

export interface TaskChange {
  task_id: string;
  title: string;
  before: string;
  after: string;
}

export interface CeremonyChange {
  ceremony_id: string;
  name: string;
  before: string;
  after: string;
}

export interface Conflict {
  predecessor_id: string;
  successor_id: string;
  message: string;
}

export interface SimulationResult {
  change_kind: string;
  feasible: boolean;
  base_version: number;
  baseline_hash: string;
  baseline: Totals;
  projected: Totals;
  lines: ImpactLine[];
  task_changes: TaskChange[];
  ceremony_changes: CeremonyChange[];
  conflicts: Conflict[];
  alternatives: Alternative[];
  alternative_notes: string[];
  assumptions: string[];
  vendor_impacts: {
    vendor_id: string;
    before_minor: Money;
    after_minor: Money;
    delta_minor: Money;
  }[];
}

export interface ApprovalResult {
  proposal: Proposal;
  revision: Revision;
  idempotent_replay: boolean;
}

export interface AiStatus {
  local: { enabled: boolean; model: string; remote: boolean };
  cloud: {
    configured: boolean;
    enabled: boolean;
    model: string | null;
    consent_granted: boolean;
    policy_version: string;
  };
  deterministic_engine: string;
  disclosure: string;
}

export interface AiExplanation {
  provider: string;
  fallback_reason: string | null;
  explanation: string;
  trade_offs: string[];
  grounded: boolean;
  latency_ms: number;
  facts: Record<string, unknown>;
}

export interface DemoFixture {
  id: string;
  version: number;
  disclaimer: string;
  persona: { name: string; age: number; city: string };
  event: {
    name: string;
    city: string;
    event_date: string;
    guest_count: number;
    budget_minor: Money;
    reserve_minor: Money;
    currency: string;
  };
  scenario: { kind: string; guest_count: number; label: string };
  baseline: Totals;
  read_only: boolean;
}

export interface DemoResult {
  fixture: { id: string; version: number; disclaimer: string; persona: Record<string, unknown> };
  scenario: { kind: string; guest_count: number; label: string };
  baseline: Totals;
  result: SimulationResult;
  currency: string;
}
