import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useIdempotencyMutation } from "./idempotency";

const STORAGE_KEY = "utsavos.idempotency.v1";
const SCOPE = "event:e1:quotes";

type Hook = ReturnType<typeof useIdempotencyMutation>;

function useHook(scope = SCOPE): Hook {
  return renderHook(() => useIdempotencyMutation(scope)).result.current;
}

function store(): Record<string, unknown> {
  return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
}

beforeEach(() => {
  sessionStorage.clear();
  document.cookie = "utsavos_csrf=; Max-Age=0; path=/";
});

describe("idempotency key lifecycle", () => {
  it("reuses the key for the same payload within one instance", () => {
    const mutation = useHook();
    const payload = { amount_minor: 1000, status: "quoted" };
    const first = mutation.keyFor(payload);
    expect(mutation.keyFor(payload)).toBe(first);
  });

  it("reuses the pending key after a simulated reload", () => {
    const before = useHook();
    const key = before.keyFor({ guest_count: 120 });

    // a fresh instance models the component state after reload/navigation
    const after = useHook();
    expect(after.keyFor({ guest_count: 120 })).toBe(key);
    expect(store()[`anon|${SCOPE}`]).toBeDefined();
  });

  it("generates a new key when the payload changes", () => {
    const mutation = useHook();
    const first = mutation.keyFor({ guest_count: 120 });
    expect(mutation.keyFor({ guest_count: 180 })).not.toBe(first);
  });

  it("scopes records by action so different forms never share keys", () => {
    const quotes = useHook("event:e1:quotes");
    const tasks = useHook("event:e1:tasks");
    const quoteKey = quotes.keyFor({ amount_minor: 100 });
    const taskKey = tasks.keyFor({ amount_minor: 100 });
    expect(quoteKey).not.toBe(taskKey);
    expect(Object.keys(store()).length).toBe(2);
  });

  it("does not share keys between different authenticated sessions", () => {
    document.cookie = "utsavos_csrf=token-for-user-a";
    const userA = useHook();
    const keyA = userA.keyFor({ guest_count: 120 });

    document.cookie = "utsavos_csrf=token-for-user-b";
    const userB = useHook();
    expect(userB.keyFor({ guest_count: 120 })).not.toBe(keyA);
  });

  it("clears the stored record after confirmed success", () => {
    const mutation = useHook();
    const key = mutation.keyFor({ guest_count: 120 });
    mutation.clear();
    expect(store()[`anon|${SCOPE}`]).toBeUndefined();
    expect(mutation.keyFor({ guest_count: 120 })).not.toBe(key);
  });

  it("clears the pending record on an idempotency conflict", () => {
    const mutation = useHook();
    const key = mutation.keyFor({ guest_count: 120 });
    act(() => {
      mutation.errorMessage(
        Object.assign(new Error("conflict"), { code: "idempotency_conflict" }),
        "fallback"
      );
    });
    expect(store()[`anon|${SCOPE}`]).toBeUndefined();
    expect(mutation.keyFor({ guest_count: 120 })).not.toBe(key);
  });

  it("expires records older than the replay window", () => {
    const first = useHook();
    const key = first.keyFor({ guest_count: 120 });
    // age the stored record beyond the 24-hour TTL
    const entries = store() as Record<string, { fp: string; key: string; at: number }>;
    entries[`anon|${SCOPE}`].at = Date.now() - 24 * 60 * 60 * 1000 - 1;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

    const after = useHook();
    expect(after.keyFor({ guest_count: 120 })).not.toBe(key);
  });

  it("ignores malformed sessionStorage content", () => {
    sessionStorage.setItem(STORAGE_KEY, "{not json at all");
    const mutation = useHook();
    expect(() => mutation.keyFor({ guest_count: 120 })).not.toThrow();
    expect(store()[`anon|${SCOPE}`]).toBeDefined();
  });

  it("drops structurally invalid stored records", () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ [`anon|${SCOPE}`]: { key: 42, fp: null } })
    );
    const mutation = useHook();
    const key = mutation.keyFor({ guest_count: 120 });
    expect(typeof key).toBe("string");
    const entries = store() as Record<string, { key: unknown }>;
    expect(entries[`anon|${SCOPE}`].key).toBe(key);
  });

  it("keeps working when sessionStorage is unavailable", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "sessionStorage"
    );
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota exceeded");
      },
    };
    Object.defineProperty(globalThis, "sessionStorage", { value: blocked, configurable: true });
    try {
      const mutation = useHook();
      const key = mutation.keyFor({ guest_count: 120 });
      // in-memory fallback still reuses the key for the same payload
      expect(mutation.keyFor({ guest_count: 120 })).toBe(key);
      // a fresh instance cannot read storage and starts a fresh key safely
      expect(useHook().keyFor({ guest_count: 120 })).not.toBe(key);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "sessionStorage", originalDescriptor);
      }
    }
  });

  it("never persists the payload, tokens or private notes", () => {
    const mutation = useHook();
    mutation.keyFor({
      name: "Private Person",
      contact: "+91 9876543210",
      note: "secret instructions"
    });
    const raw = sessionStorage.getItem(STORAGE_KEY) ?? "";
    expect(raw).not.toContain("Private Person");
    expect(raw).not.toContain("9876543210");
    expect(raw).not.toContain("secret instructions");
    expect(raw).not.toContain("utsavos_csrf");
  });
});
