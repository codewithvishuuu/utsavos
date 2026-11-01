import { describe, expect, it, vi } from "vitest";

import { ApiError, request } from "../api/client";
import { daysBetween, formatPaise, rupeesToPaise } from "./format";

describe("money display", () => {
  it("formats paise as Indian rupees", () => {
    expect(formatPaise(180_000_000)).toContain("18,00,000");
    expect(formatPaise(8_080_000)).toContain("80,800");
  });

  it("parses rupee input into exact paise", () => {
    expect(rupeesToPaise("1800000")).toBe(180_000_000);
    expect(rupeesToPaise("₹18,00,000")).toBe(180_000_000);
    expect(rupeesToPaise("1500.5")).toBe(150_050);
    expect(rupeesToPaise("1500.55")).toBe(150_055);
  });

  it("rejects malformed amounts instead of guessing", () => {
    expect(() => rupeesToPaise("12.345")).toThrow();
    expect(() => rupeesToPaise("abc")).toThrow();
  });

  it("measures event offsets in whole calendar days", () => {
    expect(daysBetween("2027-02-14", "2026-12-01")).toBe(-75);
    expect(daysBetween("2027-02-14", "2027-02-21")).toBe(7);
    expect(daysBetween("2027-02-14", "2027-02-14")).toBe(0);
  });
});

describe("api error contract", () => {
  it("maps the server error envelope onto ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "infeasible_proposal",
              message: "Not feasible",
              details: { spendable_shortfall_minor: 8_080_000 },
              request_id: "abc123"
            }
          }),
          { status: 422, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    await expect(request("/events/x/simulate")).rejects.toMatchObject({
      status: 422,
      code: "infeasible_proposal",
      message: "Not feasible",
      requestId: "abc123"
    });

    const error = await request("/events/x/simulate").catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).details).toEqual({ spendable_shortfall_minor: 8_080_000 });
    vi.unstubAllGlobals();
  });
});
