import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import type {
  AiExplanation,
  AiStatus,
  Alternative,
  Change,
  Plan,
  Proposal,
  SimulationResult
} from "../api/types";
import { BudgetSummary } from "../components/BudgetSummary";
import { CeremoniesPanel } from "../components/CeremoniesPanel";
import { GuestsPanel } from "../components/GuestsPanel";
import { QuotesPanel } from "../components/QuotesPanel";
import { TasksPanel } from "../components/TasksPanel";
import { VendorsPanel } from "../components/VendorsPanel";
import { DashboardLoadingState } from "../components/dashboard/DashboardStates";
import { WorkspaceShell } from "../components/dashboard/WorkspaceShell";
import { ErrorAlert } from "../components/ErrorAlert";
import { Alert, ArrowRight, Calendar, MapPin, Sliders } from "../components/dashboard/icons";
import { formatDate, formatPaise, paiseToInput, rupeesToPaise } from "../lib/format";
import { useIdempotencyMutation } from "../lib/idempotency";
import { useRequireAuth } from "../lib/useAuth";

const SECTION_LABELS: Record<string, string> = {
  overview: "Overview",
  budget: "Budget",
  "budget-items": "Budget items",
  simulate: "Adaptive Studio",
  proposals: "Proposals",
  impact: "Impact Ledger",
  revisions: "Revision history",
  ceremonies: "Ceremonies",
  guests: "Guests",
  vendors: "Vendors",
  quotes: "Quotes",
  tasks: "Timeline & Tasks"
};

function proposalStatus(status: string): string {
  if (status === "draft") return "Awaiting review";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return status;
}

function proposalDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export type ProposalStaleness = "version" | "baseline" | "missing" | null;

