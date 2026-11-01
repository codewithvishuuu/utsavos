import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router-dom";

import type { EventDto, User } from "../../api/types";
import { formatDate } from "../../lib/format";
import {
  Calendar,
  Checklist,
  Close,
  History,
  Home,
  Plus,
  Receipt,
  Sliders,
  Sparkles,
  Store,
  Users,
  Wallet
} from "./icons";

type SidebarProps = {
  user: User;
  active: EventDto | null;
  current: string;
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  onSignOut: () => void;
};

type RowProps = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  current?: boolean;
  onNavigate?: () => void;
};

export function WorkspaceSidebar({
  user,
  active,
  current,
  open,
  onClose,
  onCreate,
  onSignOut
}: SidebarProps) {
  const displayName = user.display_name?.trim();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function trapTab(event: React.KeyboardEvent<HTMLElement>) {
    if (!open || event.key !== "Tab" || !asideRef.current) return;
    const focusable = Array.from(
      asideRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <aside
      ref={asideRef}
      id="workspace-navigation"
      aria-label={open ? "Workspace navigation" : "Workspace"}
      role={open ? "dialog" : undefined}
      aria-modal={open ? "true" : undefined}
      onKeyDown={trapTab}
      className={`fixed inset-y-0 left-0 z-50 w-[272px] flex-col overflow-hidden border-r border-[#181512]/10 bg-[#FAF6F0] px-4 py-5 ${
        open ? "flex" : "hidden"
      } lg:flex`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to="/events"
          onClick={onClose}
          className="group flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
        >
          <img
            src="/brand/utsavos-icon-dark.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover"
          />
          <span className="flex flex-col">
            <span className="text-[15px] font-extrabold leading-none tracking-[-0.04em] text-[#12100E]">
              UTSAV
              <span className="font-serif-editorial font-semibold italic text-[#A84422]">OS</span>
            </span>
            <span className="mt-1 font-mono-code text-[9px] uppercase tracking-[0.18em] text-[#6E655F]">
              Event Studio
            </span>
          </span>
        </Link>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[#181512] hover:bg-[#181512]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] lg:hidden"
          aria-label="Close navigation"
        >
          <Close className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto">
        <nav aria-label="Portfolio" className="space-y-1">
          <Row
            to="/events"
            label="Dashboard"
            icon={Home}
            current={current === "dashboard"}
            onNavigate={onClose}
          />
          <button
            type="button"
            onClick={onCreate}
            className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-[#3E3834] transition-colors hover:bg-[#181512]/5 hover:text-[#12100E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] lg:py-2"
          >
            <Plus className="h-4 w-4 text-[#6E655F] group-hover:text-[#A84422]" />
            New event
          </button>
        </nav>

        {active && (
          <>
            <div className="mt-6 border-y border-[#181512]/10 py-4">
              <p className="font-mono-code text-[10px] uppercase tracking-[0.18em] text-[#6E655F]">
                Active celebration
              </p>
              <p className="mt-1.5 font-serif-editorial text-lg leading-tight text-[#12100E]">
                {active.name}
              </p>
              <p className="mt-1 font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#6E655F]">
                v{active.version} · {formatDate(active.event_date)}
              </p>
            </div>

            <nav aria-label="Celebration panels" className="mt-5 space-y-4 lg:space-y-3">
              <NavGroup label="Plan">
                <Row
                  to={`/events/${active.id}`}
                  label="Overview"
                  icon={Home}
                  current={current === "overview"}
                  onNavigate={onClose}
                />
                <Row
                  to={`/events/${active.id}#budget`}
                  label="Budget"
                  icon={Wallet}
                  current={current === "budget" || current === "budget-items"}
                  onNavigate={onClose}
                />
                <Row
                  to={`/events/${active.id}#simulate`}
                  label="Adaptive Studio"
                  icon={Sliders}
                  current={current === "simulate"}
                  onNavigate={onClose}
                />
                <Row
                  to={`/events/${active.id}#proposals`}
                  label="Proposals"
                  icon={Checklist}
                  current={current === "proposals"}
                  onNavigate={onClose}
                />
              </NavGroup>

              <NavGroup label="Operations">
                <Row
                  to={`/events/${active.id}#guests`}
                  label="Guests"
                  icon={Users}
                  current={current === "guests"}
                  onNavigate={onClose}
                />
                <Row
                  to={`/events/${active.id}#tasks`}
                  label="Timeline & Tasks"
                  icon={Calendar}
                  current={current === "tasks"}
                  onNavigate={onClose}
                />
                <Row
                  to={`/events/${active.id}#vendors`}
                  label="Vendors"
                  icon={Store}
                  current={current === "vendors"}
                  onNavigate={onClose}
                />
                <Row
                  to={`/events/${active.id}#quotes`}
                  label="Quotes"
                  icon={Receipt}
                  current={current === "quotes"}
                  onNavigate={onClose}
                />
                <Row
                  to={`/events/${active.id}#ceremonies`}
                  label="Ceremonies"
                  icon={Sparkles}
                  current={current === "ceremonies"}
                  onNavigate={onClose}
                />
              </NavGroup>

              <NavGroup label="Record">
                <Row
                  to={`/events/${active.id}#impact`}
                  label="Impact Ledger"
                  icon={History}
                  current={current === "impact"}
                  onNavigate={onClose}
                />
                <Row
                  to={`/events/${active.id}#revisions`}
                  label="Revision history"
                  icon={History}
                  current={current === "revisions"}
                  onNavigate={onClose}
                />
              </NavGroup>
            </nav>
          </>
        )}
      </div>

      <div className="mt-4 shrink-0 border-t border-[#181512]/10 pt-4">
        {displayName && (
          <p className="truncate text-xs font-medium text-[#181512]">{displayName}</p>
        )}
        <p
          className={`truncate font-mono-code text-[10px] text-[#6E655F] ${
            displayName ? "mt-0.5" : ""
          }`}
        >
          {user.email}
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-2 rounded text-xs font-medium text-[#A84422] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="px-3 pb-1 font-mono-code text-[9px] uppercase tracking-[0.2em] text-[#6E655F]">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ to, label, icon: IconComponent, current, onNavigate }: RowProps) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] lg:py-2 ${
        current
          ? "bg-[#12100E] text-[#FAF6F0]"
          : "text-[#3E3834] hover:bg-[#181512]/5 hover:text-[#12100E]"
      }`}
    >
      <IconComponent
        className={`h-4 w-4 shrink-0 ${
          current ? "text-[#E08A6A]" : "text-[#6E655F] group-hover:text-[#A84422]"
        }`}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
