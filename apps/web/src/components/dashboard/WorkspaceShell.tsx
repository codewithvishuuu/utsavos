import { useCallback, useEffect, useState, type ReactNode } from "react";

import type { EventDto, User } from "../../api/types";
import { ErrorAlert } from "../ErrorAlert";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { WorkspaceTopbar } from "./WorkspaceTopbar";

type WorkspaceShellProps = {
  user: User;
  active: EventDto | null;
  current: string;
  sectionLabel: string;
  onCreate: () => void;
  onSignOut: () => void;
  signOutError?: string;
  onRetrySignOut?: () => void;
  children: ReactNode;
};

/** One authenticated frame for the dashboard and every event panel. */
export function WorkspaceShell({
  user,
  active,
  current,
  sectionLabel,
  onCreate,
  onSignOut,
  signOutError,
  onRetrySignOut,
  children
}: WorkspaceShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => {
    if (!menuOpen) return;
    setMenuOpen(false);
    // The trigger is inside the inert wrapper, so focus only after React clears it.
    window.requestAnimationFrame(() =>
      document.getElementById("workspace-menu-button")?.focus()
    );
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, closeMenu]);

  // At desktop width the drawer becomes the persistent sidebar; drop the inert wrapper.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    function sync() {
      if (desktop.matches) setMenuOpen(false);
    }
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);

  const create = useCallback(() => {
    setMenuOpen(false);
    onCreate();
  }, [onCreate]);

  return (
    <div className="min-h-screen bg-[#FAF6F0] font-sans-ui text-[#181512] antialiased selection:bg-[#C85A32] selection:text-[#FAF6F0]">
      <a
        href="#main-content"
        inert={menuOpen || undefined}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[#12100E] focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[#FAF6F0] focus:ring-2 focus:ring-[#C85A32]"
      >
        Skip to main content
      </a>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#12100E]/40 lg:hidden"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      <WorkspaceSidebar
        user={user}
        active={active}
        current={current}
        open={menuOpen}
        onClose={closeMenu}
        onCreate={create}
        onSignOut={onSignOut}
      />

      <div className="lg:pl-[272px]" inert={menuOpen || undefined}>
        <WorkspaceTopbar
          active={active}
          current={current}
          sectionLabel={sectionLabel}
          menuOpen={menuOpen}
          onMenu={() => setMenuOpen(true)}
          onCreate={create}
        />

        <main
          id="main-content"
          className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-10"
        >
          {signOutError && (
            <div className="mb-6 rounded-2xl border border-[#A84422]/20 bg-white p-4">
              <ErrorAlert
                message={signOutError}
                className="text-sm font-medium text-[#A84422]"
              />
              {onRetrySignOut && (
                <button
                  type="button"
                  onClick={onRetrySignOut}
                  className="mt-3 rounded-full border border-[#A84422]/30 px-4 py-2 text-xs font-semibold text-[#A84422] hover:bg-[#A84422]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
                >
                  Try again
                </button>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
