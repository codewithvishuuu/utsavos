import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useRequireAuth } from "./useAuth";

vi.mock("../api/client", () => ({
  api: { auth: { me: vi.fn().mockRejectedValue(new Error("Not signed in")) } }
}));

function Protected() {
  useRequireAuth();
  return null;
}

function LoginProbe() {
  const location = useLocation();
  const state = location.state as { from?: string } | null;
  return <p>{state?.from}</p>;
}

describe("useRequireAuth", () => {
  it("sends the full protected address to the login screen", async () => {
    render(
      <MemoryRouter initialEntries={["/events/e1?tab=plan#proposals"]}>
        <Routes>
          <Route path="/events/:id" element={<Protected />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("/events/e1?tab=plan#proposals")).toBeInTheDocument();
  });
});
