import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import Login from "./Login";

vi.mock("../api/client", () => ({
  api: {
    auth: {
      login: vi.fn(),
      signup: vi.fn()
    }
  }
}));

function renderLogin(from?: string) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/login", state: from ? { from } : undefined }]}
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/events/e1" element={<p>Event destination</p>} />
        <Route path="/events" element={<p>Events fallback</p>} />
      </Routes>
    </MemoryRouter>
  );
}

async function submit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.auth.login).mockResolvedValue({
    id: "u1",
    email: "owner@example.com",
    display_name: null,
    created_at: "2026-01-01T00:00:00Z"
  });
  vi.mocked(api.auth.signup).mockResolvedValue({
    id: "u1",
    email: "owner@example.com",
    display_name: null,
    created_at: "2026-01-01T00:00:00Z"
  });
});

describe("Login destination", () => {
  it("returns to the protected path after signing in", async () => {
    renderLogin("/events/e1#proposals");

    await submit("owner@example.com", "correct-horse-battery-staple");

    expect(await screen.findByText("Event destination")).toBeInTheDocument();
  });

  it("returns to the protected path after signing up", async () => {
    const user = userEvent.setup();
    renderLogin("/events/e1#proposals");

    await user.click(screen.getByRole("button", { name: "Need an account? Sign up" }));
    await user.type(screen.getByLabelText("Email"), "owner@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery-staple");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Event destination")).toBeInTheDocument();
  });

  it("ignores an external destination", async () => {
    renderLogin("https://evil.example/phish");

    await submit("owner@example.com", "correct-horse-battery-staple");

    expect(await screen.findByText("Events fallback")).toBeInTheDocument();
  });
});
