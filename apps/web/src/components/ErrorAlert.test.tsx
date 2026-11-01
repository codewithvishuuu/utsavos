import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ErrorAlert } from "./ErrorAlert";

describe("ErrorAlert", () => {
  it("focuses and announces a newly shown error", () => {
    render(<ErrorAlert message="The plan changed. Simulate again." />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The plan changed. Simulate again.");
    expect(alert).toHaveFocus();
  });
});