export function proposalStaleness(proposal: Proposal, plan: Plan): ProposalStaleness {
  if (proposal.base_version !== plan.event.version) return "version";
  if (!proposal.baseline_hash) return "missing";
  if (proposal.baseline_hash !== plan.baseline_hash) return "baseline";
  return null;
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useRequireAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const [guestInput, setGuestInput] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [appliedChange, setAppliedChange] = useState<Change | null>(null);

  const [itemLabel, setItemLabel] = useState("Catering");
  const [itemCategory, setItemCategory] = useState("Catering");
  const [itemAmount, setItemAmount] = useState("3800");
  const [itemBasis, setItemBasis] = useState<"fixed" | "per_guest">("per_guest");

  const [explanation, setExplanation] = useState<AiExplanation | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [olderProposals, setOlderProposals] = useState<Proposal[]>([]);
  const [olderRevisions, setOlderRevisions] = useState<Plan["revisions"]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<Proposal | null>(null);
  const [rejectError, setRejectError] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);
  const rejectDialogRef = useRef<HTMLDialogElement>(null);
  const keepProposalRef = useRef<HTMLButtonElement>(null);
  const rejectReturnFocus = useRef<HTMLElement | null>(null);
  const rejectFocusSection = useRef(false);
  const rejectWasOpen = useRef(false);
  const draftInFlight = useRef(false);
  const simulateSeq = useRef(0);
  const loadSeq = useRef(0);
  const refreshSeq = useRef(0);
  const itemInFlight = useRef(false);
  const itemMutation = useIdempotencyMutation(`event:${id}:budget-items`);

  const load = useCallback(async () => {
    if (!id) return;
    const seq = ++loadSeq.current;
    simulateSeq.current += 1;
    setSimulation(null);
    setAppliedChange(null);
    setExplanation(null);
    setOlderProposals((current) => (current.length ? [] : current));
    setOlderRevisions((current) => (current.length ? [] : current));
    const fresh = await api.plan.get(id);
    if (seq !== loadSeq.current) return;
    setPlan(fresh);
    setGuestInput(String(fresh.event.guest_count));
    setBudgetInput(paiseToInput(fresh.event.budget_minor));
    setDateInput(fresh.event.event_date);
  }, [id]);

  const refreshAfterSave = useCallback(async () => {
    const seq = ++refreshSeq.current;
    setError("");
    try {
      await load();
      if (seq === refreshSeq.current) setRefreshError("");
    } catch (caught) {
      if (seq !== refreshSeq.current) return;
      const message =
        caught instanceof Error ? caught.message : "Could not load the latest plan";
      setRefreshError(
        `The change was saved, but the latest plan could not be loaded. ${message} Use Retry refresh; do not submit the same change again.`
      );
    }
  }, [load]);

  useEffect(() => {
    if (!user || !id) return;
    load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Could not load the event")
    );
    api.ai
      .status()
      .then(setAiStatus)
      .catch(() => setAiStatus(null));
  }, [user, id, load]);

  // The plan loads after the hash lands, so the browser cannot scroll to it on its own.
  const scrolledHash = useRef("");
  const skipHashScroll = useRef(false);
  useEffect(() => {
    if (!plan) return;
    const hash = location.hash.slice(1);
    if (!hash) {
      if (scrolledHash.current === "__overview") return;
      scrolledHash.current = "__overview";
      document.getElementById("overview")?.scrollIntoView({ block: "start" });
      return;
    }
    if (skipHashScroll.current) {
      skipHashScroll.current = false;
      scrolledHash.current = hash;
      return;
    }
    if (scrolledHash.current === hash) return;
    scrolledHash.current = hash;
    document.getElementById(hash)?.scrollIntoView({ block: "start" });
  }, [plan, location.hash]);

  useEffect(() => {
    const dialog = rejectDialogRef.current;
    if (!dialog) return;
    if (rejectTarget && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => keepProposalRef.current?.focus());
    } else if (!rejectTarget && dialog.open) {
      dialog.close();
    }
  }, [rejectTarget]);

  useEffect(() => {
    if (rejectTarget) {
      rejectWasOpen.current = true;
      return;
    }
    if (!rejectWasOpen.current) return;
    rejectWasOpen.current = false;
    const frame = window.requestAnimationFrame(() => {
      const fallback = document.getElementById("proposals-heading");
      const target = rejectFocusSection.current ? fallback : rejectReturnFocus.current;
      (target?.isConnected ? target : fallback)?.focus();
      rejectFocusSection.current = false;
      rejectReturnFocus.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [rejectTarget]);

  const section = location.hash.slice(1) || "overview";
  const sectionLabel = SECTION_LABELS[section] ?? "Overview";
  const current =
    section === "budget-items" ? "budget" : SECTION_LABELS[section] ? section : "overview";
  const previewCurrent = Boolean(
    simulation &&
      plan &&
      simulation.base_version === plan.event.version &&
      simulation.baseline_hash === plan.baseline_hash
  );

  function openCreate() {
    navigate("/events", { state: { create: true } });
  }

  async function signOut() {
    setSignOutError("");
    try {
      await api.auth.logout();
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message.replace(/\.$/, "")
          : "Could not reach the server";
      setSignOutError(`Sign out failed: ${message}. Try again.`);
      return;
    }
    navigate("/login", { replace: true });
  }

  async function retryLoad() {
    setError("");
    try {
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the event");
    }
  }

  async function retryRefresh() {
    if (refreshBusy) return;
    setRefreshBusy(true);
    try {
      await refreshAfterSave();
    } finally {
      setRefreshBusy(false);
    }
  }

  async function loadOlderProposals() {
    if (!id || !plan) return;
    setHistoryBusy(true);
    setError("");
    try {
      const page = await api.proposals.list(id, {
        limit: 20,
        offset: plan.proposals.length + olderProposals.length
      });
      setOlderProposals((current) => {
        const seen = new Set([...plan.proposals, ...current].map((proposal) => proposal.id));
        return [...current, ...page.items.filter((proposal) => !seen.has(proposal.id))];
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load older proposals");
    } finally {
      setHistoryBusy(false);
    }
  }

  async function loadOlderRevisions() {
    if (!id || !plan) return;
    setHistoryBusy(true);
    setError("");
    try {
      const page = await api.revisions.list(id, {
        limit: 50,
        offset: plan.revisions.length + olderRevisions.length
      });
      setOlderRevisions((current) => {
        const seen = new Set([...plan.revisions, ...current].map((revision) => revision.id));
        return [...current, ...page.items.filter((revision) => !seen.has(revision.id))];
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load older revisions");
    } finally {
      setHistoryBusy(false);
    }
  }

  function invalidatePreview() {
    simulateSeq.current += 1;
    setSimulation(null);
    setAppliedChange(null);
    setExplanation(null);
  }

  function buildChange(): Change | null {
    if (!plan) return null;
    const change: Change = { kind: "guest_count" };
    if (guestInput !== String(plan.event.guest_count)) {
      const guests = Number(guestInput);
      if (!Number.isInteger(guests) || guests < 0) throw new Error("Guests must be a whole number");
      change.guest_count = guests;
    }
    if (budgetInput !== paiseToInput(plan.event.budget_minor)) {
      change.budget_minor = rupeesToPaise(budgetInput);
      change.kind = "budget";
    }
    if (dateInput && dateInput !== plan.event.event_date) {
      change.event_date = dateInput;
      change.kind = "date";
    }
    if (
      change.guest_count === undefined &&
      change.budget_minor === undefined &&
      change.event_date === undefined
    ) {
      return null;
    }
    return change;
  }

  async function simulate() {
    if (!id) return;
    setError("");
    setNotice("");
    setExplanation(null);
    let change: Change | null = null;
    try {
      change = buildChange();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid input");
      return;
    }
    if (!change) {
      setError("Change the guest count, budget, or date before simulating.");
      return;
    }
    setBusy(true);
    const seq = ++simulateSeq.current;
    try {
      const result = await api.simulate(id, change);
      if (seq !== simulateSeq.current) return;
      setSimulation(result);
      setAppliedChange(change);
      if (location.hash !== "#simulate") {
        // Keep the results in view while still syncing the URL and shell context.
        skipHashScroll.current = true;
        navigate({ hash: "simulate" }, { replace: true });
      }
    } catch (caught) {
      if (seq !== simulateSeq.current) return;
      setError(caught instanceof Error ? caught.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  }

  async function draftProposal(change: Change) {
    if (!id || !plan || !simulation || draftInFlight.current) return;
    if (!previewCurrent) {
      setError("The plan changed after this preview. Simulate again before drafting.");
      setSimulation(null);
      setAppliedChange(null);
      return;
    }
    draftInFlight.current = true;
    setError("");
    setBusy(true);
    try {
      await api.proposals.create(id, change, {
        baseVersion: simulation.base_version,
        baselineHash: simulation.baseline_hash
      });
      setNotice("Proposal drafted. Review it below before approving.");
      setSimulation(null);
      setAppliedChange(null);
      setExplanation(null);
      await refreshAfterSave();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the proposal");
    } finally {
      draftInFlight.current = false;
      setBusy(false);
    }
  }

  async function approve(proposalId: string) {
    if (!id) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.proposals.approve(id, proposalId);
      setNotice(
        result.idempotent_replay
          ? "Already approved; the same revision is shown."
          : "Approved. The plan and revision history are updated."
      );
      setSimulation(null);
      setAppliedChange(null);
      setExplanation(null);
      await refreshAfterSave();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  function requestReject(proposal: Proposal, trigger?: HTMLElement) {
    setError("");
    setRejectError("");
    // WebKit does not focus a button when it is clicked, so use the trigger itself.
    rejectReturnFocus.current =
      trigger ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    rejectFocusSection.current = false;
    setRejectTarget(proposal);
  }

  function closeReject(nextFocus: "trigger" | "section") {
    rejectFocusSection.current = nextFocus === "section";
    setRejectError("");
    setRejectTarget(null);
  }

  async function confirmReject() {
    if (!id || !rejectTarget) return;
    setRejectBusy(true);
    setRejectError("");
    try {
      await api.proposals.reject(id, rejectTarget.id);
      setNotice("Proposal rejected. The plan is unchanged.");
      closeReject("section");
      await refreshAfterSave();
    } catch (caught) {
      setRejectError(caught instanceof Error ? caught.message : "Rejection failed");
    } finally {
      setRejectBusy(false);
    }
  }

  async function explain() {
    if (!id || !appliedChange) return;
    setBusy(true);
    setError("");
    try {
      setExplanation(await api.ai.explain(id, appliedChange));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI explanation failed");
    } finally {
      setBusy(false);
    }
  }

  async function addItem(event: React.FormEvent) {
    event.preventDefault();
    if (!id || itemInFlight.current) return;
    itemInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = {
        label: itemLabel,
        category: itemCategory,
        basis: itemBasis,
        unit_amount_minor: rupeesToPaise(itemAmount),
        quantity: 1
      };
      await api.items.create(id, payload, itemMutation.keyFor(payload));
      itemMutation.clear();
      setNotice("Budget item saved.");
      await refreshAfterSave();
    } catch (caught) {
      setError(itemMutation.errorMessage(caught, "Could not add the item"));
    } finally {
      itemInFlight.current = false;
      setBusy(false);
    }
  }

  if (loading || !user || (!plan && !error)) {
    return <DashboardLoadingState />;
  }

  if (!plan) {
    return (
      <WorkspaceShell
        user={user}
        active={null}
        current="overview"
        sectionLabel="Event workspace"
        onCreate={openCreate}
        onSignOut={signOut}
        signOutError={signOutError}
        onRetrySignOut={signOut}
      >
        <div className="mx-auto max-w-xl rounded-3xl border border-[#181512]/10 bg-white p-6 sm:p-8">
          <p className="inline-flex items-center gap-2 font-mono-code text-[10px] uppercase tracking-[0.2em] text-[#A84422]">
            <Alert className="h-3.5 w-3.5" />
            Event unavailable
          </p>
          <h1 className="mt-3 font-serif-editorial text-3xl leading-tight text-[#12100E]">
            We could not open this celebration.
          </h1>
          <p role="alert" className="mt-2 text-sm leading-relaxed text-[#4A433E]">
            {error || "This event could not be loaded."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn" onClick={retryLoad}>
              Try again
            </button>
            <Link to="/events" className="btn-secondary">
              All events
            </Link>
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  const proposals = [...plan.proposals, ...olderProposals];
  const revisions = [...plan.revisions, ...olderRevisions];
  const proposalTotal = plan.proposal_total ?? proposals.length;
  const revisionTotal = plan.revision_total ?? revisions.length;
  const draftCount = proposals.filter((proposal) => proposal.status === "draft").length;

  return (
    <WorkspaceShell
      user={user}
      active={plan.event}
      current={current}
      sectionLabel={sectionLabel}
      onCreate={openCreate}
      onSignOut={signOut}
      signOutError={signOutError}
      onRetrySignOut={signOut}
    >
      <div className="space-y-8">
        <header
          id="overview"
          className="scroll-mt-24 overflow-hidden rounded-3xl border border-[#181512]/10 bg-white"
        >
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5F6F5E]/10 px-2.5 py-0.5 font-mono-code text-[10px] uppercase tracking-[0.14em] text-[#3F4A3E]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#5F6F5E]" />
                    Event workspace
                  </span>
                  <span className="font-mono-code text-[10px] uppercase tracking-[0.14em] text-[#6E655F]">
                    v{plan.event.version}
                  </span>
                  <span className="capitalize text-xs text-[#6E655F]">{plan.event.event_type}</span>
                </div>
                <h1 className="mt-3 font-serif-editorial text-3xl leading-[1.05] text-[#12100E] sm:text-4xl lg:text-[44px]">
                  {plan.event.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[#4A433E]">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#A84422]" />
                    {formatDate(plan.event.event_date)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#A84422]" />
                    {plan.event.city}
                  </span>
                </div>
                <p className="mt-1.5 font-mono-code text-[11px] uppercase tracking-[0.1em] text-[#6E655F]">
                  {plan.event.guest_count} guests · version {plan.event.version}
                </p>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#4A433E]">
                  This is the working plan for the celebration. Review the budget, test a change in
                  the Adaptive Studio, and approve a proposal only when it is ready.
                </p>
              </div>

              <a
                className="btn-secondary w-full sm:w-auto"
                href={`/api/v1/events/${plan.event.id}/export`}
              >
                Export JSON
              </a>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[#181512]/10 pt-5">
              <Link to={`/events/${plan.event.id}#simulate`} className="btn">
                <Sliders className="mr-1.5 h-4 w-4" />
                Simulate a change
              </Link>
              <Link to={`/events/${plan.event.id}#proposals`} className="btn-secondary">
                Review proposals
                {draftCount > 0 && (
                  <span className="ml-2 rounded-full bg-[#C85A32]/15 px-2 py-0.5 font-mono-code text-[9px] text-[#8F3A1D]">
                    {draftCount}
                  </span>
                )}
              </Link>
              <Link
                to={`/events/${plan.event.id}#guests`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A84422] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
              >
                Manage guests
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </header>

        <ErrorAlert
          message={error}
          className="flex items-start gap-2 rounded-2xl border border-[#A84422]/25 bg-[#F2ECE1] p-4 text-sm font-medium leading-relaxed text-[#8F3A1D]"
          icon={<Alert className="mt-0.5 h-4 w-4 shrink-0" />}
        />
        {refreshError && (
          <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-[#A84422]/25 bg-[#F2ECE1] p-4">
            <ErrorAlert
              message={refreshError}
              className="min-w-0 flex-1 text-sm font-medium leading-relaxed text-[#8F3A1D]"
              icon={<Alert className="mt-0.5 inline h-4 w-4 shrink-0" />}
            />
            <button className="btn-secondary" onClick={retryRefresh} disabled={refreshBusy}>
              {refreshBusy ? "Refreshing…" : "Retry refresh"}
            </button>
          </div>
        )}
        {notice && (
          <p
            className="rounded-2xl border border-[#5F6F5E]/25 bg-[#5F6F5E]/10 p-4 text-sm font-medium leading-relaxed text-[#3F4A3E]"
            role="status"
          >
            {notice}
          </p>
        )}

        <section
          id="budget"
          className="scroll-mt-24"
          aria-labelledby="budget-heading"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono-code text-[10px] uppercase tracking-[0.2em] text-[#A84422]">
                Financial plan
              </p>
              <h2
                id="budget-heading"
                className="mt-1 font-serif-editorial text-2xl leading-tight text-[#12100E] sm:text-3xl"
              >
                Budget
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 font-mono-code text-[10px] uppercase tracking-[0.1em] ${
                  plan.totals.over_budget
                    ? "bg-[#C85A32]/15 text-[#8F3A1D]"
                    : "bg-[#5F6F5E]/10 text-[#3F4A3E]"
                }`}
              >
                {plan.totals.over_budget
                  ? `Over spendable by ${formatPaise(plan.totals.spendable_shortfall_minor)}`
                  : "Within spendable"}
              </span>
              <Link
                to={`/events/${plan.event.id}#budget-items`}
                className="inline-flex items-center gap-1.5 rounded text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A84422] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
              >
                View line items
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4A433E]">
            Spendable is the total budget after the reserve. Projected spend is what the current
            plan commits across all line items.
          </p>
          <div className="mt-4">
            <BudgetSummary totals={plan.totals} />
          </div>
        </section>

        <section
          id="budget-items"
          className="card scroll-mt-24"
          aria-labelledby="budget-items-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="budget-items-heading"
                className="font-serif-editorial text-2xl leading-tight text-[#12100E] sm:text-3xl"
              >
                Budget items
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#4A433E]">
                Each line the engine prices. Per-guest rates multiply by the event headcount;
                confirmed quotes replace the linked line.
              </p>
            </div>
            <span className="rounded-full bg-[#181512]/5 px-3 py-1 font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#4A433E]">
              {plan.items.length} {plan.items.length === 1 ? "item" : "items"}
            </span>
          </div>

          {plan.items.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-[#181512]/15 bg-[#FAF6F0] px-4 py-5 text-sm leading-relaxed text-[#4A433E]">
              No budget items yet. Add the first line below to give the plan a baseline.
            </p>
          ) : (
            <>
              <p className="mt-4 text-xs text-[#6E655F] sm:hidden">
                Scroll the table sideways to see every amount.
              </p>
              <div
                className="mt-2 overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] sm:mt-5"
                role="region"
                aria-label="Budget items table"
                tabIndex={0}
              >
                <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#6E655F]">
                    <th scope="col" className="pb-2">
                      Item
                    </th>
                    <th scope="col" className="pb-2">
                      Basis
                    </th>
                    <th scope="col" className="pb-2 text-right">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plan.items.map((item) => (
                    <tr key={item.id} className="border-t border-[#181512]/10">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-[#12100E]">{item.label}</span>
                        <span className="ml-2 rounded-full bg-[#181512]/5 px-2 py-0.5 font-mono-code text-[9px] uppercase tracking-[0.08em] text-[#6E655F]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-[#6E655F]">
                        {item.basis === "per_guest" ? "Per guest" : "Fixed"}
                      </td>
                      <td className="py-3 text-right">
                        <span className="font-mono-code text-xs text-[#12100E]">
                          {formatPaise(item.unit_amount_minor)}
                        </span>
                        {item.quote_minor !== null && (
                          <span className="ml-2 rounded-full bg-[#5F6F5E]/10 px-2 py-0.5 font-mono-code text-[9px] uppercase tracking-[0.08em] text-[#3F4A3E]">
                            Quoted
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}

          <div className="mt-5 border-t border-[#181512]/10 pt-5">
            <h3 className="font-mono-code text-[10px] uppercase tracking-[0.16em] text-[#6E655F]">
              Add a budget item
            </h3>
            <form
              className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
              onSubmit={addItem}
              aria-label="Add budget item"
            >
              <div>
                <label className="label" htmlFor="item-label">
                  Item label
                </label>
                <input
                  id="item-label"
                  className="input"
                  value={itemLabel}
                  onChange={(event) => setItemLabel(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="item-category">
                  Item category
                </label>
                <input
                  id="item-category"
                  className="input"
                  value={itemCategory}
                  onChange={(event) => setItemCategory(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="item-rate">
                  Rate (₹)
                </label>
                <input
                  id="item-rate"
                  className="input"
                  inputMode="decimal"
                  value={itemAmount}
                  onChange={(event) => setItemAmount(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="item-basis">
                  Basis
                </label>
                <select
                  id="item-basis"
                  className="input"
                  value={itemBasis}
                  onChange={(event) => setItemBasis(event.target.value as "fixed" | "per_guest")}
                >
                  <option value="fixed">Fixed</option>
                  <option value="per_guest">Per guest</option>
                </select>
              </div>
              <button className="btn self-end sm:col-span-2 lg:col-span-1" disabled={busy}>
                Add item
              </button>
            </form>
          </div>
        </section>

        <section
          id="simulate"
          className="card scroll-mt-24"
          aria-labelledby="simulate-heading"
        >
          <div>
            <p className="font-mono-code text-[10px] uppercase tracking-[0.2em] text-[#A84422]">
              Simulation
            </p>
            <h2
              id="simulate-heading"
              className="mt-1 font-serif-editorial text-2xl leading-tight text-[#12100E] sm:text-3xl"
            >
              Adaptive Studio
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4A433E]">
              Test a different guest count, budget or date. This preview is read-only. Nothing is
              saved until you approve a proposal.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-[#181512]/10 bg-[#FAF6F0] p-4">
            <p className="font-mono-code text-[9px] uppercase tracking-[0.16em] text-[#6E655F]">
              Current plan
            </p>
            <p className="mt-1 text-sm text-[#4A433E]">
              {plan.event.guest_count} guests · {formatPaise(plan.event.budget_minor)} budget ·{" "}
              {formatDate(plan.event.event_date)}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="sim-guests">
                Guests
              </label>
              <input
                id="sim-guests"
                className="input"
                type="number"
                min={0}
                value={guestInput}
                onChange={(event) => {
                  invalidatePreview();
                  setGuestInput(event.target.value);
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="sim-budget">
                Total budget (₹)
              </label>
              <input
                id="sim-budget"
                className="input"
                inputMode="decimal"
                value={budgetInput}
                onChange={(event) => {
                  invalidatePreview();
                  setBudgetInput(event.target.value);
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="sim-date">
                Event date
              </label>
              <input
                id="sim-date"
                className="input"
                type="date"
                value={dateInput}
                onChange={(event) => {
                  invalidatePreview();
                  setDateInput(event.target.value);
                }}
              />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn" onClick={simulate} disabled={busy}>
              {busy ? "Working…" : "Simulate"}
            </button>
            {simulation && appliedChange && (
              <>
                <button
                  className="btn-secondary"
                  disabled={busy || !previewCurrent || !simulation.feasible}
                  onClick={() => draftProposal(appliedChange)}
                >
                  Draft proposal for this change
                </button>
                <button
                  className="btn-secondary"
                  onClick={explain}
                  disabled={busy || !previewCurrent}
                >
                  Explain impact
                </button>
              </>
            )}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#6E655F]">
            Drafting records the change for review. Approving applies it and creates a new plan
            version.
          </p>
        </section>

        {simulation && (
          <SimulationView
            result={simulation}
            onDraft={draftProposal}
            busy={busy}
            current={previewCurrent}
          />
        )}

        <section
          id="proposals"
          className="card scroll-mt-24"
          aria-labelledby="proposals-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono-code text-[10px] uppercase tracking-[0.2em] text-[#A84422]">
                Decision queue
              </p>
              <h2
                id="proposals-heading"
                tabIndex={-1}
                className="mt-1 font-serif-editorial text-2xl leading-tight text-[#12100E] focus:outline-none sm:text-3xl"
              >
                Proposals
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#4A433E]">
                Review a proposed change and decide. Approving applies it to the live plan;
                rejecting closes it without changing the plan.
              </p>
            </div>
            <span className="rounded-full bg-[#181512]/5 px-3 py-1 font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#4A433E]">
              {proposals.length < proposalTotal
                ? `Showing ${proposals.length} of ${proposalTotal}`
                : `${proposalTotal} ${proposalTotal === 1 ? "proposal" : "proposals"}`}
            </span>
          </div>

          {proposals.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-[#181512]/15 bg-[#FAF6F0] px-4 py-5 text-sm leading-relaxed text-[#4A433E]">
              No proposals yet. Simulate a change in the Adaptive Studio to create one.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {proposals.map((proposal) => {
                const staleness = proposalStaleness(proposal, plan);
                const stale = staleness !== null;
                const isDraft = proposal.status === "draft";
                return (
                  <li
                    key={proposal.id}
                    className={`rounded-2xl border p-4 sm:p-5 ${
                      isDraft
                        ? "border-[#C85A32]/30 bg-[#FAF6F0]"
                        : "border-[#181512]/10 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono-code text-[9px] uppercase tracking-[0.12em] ${
                            proposal.status === "approved"
                              ? "bg-[#5F6F5E]/15 text-[#3F4A3E]"
                              : proposal.status === "rejected"
                                ? "bg-[#181512]/5 text-[#6E655F]"
                                : "bg-[#C85A32]/15 text-[#8F3A1D]"
                          }`}
                        >
                          {proposalStatus(proposal.status)}
                        </span>
                        <span className="font-mono-code text-[10px] uppercase tracking-[0.1em] text-[#6E655F]">
                          Base v{proposal.base_version}
                        </span>
                        {stale && (
                          <span className="inline-flex items-center gap-1 font-mono-code text-[10px] uppercase tracking-[0.1em] text-[#A84422]">
                            <Alert className="h-3.5 w-3.5" />
                            {staleness === "version"
                              ? `Plan is now v${plan.event.version}`
                              : "Plan changed"}
                          </span>
                        )}
                      </div>
                      <span className="font-mono-code text-[10px] text-[#6E655F]">
                        {proposalDate(proposal.created_at)}
                      </span>
                    </div>

                    <p className="mt-3 break-words text-sm font-medium leading-relaxed text-[#12100E]">
                      {scenarioLabel(proposal.scenario)}
                    </p>

                    <dl className="mt-3 grid gap-3 border-t border-[#181512]/10 pt-3 sm:grid-cols-3">
                      <div>
                        <dt className="font-mono-code text-[9px] uppercase tracking-[0.14em] text-[#6E655F]">
                          Guests after
                        </dt>
                        <dd className="mt-0.5 font-mono-code text-sm text-[#12100E]">
                          {proposal.impact.guest_count}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-mono-code text-[9px] uppercase tracking-[0.14em] text-[#6E655F]">
                          Committed after
                        </dt>
                        <dd className="mt-0.5 font-mono-code text-sm text-[#12100E]">
                          {formatPaise(proposal.impact.committed_minor)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-mono-code text-[9px] uppercase tracking-[0.14em] text-[#6E655F]">
                          {proposal.impact.over_budget ? "Spendable shortfall" : "Remaining budget"}
                        </dt>
                        <dd
                          className={`mt-0.5 font-mono-code text-sm ${
                            proposal.impact.over_budget ? "text-[#A84422]" : "text-[#12100E]"
                          }`}
                        >
                          {formatPaise(
                            proposal.impact.over_budget
                              ? proposal.impact.spendable_shortfall_minor
                              : proposal.impact.remaining_budget_minor
                          )}
                        </dd>
                      </div>
                    </dl>

                    {isDraft && stale && (
                      <p className="mt-3 rounded-xl bg-[#F2ECE1] px-3 py-2 text-xs leading-relaxed text-[#8F3A1D]">
                        {staleness === "version"
                          ? `This draft was made against version ${proposal.base_version}. The plan is now version ${plan.event.version}. Re-simulate if it needs a fresh baseline.`
                          : staleness === "baseline"
                            ? "The plan changed after this draft was made, even though the event version is unchanged. Re-simulate and review the new impact before approving."
                            : "This draft has no baseline fingerprint. Re-simulate and review it before approving."}
                      </p>
                    )}

                    {isDraft && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className="btn"
                          disabled={busy || stale}
                          onClick={() => approve(proposal.id)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn-secondary"
                          disabled={busy}
                          onClick={(event) => requestReject(proposal, event.currentTarget)}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {proposals.length < proposalTotal && (
            <div className="mt-4">
              <button
                className="btn-secondary"
                onClick={loadOlderProposals}
                disabled={historyBusy}
              >
                {historyBusy ? "Loading…" : "Load older proposals"}
              </button>
            </div>
          )}
        </section>

        <section
          id="impact"
          className="card scroll-mt-24"
          aria-labelledby="impact-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono-code text-[10px] uppercase tracking-[0.2em] text-[#A84422]">
                Decision record
              </p>
              <h2
                id="impact-heading"
                className="mt-1 font-serif-editorial text-2xl leading-tight text-[#12100E] sm:text-3xl"
              >
                Impact Ledger
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#4A433E]">
                A read-only record of the impact each proposal would have had when it was reviewed.
                Approved changes flow into the live plan; drafts and rejected proposals do not.
              </p>
            </div>
            <span className="rounded-full bg-[#181512]/5 px-3 py-1 font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#4A433E]">
              {proposals.length < proposalTotal
                ? `Showing ${proposals.length} of ${proposalTotal}`
                : `${proposalTotal} ${proposalTotal === 1 ? "entry" : "entries"}`}
            </span>
          </div>

          {explanation && (
            <div className="mt-5 rounded-2xl border border-[#181512]/10 bg-[#FAF6F0] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-serif-editorial text-xl text-[#12100E]">
                  Impact explanation
                </h3>
                <span className="font-mono-code text-[10px] uppercase tracking-[0.1em] text-[#6E655F]">
                  {explanation.provider}
                  {explanation.fallback_reason ? ` · ${explanation.fallback_reason}` : ""}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#4A433E]">
                {explanation.explanation}
              </p>
              {explanation.trade_offs.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#4A433E]">
                  {explanation.trade_offs.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs leading-relaxed text-[#6E655F]">
                Figures come from the deterministic engine. AI text is validated and may fall back.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-b border-[#181512]/10 pb-2">
            <h3 className="font-mono-code text-[10px] uppercase tracking-[0.16em] text-[#6E655F]">
              Recorded impact
            </h3>
            <span className="rounded-full bg-[#F2ECE1] px-2.5 py-0.5 font-mono-code text-[9px] uppercase tracking-[0.1em] text-[#8F3A1D]">
              Read-only
            </span>
          </div>
          {proposals.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-[#181512]/15 bg-[#FAF6F0] px-4 py-5 text-sm leading-relaxed text-[#4A433E]">
              No impact has been recorded yet. Simulate a change to see the projected result.
            </p>
          ) : (
            <ol className="divide-y divide-[#181512]/10">
              {proposals.map((proposal, index) => (
                <li
                  key={proposal.id}
                  className="grid gap-2 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:gap-4"
                >
                  <span className="font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#A84422]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#12100E]">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono-code text-[9px] uppercase tracking-[0.1em] ${
                          proposal.status === "approved"
                            ? "bg-[#5F6F5E]/15 text-[#3F4A3E]"
                            : proposal.status === "rejected"
                              ? "bg-[#181512]/5 text-[#6E655F]"
                              : "bg-[#C85A32]/15 text-[#8F3A1D]"
                        }`}
                      >
                        {proposalStatus(proposal.status)}
                      </span>
                      <span className="break-words">{scenarioLabel(proposal.scenario)}</span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#6E655F]">
                      {proposal.status === "draft"
                        ? "Projected · not yet applied"
                        : proposal.status === "approved"
                          ? "Applied to the live plan"
                          : "Closed without changing the plan"}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-[#6E655F]">
                      {typeof proposal.scenario.guest_count !== "number" && (
                        <span>{proposal.impact.guest_count} guests</span>
                      )}
                      <span>Base v{proposal.base_version}</span>
                      <span>{proposalDate(proposal.created_at)}</span>
                    </p>
                  </div>
                  <div className="sm:min-w-[10rem] sm:text-right">
                    <p className="font-mono-code text-xs text-[#12100E]">
                      {formatPaise(proposal.impact.committed_minor)} committed
                    </p>
                    <p
                      className={`mt-0.5 font-mono-code text-[10px] ${
                        proposal.impact.over_budget ? "text-[#A84422]" : "text-[#6E655F]"
                      }`}
                    >
                      {proposal.impact.over_budget
                        ? `${formatPaise(proposal.impact.spendable_shortfall_minor)} shortfall`
                        : `${formatPaise(proposal.impact.remaining_budget_minor)} remaining`}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {!explanation && simulation && (
            <p className="mt-4 text-xs leading-relaxed text-[#6E655F]">
              Need a plain-language read? Choose “Explain impact” beside the preview above.
            </p>
          )}
          {aiStatus && (
            <div className="mt-4 border-t border-[#181512]/10 pt-3">
              <p className="font-mono-code text-[9px] uppercase tracking-[0.1em] text-[#6E655F]">
                Explanation engine ·{" "}
                {aiStatus.local.enabled && aiStatus.local.remote
                  ? "Remote AI (opt-in)"
                  : "Local AI"}{" "}
                {aiStatus.local.enabled ? aiStatus.local.model : "off"} · Cloud{" "}
                {aiStatus.cloud.configured ? "configured" : "off"}
              </p>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#6E655F]">
                {aiStatus.disclosure}
              </p>
            </div>
          )}
        </section>

        <section
          id="revisions"
          className="card scroll-mt-24"
          aria-labelledby="revisions-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="revisions-heading"
                className="font-serif-editorial text-2xl leading-tight text-[#12100E] sm:text-3xl"
              >
                Revision history
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#4A433E]">
                Approved changes in order. Each revision records the plan before and after it was
                applied.
              </p>
            </div>
            <span className="rounded-full bg-[#181512]/5 px-3 py-1 font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#4A433E]">
              {revisions.length < revisionTotal
                ? `Showing ${revisions.length} of ${revisionTotal}`
                : `${revisionTotal} ${revisionTotal === 1 ? "revision" : "revisions"}`}
            </span>
          </div>

          {revisions.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-[#181512]/15 bg-[#FAF6F0] px-4 py-5 text-sm leading-relaxed text-[#4A433E]">
              No approved revisions yet. Approving a proposal will add the first one.
            </p>
          ) : (
            <ol className="mt-5 space-y-5 border-l border-[#181512]/15 pl-5">
              {revisions.map((revision) => (
                <li key={revision.id} className="relative">
                  <span
                    className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#C85A32] ring-4 ring-white"
                    aria-hidden="true"
                  />
                  <p className="font-medium text-[#12100E]">Version {revision.version}</p>
                  <p className="mt-0.5 text-xs text-[#6E655F]">
                    Approved revision ·{" "}
                    <time dateTime={revision.created_at}>
                      {new Date(revision.created_at).toLocaleString("en-IN")}
                    </time>
                  </p>
                  <dl className="mt-2 grid gap-2 text-sm text-[#4A433E] sm:grid-cols-2">
                    <div>
                      <dt className="font-mono-code text-[9px] uppercase tracking-[0.12em] text-[#6E655F]">
                        Guests
                      </dt>
                      <dd>
                        {String(revision.before_json.guest_count)} →{" "}
                        {String(revision.after_json.guest_count)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono-code text-[9px] uppercase tracking-[0.12em] text-[#6E655F]">
                        Budget
                      </dt>
                      <dd>
                        {formatPaise(Number(revision.before_json.budget_minor))} →{" "}
                        {formatPaise(Number(revision.after_json.budget_minor))}
                      </dd>
                    </div>
                    <RevisionDates
                      revision={revision}
                      ceremonies={plan.ceremonies}
                      tasks={plan.tasks}
                    />
                  </dl>
                </li>
              ))}
            </ol>
          )}
          {revisions.length < revisionTotal && (
            <div className="mt-4">
              <button
                className="btn-secondary"
                onClick={loadOlderRevisions}
                disabled={historyBusy}
              >
                {historyBusy ? "Loading…" : "Load older revisions"}
              </button>
            </div>
          )}
        </section>

        <div id="guests" className="scroll-mt-24">
          <GuestsPanel eventId={plan.event.id} guests={plan.guests} onChanged={refreshAfterSave} />
        </div>

        <div id="tasks" className="scroll-mt-24">
          <TasksPanel
            eventId={plan.event.id}
            eventDate={plan.event.event_date}
            tasks={plan.tasks}
            dependencies={plan.dependencies}
            onChanged={refreshAfterSave}
          />
        </div>

        <div id="vendors" className="scroll-mt-24">
          <VendorsPanel eventId={plan.event.id} vendors={plan.vendors} onChanged={refreshAfterSave} />
        </div>

        <div id="quotes" className="scroll-mt-24">
          <QuotesPanel
            eventId={plan.event.id}
            vendors={plan.vendors}
            items={plan.items}
            quotes={plan.quotes}
            onChanged={refreshAfterSave}
          />
        </div>

        <div id="ceremonies" className="scroll-mt-24">
          <CeremoniesPanel
            eventId={plan.event.id}
            eventDate={plan.event.event_date}
            ceremonies={plan.ceremonies}
            onChanged={refreshAfterSave}
          />
        </div>
      </div>

      <dialog
        ref={rejectDialogRef}
        aria-labelledby="reject-dialog-title"
        aria-describedby="reject-dialog-description"
        aria-busy={rejectBusy}
        onCancel={(event) => {
          event.preventDefault();
          if (!rejectBusy) closeReject("trigger");
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !rejectBusy) closeReject("trigger");
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl border border-[#181512]/10 bg-[#FAF6F0] p-0 text-[#12100E] shadow-2xl [&::backdrop]:bg-[#12100E]/55"
      >
        {rejectTarget && (
          <div className="p-5 sm:p-6">
            <p className="font-mono-code text-[10px] uppercase tracking-[0.2em] text-[#A84422]">
              Proposal review
            </p>
            <h2
              id="reject-dialog-title"
              className="mt-1 font-serif-editorial text-2xl leading-tight text-[#12100E] sm:text-3xl"
            >
              Reject this proposal?
            </h2>

            <div className="mt-4 rounded-2xl border border-[#181512]/10 bg-white p-4">
              <p className="break-words text-sm font-medium leading-relaxed text-[#12100E]">
                {scenarioLabel(rejectTarget.scenario)}
              </p>
              <p className="mt-1 font-mono-code text-[10px] uppercase tracking-[0.1em] text-[#6E655F]">
                Base version v{rejectTarget.base_version} · Drafted{" "}
                {proposalDate(rejectTarget.created_at)}
              </p>
            </div>

            <p
              id="reject-dialog-description"
              className="mt-4 text-sm leading-relaxed text-[#4A433E]"
            >
              Rejecting closes this draft. Your live plan and budget will not change. This decision
              cannot be undone.
            </p>

            {rejectError && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-[#A84422]/25 bg-[#F2ECE1] px-3 py-2 text-sm font-medium leading-relaxed text-[#8F3A1D]"
              >
                {rejectError}
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                ref={keepProposalRef}
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (!rejectBusy) closeReject("trigger");
                }}
                disabled={rejectBusy}
              >
                Keep proposal
              </button>
              <button
                type="button"
                className="btn bg-[#8F3A1D] hover:bg-[#6F2F18]"
                onClick={confirmReject}
                disabled={rejectBusy}
              >
                {rejectBusy ? "Rejecting…" : "Reject proposal"}
              </button>
            </div>
            {rejectBusy && (
              <p role="status" className="sr-only">
                Rejecting proposal
              </p>
            )}
          </div>
        )}
      </dialog>
    </WorkspaceShell>
  );
}

function scenarioLabel(scenario: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof scenario.guest_count === "number") parts.push(`${scenario.guest_count} guests`);
  if (typeof scenario.budget_minor === "number") {
    parts.push(`budget ${formatPaise(scenario.budget_minor)}`);
  }
  if (typeof scenario.reserve_minor === "number") {
    parts.push(`reserve ${formatPaise(scenario.reserve_minor)}`);
  }
  if (typeof scenario.event_date === "string") parts.push(formatDate(scenario.event_date));
  if (scenario.item_units && typeof scenario.item_units === "object") {
    parts.push(`${Object.keys(scenario.item_units).length} rate changes`);
  }
  const kind = String(scenario.kind ?? "change");
  const labels: Record<string, string> = {
    guest_count: "Guest count",
    budget: "Budget",
    date: "Date",
    items: "Rates",
    quote: "Quote"
  };
  const label = labels[kind] ?? "Change";
  const prefix = kind === "guest_count" ? "" : `${label}: `;
  return parts.length > 0 ? `${prefix}${parts.join(" · ")}` : label;
}

function dateMap(value: unknown): Record<string, string> {
  return value && typeof value === "object" ? (value as Record<string, string>) : {};
}

function changedDateEntries(before: unknown, after: unknown) {
  const beforeDates = dateMap(before);
  const afterDates = dateMap(after);
  return [...new Set([...Object.keys(beforeDates), ...Object.keys(afterDates)])]
    .filter((id) => beforeDates[id] !== afterDates[id])
    .map((id) => ({ id, before: beforeDates[id], after: afterDates[id] }));
}

function RevisionDates({
  revision,
  ceremonies,
  tasks
}: {
  revision: Plan["revisions"][number];
  ceremonies: Plan["ceremonies"];
  tasks: Plan["tasks"];
}) {
  const eventBefore =
    typeof revision.before_json.event_date === "string" ? revision.before_json.event_date : "";
  const eventAfter =
    typeof revision.after_json.event_date === "string" ? revision.after_json.event_date : "";
  const ceremonyDates = changedDateEntries(
    revision.before_json.ceremony_dates,
    revision.after_json.ceremony_dates
  );
  const taskDates = changedDateEntries(
    revision.before_json.task_dates,
    revision.after_json.task_dates
  );
  const ceremonyNames = new Map(ceremonies.map((ceremony) => [ceremony.id, ceremony.name]));
  const taskNames = new Map(tasks.map((task) => [task.id, task.title]));

  if (eventBefore === eventAfter && ceremonyDates.length === 0 && taskDates.length === 0) {
    return null;
  }

  return (
    <>
      {eventBefore !== eventAfter && (
        <div className="sm:col-span-2">
          <dt className="font-mono-code text-[9px] uppercase tracking-[0.12em] text-[#6E655F]">
            Event date
          </dt>
          <dd>
            {formatDate(eventBefore)} → {formatDate(eventAfter)}
          </dd>
        </div>
      )}
      {ceremonyDates.map((change) => (
        <div key={`ceremony-${change.id}`}>
          <dt className="font-mono-code text-[9px] uppercase tracking-[0.12em] text-[#6E655F]">
            {ceremonyNames.get(change.id) ?? "Ceremony"}
          </dt>
          <dd>
            {formatDate(change.before)} → {formatDate(change.after)}
          </dd>
        </div>
      ))}
      {taskDates.map((change) => (
        <div key={`task-${change.id}`}>
          <dt className="font-mono-code text-[9px] uppercase tracking-[0.12em] text-[#6E655F]">
            {taskNames.get(change.id) ?? "Task"}
          </dt>
          <dd>
            {formatDate(change.before)} → {formatDate(change.after)}
          </dd>
        </div>
      ))}
    </>
  );
}

function SimulationView({
  result,
  onDraft,
  busy,
  current
}: {
  result: SimulationResult;
  onDraft: (change: Change) => void;
  busy: boolean;
  current: boolean;
}) {
  return (
    <section className="card" aria-labelledby="simulation-result-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono-code text-[10px] uppercase tracking-[0.2em] text-[#A84422]">
            Read-only preview
          </p>
          <h2
            id="simulation-result-heading"
            className="mt-1 font-serif-editorial text-2xl leading-tight text-[#12100E] sm:text-3xl"
          >
            Simulation result
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 font-mono-code text-[10px] uppercase tracking-[0.1em] ${
            result.feasible
              ? "bg-[#5F6F5E]/10 text-[#3F4A3E]"
              : "bg-[#C85A32]/15 text-[#8F3A1D]"
          }`}
        >
          {result.feasible ? "Feasible" : "Needs a decision"}
        </span>
      </div>

      <div className="mt-5">
        <BudgetSummary totals={result.projected} label="Projected budget summary" />
      </div>

      <div
        className="mt-5 overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
        role="region"
        aria-label="Simulation impact table"
        tabIndex={0}
      >
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#6E655F]">
              <th scope="col" className="pb-2">
                Measure
              </th>
              <th scope="col" className="pb-2 text-right">
                After
              </th>
              <th scope="col" className="pb-2 text-right">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((line) => (
              <tr key={`${line.kind}-${line.label}`} className="border-t border-[#181512]/10">
                <td className="py-3 pr-4 text-[#12100E]">{line.label}</td>
                <td className="py-3 text-right font-mono-code text-xs text-[#12100E]">
                  {line.value_type === "money"
                    ? formatPaise(Number(line.after))
                    : String(line.after)}
                </td>
                <td className="py-3 text-right font-mono-code text-xs text-[#6E655F]">
                  {line.value_type === "money"
                    ? formatPaise(Number(line.delta))
                    : String(line.delta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.conflicts.length > 0 && (
        <div className="mt-4 rounded-xl border border-[#A84422]/25 bg-[#F2ECE1] p-4">
          <p className="text-sm font-semibold text-[#8F3A1D]">Schedule conflicts</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#8F3A1D]">
            {result.conflicts.map((conflict) => (
              <li key={`${conflict.predecessor_id}-${conflict.successor_id}`}>
                {conflict.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.ceremony_changes.length > 0 && (
        <div className="mt-4">
          <p className="font-mono-code text-[10px] uppercase tracking-[0.14em] text-[#6E655F]">
            Ceremony dates that would move
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#4A433E]">
            {result.ceremony_changes.map((change) => (
              <li key={change.ceremony_id}>
                {change.name}: {formatDate(change.before)} → {formatDate(change.after)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.task_changes.length > 0 && (
        <div className="mt-4">
          <p className="font-mono-code text-[10px] uppercase tracking-[0.14em] text-[#6E655F]">
            Task dates that would move
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#4A433E]">
            {result.task_changes.map((change) => (
              <li key={change.task_id}>
                {change.title}: {formatDate(change.before)} → {formatDate(change.after)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <h3 className="font-serif-editorial text-xl text-[#12100E]">Alternatives</h3>
        {result.alternatives.length === 0 && (
          <p className="mt-2 text-sm leading-relaxed text-[#4A433E]">
            {result.alternative_notes.join(" ")}
          </p>
        )}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {result.alternatives.map((alternative) => (
            <AlternativeCard
              key={alternative.id}
              alternative={alternative}
              busy={busy}
              current={current}
              onDraft={onDraft}
            />
          ))}
        </div>
      </div>

      <p className="mt-4 border-t border-[#181512]/10 pt-3 text-xs leading-relaxed text-[#6E655F]">
        {result.assumptions.join(" ")}
      </p>
    </section>
  );
}

function AlternativeCard({
  alternative,
  onDraft,
  busy,
  current
}: {
  alternative: Alternative;
  onDraft: (change: Change) => void;
  busy: boolean;
  current: boolean;
}) {
  return (
    <div
      className="flex flex-col rounded-2xl border border-[#181512]/10 bg-white p-4"
      data-testid={`alternative-${alternative.id}`}
    >
      <p className="text-sm font-semibold text-[#12100E]">{alternative.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-[#4A433E]">{alternative.summary}</p>
      <p className="mt-2 font-mono-code text-[10px] uppercase tracking-[0.08em] text-[#6E655F]">
        Committed after · {formatPaise(alternative.committed_after_minor)}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-[#6E655F]">
        {alternative.trade_offs.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {!alternative.feasible && (
        <p className="mt-2 text-xs font-medium text-[#A84422]">
          This option does not fit the current constraints.
        </p>
      )}
      <button
        className="btn-secondary mt-3 w-full"
        data-testid="draft-alternative"
        aria-label={`Draft proposal: ${alternative.title}`}
        disabled={busy || !current || !alternative.feasible}
        onClick={() =>
          onDraft({
            kind: "guest_count",
            ...alternative.changes
          })
        }
      >
        Draft proposal
      </button>
    </div>
  );
}
