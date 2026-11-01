import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Totals } from "../api/types";
import { BudgetSummary } from "./BudgetSummary";

const flagship: Totals = {
  guest_count: 240,
  budget_minor: 180_000_000,
  reserve_minor: 18_000_000,
  spendable_minor: 162_000_000,
  fixed_minor: 76_000_000,
  per_guest_minor: 94_080_000,
  committed_minor: 170_080_000,
  remaining_budget_minor: 9_920_000,
  remaining_spendable_minor: -8_080_000,
  per_guest_average_minor: 392_000,
  over_budget: true,
  spendable_shortfall_minor: 8_080_000,
  category_totals: {}
};

function valueFor(label: string): string {
  return screen.getByText(label).parentElement?.textContent ?? "";
}

describe("BudgetSummary", () => {
  it("distinguishes total budget, reserve, spendable and shortfall", () => {
    render(<BudgetSummary totals={flagship} />);

    expect(valueFor("Total budget")).toContain("18,00,000");
    expect(valueFor("Reserve")).toContain("1,80,000");
    expect(valueFor("Spendable after reserve")).toContain("16,20,000");
    expect(valueFor("Projected spend")).toContain("17,00,800");
    expect(valueFor("Remaining total budget")).toContain("99,200");
    expect(valueFor("Spendable shortfall")).toContain("80,800");
    expect(screen.queryByText("Remaining spendable")).not.toBeInTheDocument();
  });

  it("shows remaining spendable when the plan fits", () => {
    render(
      <BudgetSummary
        totals={{
          ...flagship,
          guest_count: 180,
          committed_minor: 146_560_000,
          remaining_budget_minor: 33_440_000,
          remaining_spendable_minor: 15_440_000,
          over_budget: false,
          spendable_shortfall_minor: 0
        }}
      />
    );

    expect(valueFor("Remaining spendable")).toContain("1,54,400");
    expect(screen.queryByText("Spendable shortfall")).not.toBeInTheDocument();
  });
});
