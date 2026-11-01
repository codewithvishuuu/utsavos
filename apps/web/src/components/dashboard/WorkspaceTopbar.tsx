import { Link } from "react-router-dom";

import type { EventDto } from "../../api/types";
import { Menu, Plus, Sliders } from "./icons";

type TopbarProps = {
  active: EventDto | null;
  current: string;
  sectionLabel: string;
  menuOpen: boolean;
  onMenu: () => void;
  onCreate: () => void;
};

export function WorkspaceTopbar({
  active,
  current,
  sectionLabel,
  menuOpen,
  onMenu,
  onCreate
}: TopbarProps) {
  const eventPage = current !== "dashboard";

  return (
    <header className="sticky top-0 z-30 border-b border-[#181512]/10 bg-[#FAF6F0]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-controls="workspace-navigation"
            id="workspace-menu-button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#181512] hover:bg-[#181512]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol
              className={`flex min-w-0 text-xs ${
                eventPage
                  ? "flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2"
                  : "items-center gap-2"
              }`}
            >
              <li className={eventPage ? "hidden shrink-0 sm:block" : "shrink-0"}>
                <Link
                  to="/events"
                  className="rounded text-[#6E655F] hover:text-[#A84422] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
                >
                  Workspace
                </Link>
              </li>
              <li
                aria-hidden="true"
                className={`text-[#181512]/30 ${eventPage ? "hidden sm:block" : ""}`}
              >
                /
              </li>
              {eventPage && active && (
                <>
                  <li className="min-w-0">
                    <Link
                      to={`/events/${active.id}`}
                      className="flex min-h-[24px] min-w-0 items-center rounded text-[11px] font-medium text-[#6E655F] hover:text-[#A84422] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] sm:max-w-[13rem] sm:text-xs"
                    >
                      <span className="truncate">{active.name}</span>
                    </Link>
                  </li>
                  <li aria-hidden="true" className="hidden text-[#181512]/30 sm:block">
                    /
                  </li>
                </>
              )}
              <li
                aria-current="page"
                className="min-w-0 truncate text-[13px] font-medium text-[#181512] sm:text-xs"
              >
                {sectionLabel}
              </li>
            </ol>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {active && (
            <Link
              to={`/events/${active.id}#simulate`}
              className="hidden items-center gap-1.5 rounded-full border border-[#181512]/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#181512] transition-colors hover:border-[#C85A32] hover:text-[#A84422] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] sm:inline-flex"
            >
              <Sliders className="h-3.5 w-3.5" />
              Simulate change
            </Link>
          )}
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#B04B25] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FAF6F0] shadow-sm transition-colors hover:bg-[#8F3A1D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-2"
          >
            <Plus className="h-3.5 w-3.5" />
            New event
          </button>
        </div>
      </div>
    </header>
  );
}
