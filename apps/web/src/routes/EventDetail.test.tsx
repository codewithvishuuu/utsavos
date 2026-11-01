import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import EventDetail, { proposalStaleness } from "./EventDetail";

vi.mock("../lib/useAuth", () => ({
  useRequireAuth: () => ({
    user: { id: "u1", email: "owner@example.com", display_name: null },
    loading: false
  })
}));

vi.mock("../api/client", () => ({
  api: {
    plan: { get: vi.fn().mockRejectedValue(new Error("Event not found")) },
    ai: { status: vi.fn().mockRejectedValue(new Error("AI off")) }
  }
}));

describe("EventDetail", () => {
  it("shows the load error and a way back instead of loading forever", async () => {
    render(
      <MemoryRouter initialEntries={["/events/missing"]}>
        <Routes>
          <Route path="/events/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Event not found");
    expect(screen.getByRole("link", { name: "All events" })).toHaveAttribute("href", "/events");
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });
});

describe("proposalStaleness", () => {
  const basePlan = {
    event: { version: 2 },
    baseline_hash: "a".repeat(64)
  } as unknown as import("../api/types").Plan;
  const baseProposal = {
    base_version: 2,
    baseline_hash: "a".repeat(64)
  } as unknown as import("../api/types").Proposal;

  it("detects an equal-version baseline change", () => {
    expect(
      proposalStaleness({ ...baseProposal, baseline_hash: "b".repeat(64) }, basePlan)
    ).toBe("baseline");
  });

  it("detects a version change and a missing fingerprint", () => {
    expect(proposalStaleness({ ...baseProposal, base_version: 1 }, basePlan)).toBe(
      "version"
    );
    expect(proposalStaleness({ ...baseProposal, baseline_hash: null }, basePlan)).toBe(
      "missing"
    );
    expect(proposalStaleness(baseProposal, basePlan)).toBeNull();
  });
});
