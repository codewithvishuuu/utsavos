import { describe, expect, it } from "vitest";

import { safeDestination } from "./navigation";

describe("safeDestination", () => {
  it("keeps a same-origin path with its query and hash", () => {
    expect(safeDestination("/events/e1?tab=plan#proposals")).toBe(
      "/events/e1?tab=plan#proposals"
    );
  });

  it("falls back for external, protocol-relative or relative values", () => {
    expect(safeDestination("https://evil.example/path")).toBe("/events");
    expect(safeDestination("//evil.example/path")).toBe("/events");
    expect(safeDestination("events/e1")).toBe("/events");
    expect(safeDestination(undefined)).toBe("/events");
  });
});
