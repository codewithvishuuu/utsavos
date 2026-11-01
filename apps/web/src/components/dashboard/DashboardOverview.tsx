import { Link } from "react-router-dom";

import type { EventDto, Plan, PlanTask, Proposal, User } from "../../api/types";
import { formatDate, formatPaise, todayIso } from "../../lib/format";
import { ErrorAlert } from "../ErrorAlert";
import {
  Alert,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Lock,
  MapPin
} from "./icons";

/** Display only: drops the ".00" that the shared INR formatter always adds. */
function money(minor: number): string {
  return formatPaise(minor).replace(/\.00$/, "");
}

function daysUntil(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const today = todayIso().split("-").map(Number);
  return Math.round((target - Date.UTC(today[0], today[1] - 1, today[2])) / 86_400_000);
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short"
  });
}

function describeScenario(scenario: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof scenario.guest_count === "number") parts.push(`${scenario.guest_count} guests`);
  if (typeof scenario.budget_minor === "number") {
    parts.push(`budget ${money(scenario.budget_minor)}`);
  }
  if (typeof scenario.event_date === "string") parts.push(formatDate(scenario.event_date));
  if (scenario.item_units && typeof scenario.item_units === "object") {
    parts.push(`${Object.keys(scenario.item_units).length} rate changes`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Proposed plan change";
}

export function WelcomeHeader({
  user,
  eventTotal,
  active
}: {
  user: User;
  eventTotal: number;
  active: EventDto | null;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user.display_name?.trim();

  return (
    <section aria-labelledby="welcome-heading">
      <p className="flex items-center gap-2 font-mono-code text-[10px] uppercase tracking-[0.22em] text-[#A84422]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C85A32]" />
        Workspace · {eventTotal} {eventTotal === 1 ? "celebration" : "celebrations"}
      </p>
      <h1
        id="welcome-heading"
        className="mt-2 font-serif-editorial text-3xl leading-[1.05] text-[#12100E] sm:text-4xl lg:text-[44px]"
      >
        {name ? (
          <>
            {greeting}, <span className="italic text-[#A84422]">{name}</span>.
          </>
        ) : (
          "Welcome back."
        )}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#4A433E]">
        {active
          ? `You are planning ${active.name} for ${formatDate(active.event_date)}.`
          : "Nothing is on the calendar yet. Set a baseline and the plan builds itself."}
      </p>
    </section>
  );
}

export function PendingProposalBanner({
  proposal,
  event
}: {
  proposal: Proposal;
  event: EventDto;
}) {
  const stale = proposal.base_version < event.version;

  return (
    <section
      aria-labelledby="proposal-heading"
      className="rounded-2xl border border-[#C85A32]/25 bg-[#F2ECE1] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C85A32]/15 px-2.5 py-0.5 font-mono-code text-[10px] uppercase tracking-[0.16em] text-[#8F3A1D]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C85A32]" />
          Pending review
        </span>
        <span className="font-mono-code text-[10px] uppercase tracking-[0.16em] text-[#6E655F]">
          Draft · base v{proposal.base_version}
        </span>
        {stale && (
          <span className="inline-flex items-center gap-1 font-mono-code text-[10px] uppercase tracking-[0.16em] text-[#A84422]">
            <Alert className="h-3.5 w-3.5" />
            Plan is now v{event.version}
          </span>
        )}
      </div>

      <h2
        id="proposal-heading"
        className="mt-3 font-serif-editorial text-xl leading-snug text-[#12100E] sm:text-2xl"
      >
        {stale ? "A draft proposal no longer matches the plan." : "A change is waiting for your review."}
      </h2>
      <p className="mt-1 text-sm text-[#4A433E]">
        {describeScenario(proposal.scenario)}. Nothing is applied until you approve it.
      </p>

      <dl className="mt-4 grid max-w-md grid-cols-2 gap-4 border-t border-[#181512]/10 pt-4">
        <div>
          <dt className="font-mono-code text-[9px] uppercase tracking-[0.16em] text-[#6E655F]">
            Committed after
          </dt>
          <dd className="mt-0.5 font-mono-code text-lg text-[#12100E]">
            {money(proposal.impact.committed_minor)}
          </dd>
        </div>
        <div>
          <dt className="font-mono-code text-[9px] uppercase tracking-[0.16em] text-[#6E655F]">
            Remaining after
          </dt>
          <dd className="mt-0.5 font-mono-code text-lg text-[#12100E]">
            {money(proposal.impact.remaining_budget_minor)}
          </dd>
        </div>
      </dl>

      <Link
        to={`/events/${event.id}#${stale ? "simulate" : "proposals"}`}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#A84422]/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A84422] transition-colors hover:bg-[#A84422] hover:text-[#FAF6F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
      >
        {stale ? "Re-simulate in Studio" : "Inspect in Studio"}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

export function CelebrationCard({ plan }: { plan: Plan }) {
  const { event, totals } = plan;
  const days = daysUntil(event.event_date);
  const countdown =
    days > 0 ? `${days} days to go` : days === 0 ? "Today" : "Date has passed";

  return (
    <section
      aria-labelledby="celebration-heading"
      className="overflow-hidden rounded-3xl border border-[#181512]/10 bg-white shadow-sm"
    >
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#5F6F5E]/10 px-2.5 py-0.5 font-mono-code text-[10px] uppercase tracking-[0.14em] text-[#3F4A3E]">
              Active celebration
            </span>
            <span className="font-mono-code text-[10px] uppercase tracking-[0.14em] text-[#6E655F]">
              v{event.version}
            </span>
          </div>
          <h2
            id="celebration-heading"
            className="mt-3 font-serif-editorial text-3xl leading-tight text-[#12100E] sm:text-4xl"
          >
            {event.name}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#4A433E]">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#A84422]" />
              {formatDate(event.event_date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#A84422]" />
              {event.city}
            </span>
            <span className="capitalize">{event.event_type}</span>
          </div>
          <p className="mt-3 font-mono-code text-[11px] uppercase tracking-[0.14em] text-[#A84422]">
            {countdown}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            to={`/events/${event.id}`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#12100E] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FAF6F0] transition-colors hover:bg-[#A84422] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-2 sm:w-auto"
          >
            Open overview
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to={`/events/${event.id}#budget`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#181512]/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#181512] transition-colors hover:border-[#C85A32] hover:text-[#A84422] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] sm:w-auto"
          >
            Budget ledger
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid gap-px border-t border-[#181512]/10 bg-[#181512]/10 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCell
          label="Total budget cap"
          value={money(totals.budget_minor)}
          note={`Reserve held · ${money(totals.reserve_minor)}`}
        />
        <MetricCell
          label="Committed"
          value={money(totals.committed_minor)}
          note="Committed line items"
        />
        <MetricCell
          label="Remaining"
          value={money(totals.remaining_budget_minor)}
          note={
            totals.over_budget
              ? `Over spendable by ${money(totals.spendable_shortfall_minor)}`
              : `Spendable · ${money(totals.remaining_spendable_minor)}`
          }
          tone={totals.over_budget ? "bad" : undefined}
        />
        <MetricCell
          label="Guest baseline"
          value={String(totals.guest_count)}
          note={`Per guest · ${money(totals.per_guest_average_minor)}`}
        />
      </div>
    </section>
  );
}

function MetricCell({
  label,
  value,
  note,
  tone
}: {
  label: string;
  value: string;
  note: string;
  tone?: "bad";
}) {
  return (
    <div className="bg-white p-5">
      <p className="font-mono-code text-[10px] uppercase tracking-[0.16em] text-[#6E655F]">
        {label}
      </p>
      <p
        className={`mt-2 font-mono-code text-2xl tracking-tight ${
          tone === "bad" ? "text-[#A84422]" : "text-[#12100E]"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[#6E655F]">{note}</p>
    </div>
  );
}

export function MilestoneList({ tasks, eventId }: { tasks: PlanTask[]; eventId: string }) {
  const today = todayIso();
  const upcoming = [...tasks]
    .filter((task) => task.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  return (
    <section
      aria-labelledby="milestones-heading"
      className="rounded-3xl border border-[#181512]/10 bg-white p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono-code text-[10px] uppercase tracking-[0.2em] text-[#6E655F]">
            Preparation
          </p>
          <h2
            id="milestones-heading"
            className="mt-1 font-serif-editorial text-2xl text-[#12100E] sm:text-3xl"
          >
            Upcoming milestones
          </h2>
        </div>
        <Link
          to={`/events/${eventId}#tasks`}
          className="inline-flex items-center gap-1.5 rounded text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A84422] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
        >
          Timeline & tasks
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-[#181512]/15 bg-[#FAF6F0] px-4 py-6 text-sm leading-relaxed text-[#4A433E]">
          No upcoming milestones. Tasks appear here once they are scheduled in the timeline.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-[#181512]/10">
          {upcoming.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <time
                dateTime={task.due_date}
                className="w-16 shrink-0 font-mono-code text-[11px] uppercase tracking-[0.1em] text-[#A84422]"
              >
                {shortDate(task.due_date)}
              </time>
              <p className="min-w-0 flex-1 text-sm text-[#181512]">{task.title}</p>
              <span className="rounded-full bg-[#181512]/5 px-2.5 py-0.5 font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#4A433E]">
                {task.status}
              </span>
              {task.is_locked && (
                <span className="inline-flex items-center text-[#6E655F]">
                  <Lock className="h-3.5 w-3.5" />
                  <span className="sr-only">Locked</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Portfolio({
  events,
  activeId,
  total,
  onLoadMore,
  moreBusy,
  moreError
}: {
  events: EventDto[];
  activeId: string;
  total: number;
  onLoadMore: () => void;
  moreBusy: boolean;
  moreError: string;
}) {
  if (events.length < 2 && events.length >= total) return null;

  return (
    <section aria-labelledby="portfolio-heading">
      <p className="font-mono-code text-[10px] uppercase tracking-[0.2em] text-[#6E655F]">
        Portfolio
      </p>
      <h2
        id="portfolio-heading"
        className="mt-1 font-serif-editorial text-2xl text-[#12100E] sm:text-3xl"
      >
        All celebrations
      </h2>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              to={`/events/${event.id}`}
              aria-current={event.id === activeId ? "true" : undefined}
              className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] ${
                event.id === activeId
                  ? "border-[#C85A32]/40 bg-[#F2ECE1]"
                  : "border-[#181512]/10 bg-white hover:border-[#181512]/30"
              }`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-[#12100E]">
                  <span className="truncate">{event.name}</span>
                  {event.id === activeId && (
                    <span className="shrink-0 rounded-full bg-[#C85A32]/15 px-2 py-0.5 font-mono-code text-[9px] uppercase tracking-[0.12em] text-[#8F3A1D]">
                      Active
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-[#6E655F]">
                  {formatDate(event.event_date)} · {event.city}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono-code text-xs text-[#12100E]">{money(event.budget_minor)}</p>
                <p className="font-mono-code text-[10px] text-[#6E655F]">v{event.version}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {events.length < total && (
        <div className="mt-4">
          <button className="btn-secondary" onClick={onLoadMore} disabled={moreBusy}>
            {moreBusy ? "Loading…" : `Load more celebrations (${total - events.length} remaining)`}
          </button>
        </div>
      )}
      <ErrorAlert message={moreError} />
    </section>
  );
}
