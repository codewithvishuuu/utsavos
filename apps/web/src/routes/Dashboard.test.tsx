import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import type { EventDto, Plan, Totals } from "../api/types";
import Dashboard from "./Dashboard";

let mockUser = {
  id: "u1",
  email: "owner@example.com",
  display_name: "Ananya" as string | null
};

vi.mock("../lib/useAuth", () => ({
  useRequireAuth: () => ({
    user: mockUser,
    loading: false
  })
}));

vi.mock("../api/client", () => ({
  api: {
    events: { list: vi.fn(), create: vi.fn() },
    plan: { get: vi.fn() },
    auth: { logout: vi.fn() }
  }
}));

const totals: Totals = {
  guest_count: 180,
  budget_minor: 180_000_000,
  reserve_minor: 18_000_000,
  spendable_minor: 162_000_000,
  fixed_minor: 0,
  per_guest_minor: 0,
  committed_minor: 170_080_000,
  remaining_budget_minor: 9_920_000,
  remaining_spendable_minor: 8_080_000,
  per_guest_average_minor: 944_889,
  over_budget: false,
  spendable_shortfall_minor: 0,
  category_totals: {}
};

const event: EventDto = {
  id: "e1",
  name: "Ananya & Rohan wedding",
  event_type: "wedding",
  city: "Hyderabad",
  event_date: "2027-02-14",
  guest_count: 180,
  budget_minor: 180_000_000,
  reserve_minor: 18_000_000,
  currency: "INR",
  status: "active",
  version: 2
};

const plan: Plan = {
  event,
  baseline_hash: "a".repeat(64),
  totals,
  ceremonies: [],
  items: [],
  tasks: [
    {
      id: "t1",
      title: "Send invites",
      status: "todo",
      due_date: "2027-01-01",
      offset_days: null,
      is_locked: false
    }
  ],
  dependencies: [],
  vendors: [],
  quotes: [],
  guests: [],
  proposals: [
    {
      id: "p1",
      status: "draft",
      base_version: 1,
      baseline_hash: "a".repeat(64),
      scenario: { kind: "guest_count", guest_count: 240 },
      impact: totals,
      alternatives: [],
      created_at: "2026-10-01T00:00:00Z",
      decided_at: null,
      revision_id: null
    }
  ],
  revisions: []
};

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/events"]}>
      <Routes>
        <Route path="/events" element={<Dashboard />} />
        <Route path="/events/:id" element={<p>Event destination</p>} />
        <Route path="/login" element={<p>Login destination</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: "u1", email: "owner@example.com", display_name: "Ananya" };
  vi.mocked(api.events.list).mockResolvedValue({ items: [event] });
  vi.mocked(api.plan.get).mockResolvedValue(plan);
});

describe("Dashboard", () => {
  it("shows the active celebration, real budget figures and a stale draft proposal", async () => {
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Ananya & Rohan wedding" })
    ).toBeInTheDocument();
    expect(screen.getByText("₹18,00,000")).toBeInTheDocument();
    expect(screen.getAllByText("₹17,00,800").length).toBeGreaterThan(0);
    expect(screen.getByText("180")).toBeInTheDocument();
    expect(screen.getByText("Send invites")).toBeInTheDocument();
    expect(screen.getByText("Pending review")).toBeInTheDocument();
    expect(screen.getByText(/Plan is now v2/)).toBeInTheDocument();
  });

  it("shows the empty state and the create form when nothing exists", async () => {
    vi.mocked(api.events.list).mockResolvedValue({ items: [] });

    renderDashboard();

    expect(await screen.findByText("No celebrations yet")).toBeInTheDocument();
    expect(screen.getByLabelText("Event name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create event" })).toBeInTheDocument();
    expect(api.plan.get).not.toHaveBeenCalled();
  });

  it("surfaces a load failure with a retry instead of an empty dashboard", async () => {
    vi.mocked(api.events.list).mockRejectedValue(new Error("Workspace is offline"));

    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent("Workspace is offline");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("uses a friendly fallback and shows the account email once without a display name", async () => {
    mockUser = { id: "u1", email: "owner@example.com", display_name: null };

    renderDashboard();

    expect(await screen.findByRole("heading", { name: "Welcome back." })).toBeInTheDocument();
    expect(screen.getAllByText("owner@example.com")).toHaveLength(1);
  });

  it("creates an event with one idempotency key per submission", async () => {
    const user = userEvent.setup();
    vi.mocked(api.events.list).mockResolvedValue({ items: [] });
    vi.mocked(api.events.create).mockResolvedValue(event);
    renderDashboard();

    await screen.findByText("No celebrations yet");
    await user.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() =>
      expect(api.events.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Ananya & Rohan wedding" }),
        expect.any(String)
      )
    );
  });

  it("loads the next page of celebrations instead of hiding the remainder", async () => {
    const user = userEvent.setup();
    const second = {
      ...event,
      id: "e2",
      name: "Meera & Kabir sangeet",
      event_date: "2027-03-06"
    };
    vi.mocked(api.events.list)
      .mockResolvedValueOnce({ items: [event], total: 2, limit: 1, offset: 0 })
      .mockResolvedValueOnce({ items: [second], total: 2, limit: 1, offset: 1 });

    renderDashboard();

    expect(await screen.findByText(/Workspace · 2 celebrations/)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Load more celebrations (1 remaining)" })
    );

    expect(screen.getByText("Meera & Kabir sangeet")).toBeInTheDocument();
    expect(api.events.list).toHaveBeenLastCalledWith({ limit: 50, offset: 1 });
  });

  it("keeps the session and offers a retry when sign-out fails", async () => {
    const user = userEvent.setup();
    vi.mocked(api.auth.logout).mockRejectedValue(new Error("Network unavailable"));
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Ananya & Rohan wedding" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign out failed: Network unavailable. Try again."
    );
    expect(
      screen.getByRole("heading", { name: "Ananya & Rohan wedding" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("navigates to login only after a confirmed sign-out", async () => {
    const user = userEvent.setup();
    vi.mocked(api.auth.logout)
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(undefined);
    renderDashboard();

    await screen.findByRole("heading", { name: "Ananya & Rohan wedding" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Login destination")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Login destination")).toBeInTheDocument();
    expect(api.auth.logout).toHaveBeenCalledTimes(2);
  });

  it("navigates after the server confirms sign-out", async () => {
    const user = userEvent.setup();
    vi.mocked(api.auth.logout).mockResolvedValue(undefined);
    renderDashboard();

    await screen.findByRole("heading", { name: "Ananya & Rohan wedding" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByText("Login destination")).toBeInTheDocument();
    expect(api.auth.logout).toHaveBeenCalledTimes(1);
  });
});
