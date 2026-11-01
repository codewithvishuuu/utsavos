import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import App from "../App";
import Landing from "./Landing";

describe("landing page", () => {
  it("renders the original hero and brand mark", () => {
    const { container } = render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { level: 1, name: /celebrate beautifully/i })
    ).toBeInTheDocument();
    expect(container.querySelector('img[src="/brand/utsavos-icon-dark.png"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/brand/utsavos-icon-light.png"]')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore the Experience" })).toHaveAttribute(
      "href",
      "#adaptive-studio"
    );
  });

  it("opens the planning modal and hands the workspace route to /login", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await user.click(screen.getAllByRole("button", { name: "Start Planning" })[0]);

    const dialog = screen.getByRole("dialog", {
      name: "Initialize Your Baseline Celebration Plan"
    });
    expect(within(dialog).getByRole("link", { name: "Launch Workspace Route" })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(
      within(dialog).getByRole("link", { name: "Open Adaptive Studio Workbench" })
    ).toHaveAttribute("href", "#adaptive-studio");

    await user.click(within(dialog).getByRole("link", { name: "Launch Workspace Route" }));
    expect(screen.getByRole("heading", { name: "Sign in to UtsavOS" })).toBeInTheDocument();
  });

  it("simulates a guest change and records an approved revision", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Adjust Updated Guest Count/i), {
      target: { value: "300" }
    });
    expect(screen.getByText(/\+120 PAX/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve Proposal" }));
    expect(screen.getByText("Committed to History")).toBeInTheDocument();
    expect(screen.getByText("v1.3")).toBeInTheDocument();
  });

  it("opens the mobile navigation and closes it with Escape", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    const menuButton = screen.getByRole("button", { name: "Toggle navigation menu" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector("#mobile-navigation")).toBeNull();

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector("#mobile-navigation")).not.toBeNull();

    await user.keyboard("{Escape}");
    expect(container.querySelector("#mobile-navigation")).toBeNull();
    expect(menuButton).toHaveFocus();
  });

  it("keeps the landing page at / and sign-in at /login", () => {
    const first = render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /celebrate beautifully/i })
    ).toBeInTheDocument();
    first.unmount();

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Sign in to UtsavOS" })).toBeInTheDocument();
  });
});
