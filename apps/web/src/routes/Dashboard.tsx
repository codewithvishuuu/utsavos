import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import type { EventDto, Plan } from "../api/types";
import { CreateEventForm } from "../components/dashboard/CreateEventForm";
import {
  CelebrationCard,
  MilestoneList,
  PendingProposalBanner,
  Portfolio,
  WelcomeHeader
} from "../components/dashboard/DashboardOverview";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingState
} from "../components/dashboard/DashboardStates";
import { WorkspaceShell } from "../components/dashboard/WorkspaceShell";
import { todayIso } from "../lib/format";
import { useRequireAuth } from "../lib/useAuth";

/** The nearest upcoming celebration, or the most recent one when all have passed. */
function pickActive(events: EventDto[]): EventDto | null {
  const today = todayIso();
  const upcoming = [...events]
    .filter((event) => event.event_date >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  if (upcoming[0]) return upcoming[0];
  return [...events].sort((a, b) => b.event_date.localeCompare(a.event_date))[0] ?? null;
}

export default function Dashboard() {
  const { user, loading } = useRequireAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [events, setEvents] = useState<EventDto[]>([]);
  const [eventTotal, setEventTotal] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const [moreError, setMoreError] = useState("");
  const [busy, setBusy] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const load = useCallback(async () => {
    const page = await api.events.list({ limit: 50 });
    setEvents(page.items);
    setEventTotal(page.total ?? page.items.length);
    const next = pickActive(page.items);
    setPlan(next ? await api.plan.get(next.id) : null);
  }, []);

  useEffect(() => {
    if (!user) return;
    let live = true;
    setBusy(true);
    setError("");
    load()
      .catch((caught) => {
        if (live) {
          setError(caught instanceof Error ? caught.message : "Could not load your workspace");
        }
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [user, load, attempt]);

  // "New event" on an event page returns here with a request to open the form.
  const createRequested = Boolean(
    (location.state as { create?: boolean } | null)?.create
  );
  useEffect(() => {
    if (!createRequested || busy) return;
    setCreating(true);
  }, [createRequested, busy]);

  // Wait for the form to commit before moving focus into it.
  useEffect(() => {
    if (!creating) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("create")?.scrollIntoView({ block: "start" });
      document.getElementById("event-name")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [creating]);

  function openCreate() {
    setCreating(true);
    window.requestAnimationFrame(() => {
      document.getElementById("create")?.scrollIntoView({ block: "start" });
      document.getElementById("event-name")?.focus({ preventScroll: true });
    });
  }

  async function loadMoreEvents() {
    setMoreBusy(true);
    setMoreError("");
    try {
      const page = await api.events.list({ limit: 50, offset: events.length });
      const nextEvents = [...events, ...page.items];
      setEvents(nextEvents);
      setEventTotal(page.total ?? nextEvents.length);
      const next = pickActive(nextEvents);
      if (next && next.id !== plan?.event.id) {
        setPlan(await api.plan.get(next.id));
      }
    } catch (caught) {
      setMoreError(caught instanceof Error ? caught.message : "Could not load more events");
    } finally {
      setMoreBusy(false);
    }
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

  if (loading || !user || busy) return <DashboardLoadingState />;
  if (error) {
    return <DashboardErrorState message={error} onRetry={() => setAttempt((value) => value + 1)} />;
  }

  const active = plan?.event ?? null;
  const draft = plan?.proposals.find((proposal) => proposal.status === "draft") ?? null;
  const showCreate = events.length === 0 || creating;

  return (
    <WorkspaceShell
      user={user}
      active={active}
      current="dashboard"
      sectionLabel="Dashboard"
      onCreate={openCreate}
      onSignOut={signOut}
      signOutError={signOutError}
      onRetrySignOut={signOut}
    >
      <div className="space-y-8">
        <WelcomeHeader user={user} eventTotal={eventTotal} active={active} />

        {plan && draft && <PendingProposalBanner proposal={draft} event={plan.event} />}

        {plan ? (
          <>
            <CelebrationCard plan={plan} />
            <MilestoneList tasks={plan.tasks} eventId={plan.event.id} />
            <Portfolio
              events={events}
              activeId={plan.event.id}
              total={eventTotal}
              onLoadMore={loadMoreEvents}
              moreBusy={moreBusy}
              moreError={moreError}
            />
          </>
        ) : (
          <DashboardEmptyState />
        )}

        {showCreate && (
          <section
            id="create"
            className="scroll-mt-24 rounded-3xl border border-[#181512]/10 bg-white p-5 sm:p-6"
          >
            <h2 className="font-serif-editorial text-xl text-[#12100E] sm:text-2xl">
              Create a celebration
            </h2>
            <p className="mt-1 text-sm text-[#4A433E]">
              Set the baseline. Every rate can be refined later.
            </p>
            <CreateEventForm />
          </section>
        )}
      </div>
    </WorkspaceShell>
  );
}
