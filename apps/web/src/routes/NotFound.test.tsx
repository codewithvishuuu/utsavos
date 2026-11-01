import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import App from "../App";

describe("unknown routes", () => {
  it("shows an in-app not-found screen", () => {
    render(
      <MemoryRouter initialEntries={["/events/e1/no-such-panel"]}>
        <App />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "We could not find that page." })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your events" })).toHaveAttribute(
      "href",
      "/events"
    );
  });
});
