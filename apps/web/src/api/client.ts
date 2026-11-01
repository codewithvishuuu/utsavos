// Same-origin by default. For a split deployment, set VITE_API_BASE_URL at
// build time to the public origin of the API (never a secret, never localhost).
const BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown,
    public requestId: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)utsavos_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = csrfToken();
    if (token) headers.set("X-CSRF-Token", token);
  }

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include"
  });

  if (!response.ok) {
    let code = "request_failed";
    let message = `Request failed with status ${response.status}`;
    let details: unknown = {};
    let requestId = "";
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string; details?: unknown; request_id?: string };
      };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
      details = body.error?.details ?? {};
      requestId = body.error?.request_id ?? "";
    } catch {
      // Non-JSON error body: keep the generic message.
    }
    throw new ApiError(response.status, code, message, details, requestId);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function post<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined
  });
}

function pageQuery(params?: { limit?: number; offset?: number }): string {
  if (!params) return "";
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  const value = query.toString();
  return value ? `?${value}` : "";
}

export const api = {
  auth: {
    me: () => request<import("./types").User>("/auth/me"),
    login: (email: string, password: string) =>
      post<import("./types").User>("/auth/login", { email, password }),
    signup: (email: string, password: string) =>
      post<import("./types").User>("/auth/signup", { email, password }),
    logout: () => post<void>("/auth/logout")
  },
  events: {
    list: (params?: { limit?: number; offset?: number }) =>
      request<import("./types").Page<import("./types").EventDto>>(
        `/events${pageQuery(params)}`
      ),
    create: (payload: Record<string, unknown>, idempotencyKey?: string) =>
      post<import("./types").EventDto>("/events", payload, idempotencyKey),
    get: (eventId: string) =>
      request<import("./types").EventDto>(`/events/${eventId}`)
  },
  plan: {
    get: (eventId: string) => request<import("./types").Plan>(`/events/${eventId}/plan`)
  },
  items: {
    create: (
      eventId: string,
      payload: Record<string, unknown>,
      idempotencyKey?: string
    ) => post(`/events/${eventId}/budget-items`, payload, idempotencyKey),
    update: (eventId: string, itemId: string, payload: Record<string, unknown>) =>
      request(`/events/${eventId}/budget-items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      })
  },
  ceremonies: {
    create: (
      eventId: string,
      payload: Record<string, unknown>,
      idempotencyKey?: string
    ) => post(`/events/${eventId}/ceremonies`, payload, idempotencyKey)
  },
  guests: {
    create: (
      eventId: string,
      payload: Record<string, unknown>,
      idempotencyKey?: string
    ) => post(`/events/${eventId}/guests`, payload, idempotencyKey)
  },
  vendors: {
    create: (
      eventId: string,
      payload: Record<string, unknown>,
      idempotencyKey?: string
    ) => post(`/events/${eventId}/vendors`, payload, idempotencyKey)
  },
  quotes: {
    create: (
      eventId: string,
      vendorId: string,
      payload: Record<string, unknown>,
      idempotencyKey?: string
    ) => post(`/events/${eventId}/vendors/${vendorId}/quotes`, payload, idempotencyKey)
  },
  tasks: {
    create: (
      eventId: string,
      payload: Record<string, unknown>,
      idempotencyKey?: string
    ) => post(`/events/${eventId}/tasks`, payload, idempotencyKey),
    update: (eventId: string, taskId: string, payload: Record<string, unknown>) =>
      request(`/events/${eventId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      })
  },
  dependencies: {
    create: (eventId: string, predecessorId: string, successorId: string) =>
      post(`/events/${eventId}/task-dependencies`, {
        predecessor_id: predecessorId,
        successor_id: successorId
      })
  },
  simulate: (eventId: string, change: import("./types").Change) =>
    post<import("./types").SimulationResult>(`/events/${eventId}/simulate`, change),
  proposals: {
    list: (eventId: string, params?: { limit?: number; offset?: number }) =>
      request<import("./types").Page<import("./types").Proposal>>(
        `/events/${eventId}/proposals${pageQuery(params)}`
      ),
    create: (
      eventId: string,
      change: import("./types").Change,
      expected?: { baseVersion: number; baselineHash: string }
    ) =>
      post<import("./types").Proposal>(`/events/${eventId}/proposals`, {
        change,
        ...(expected
          ? {
              expected_base_version: expected.baseVersion,
              expected_baseline_hash: expected.baselineHash
            }
          : {})
      }),
    approve: (eventId: string, proposalId: string) =>
      post<import("./types").ApprovalResult>(
        `/events/${eventId}/proposals/${proposalId}/approve`
      ),
    reject: (eventId: string, proposalId: string) =>
      post<import("./types").Proposal>(
        `/events/${eventId}/proposals/${proposalId}/reject`,
        {}
      )
  },
  revisions: {
    list: (eventId: string, params?: { limit?: number; offset?: number }) =>
      request<import("./types").Page<import("./types").Revision>>(
        `/events/${eventId}/revisions${pageQuery(params)}`
      )
  },
  ai: {
    status: () => request<import("./types").AiStatus>("/ai/status"),
    explain: (eventId: string, change: import("./types").Change) =>
      post<import("./types").AiExplanation>(`/events/${eventId}/ai/explain`, { change }),
    consent: (policyVersion: string) =>
      post("/ai/consent", { policy_version: policyVersion }),
    revoke: () => request("/ai/consent", { method: "DELETE" })
  },
  demo: {
    fixture: () => request<import("./types").DemoFixture>("/demo/fixture"),
    simulate: () =>
      post<import("./types").DemoResult>("/demo/simulate", {
        scenario: "guests_180_to_240"
      })
  }
};

export { request };
