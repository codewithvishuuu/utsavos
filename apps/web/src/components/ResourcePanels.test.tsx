import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import type { PlanItem, PlanTask, Vendor } from "../api/types";
import { CeremoniesPanel } from "./CeremoniesPanel";
import { GuestsPanel } from "./GuestsPanel";
import { QuotesPanel } from "./QuotesPanel";
import { TasksPanel } from "./TasksPanel";
import { VendorsPanel } from "./VendorsPanel";

vi.mock("../api/client", () => ({
  api: {
    ceremonies: { create: vi.fn() },
    guests: { create: vi.fn() },
    vendors: { create: vi.fn() },
    quotes: { create: vi.fn() },
    tasks: { create: vi.fn(), update: vi.fn() },
    dependencies: { create: vi.fn() }
  }
}));

class IdempotencyConflict extends Error {
  status = 409;
  code = "idempotency_conflict";
  details = {};
  requestId = "request-1";
}

const vendor: Vendor = {
  id: "vendor-1",
  name: "Taj Falaknuma",
  category: "Venue",
  contact_name: null,
  email: null,
  phone: null,
  status: "considering"
};

const item: PlanItem = {
  id: "item-1",
  label: "Venue",
  category: "Venue",
  basis: "fixed",
  unit_amount_minor: 42_000_000,
  quantity: 1,
  vendor_id: null,
  quote_minor: null,
  is_optional: false
};

const task = (id: string, title: string): PlanTask => ({
  id,
  title,
  status: "todo",
  due_date: "2026-12-01",
  offset_days: null,
  is_locked: false
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.ceremonies.create).mockResolvedValue({});
  vi.mocked(api.guests.create).mockResolvedValue({});
  vi.mocked(api.vendors.create).mockResolvedValue({});
  vi.mocked(api.quotes.create).mockResolvedValue({});
  vi.mocked(api.tasks.create).mockResolvedValue({});
  vi.mocked(api.tasks.update).mockResolvedValue({});
  vi.mocked(api.dependencies.create).mockResolvedValue({});
});

describe("resource panels", () => {
  it("creates a ceremony with its date and guest count", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <CeremoniesPanel
        eventId="event-1"
        eventDate="2027-02-14"
        ceremonies={[]}
        onChanged={onChanged}
      />
    );

    await user.type(screen.getByLabelText("Ceremony name"), "Mehndi");
    await user.clear(screen.getByLabelText("Ceremony guests"));
    await user.type(screen.getByLabelText("Ceremony guests"), "40");
    await user.type(screen.getByLabelText("Ceremony venue (optional)"), "Home");
    await user.click(screen.getByRole("button", { name: "Add ceremony" }));

    await waitFor(() =>
      expect(api.ceremonies.create).toHaveBeenCalledWith(
        "event-1",
        {
          name: "Mehndi",
          ceremony_date: "2027-02-14",
          guest_count: 40,
          venue: "Home"
        },
        expect.any(String)
      )
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("creates a guest without changing the event headcount", async () => {
    const user = userEvent.setup();
    render(
      <GuestsPanel
        eventId="event-1"
        guests={[]}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.type(screen.getByLabelText("Guest name"), "Meera");
    await user.clear(screen.getByLabelText("Party size"));
    await user.type(screen.getByLabelText("Party size"), "2");
    await user.type(screen.getByLabelText("Dietary tags (optional)"), "vegetarian");
    await user.click(screen.getByRole("button", { name: "Add guest" }));

    await waitFor(() =>
      expect(api.guests.create).toHaveBeenCalledWith(
        "event-1",
        {
          full_name: "Meera",
          party_size: 2,
          dietary_tags: "vegetarian",
          phone: null
        },
        expect.any(String)
      )
    );
  });

  it("creates a vendor", async () => {
    const user = userEvent.setup();
    render(
      <VendorsPanel
        eventId="event-1"
        vendors={[]}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.type(screen.getByLabelText("Vendor name"), "Taj Falaknuma");
    await user.click(screen.getByRole("button", { name: "Add vendor" }));

    await waitFor(() =>
      expect(api.vendors.create).toHaveBeenCalledWith(
        "event-1",
        {
          name: "Taj Falaknuma",
          category: "Venue",
          status: "considering"
        },
        expect.any(String)
      )
    );
  });

  it("records a confirmed quote against a budget item", async () => {
    const user = userEvent.setup();
    render(
      <QuotesPanel
        eventId="event-1"
        vendors={[vendor]}
        items={[item]}
        quotes={[]}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.selectOptions(screen.getByLabelText("Quote vendor"), "vendor-1");
    await user.type(screen.getByLabelText("Quote amount (₹)"), "390000");
    await user.selectOptions(screen.getByLabelText("Quote budget item"), "item-1");
    await user.selectOptions(screen.getByLabelText("Quote status"), "confirmed");
    await user.click(screen.getByRole("button", { name: "Add quote" }));

    await waitFor(() =>
      expect(api.quotes.create).toHaveBeenCalledWith(
        "event-1",
        "vendor-1",
        {
          amount_minor: 39_000_000,
          budget_item_id: "item-1",
          status: "confirmed"
        },
        expect.any(String)
      )
    );
  });

  it("adds tasks, updates status and links a dependency", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn().mockResolvedValue(undefined);
    const tasks = [task("task-1", "Send invites"), task("task-2", "Confirm headcount")];
    render(
      <TasksPanel
        eventId="event-1"
        eventDate="2027-02-14"
        tasks={tasks}
        dependencies={[]}
        onChanged={onChanged}
      />
    );

    await user.type(screen.getByLabelText("Task title"), "Book venue");
    fireEvent.change(screen.getByLabelText("Task due date"), {
      target: { value: "2026-12-01" }
    });
    await user.click(screen.getByRole("button", { name: "Add task" }));
    await waitFor(() =>
      expect(api.tasks.create).toHaveBeenCalledWith(
        "event-1",
        {
          title: "Book venue",
          due_date: "2026-12-01",
          status: "todo",
          offset_days: -75
        },
        expect.any(String)
      )
    );

    await user.selectOptions(screen.getByLabelText("Status for Send invites"), "done");
    await waitFor(() =>
      expect(api.tasks.update).toHaveBeenCalledWith("event-1", "task-1", { status: "done" })
    );

    await user.selectOptions(screen.getByLabelText("Predecessor"), "task-1");
    await user.selectOptions(screen.getByLabelText("Successor"), "task-2");
    await user.click(screen.getByRole("button", { name: "Add dependency" }));
    await waitFor(() =>
      expect(api.dependencies.create).toHaveBeenCalledWith("event-1", "task-1", "task-2")
    );
  });

  it("keeps task and ceremony date defaults aligned after the event date changes", () => {
    const taskProps = {
      eventId: "event-1",
      tasks: [] as PlanTask[],
      dependencies: [],
      onChanged: vi.fn().mockResolvedValue(undefined)
    };
    const tasks = render(<TasksPanel eventDate="2027-02-14" {...taskProps} />);
    expect(screen.getByLabelText("Task due date")).toHaveValue("2027-02-14");
    tasks.rerender(<TasksPanel eventDate="2027-02-21" {...taskProps} />);
    expect(screen.getByLabelText("Task due date")).toHaveValue("2027-02-21");
    tasks.unmount();

    const ceremonies = render(
      <CeremoniesPanel
        eventId="event-1"
        eventDate="2027-02-14"
        ceremonies={[]}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />
    );
    expect(screen.getByLabelText("Ceremony date")).toHaveValue("2027-02-14");
    ceremonies.rerender(
      <CeremoniesPanel
        eventId="event-1"
        eventDate="2027-02-21"
        ceremonies={[]}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />
    );
    expect(screen.getByLabelText("Ceremony date")).toHaveValue("2027-02-21");
  });

  it("keeps a pending guest in the form when the save request fails", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn().mockResolvedValue(undefined);
    vi.mocked(api.guests.create).mockRejectedValue(new Error("Network down"));
    render(<GuestsPanel eventId="event-1" guests={[]} onChanged={onChanged} />);

    await user.type(screen.getByLabelText("Guest name"), "Meera");
    await user.click(screen.getByRole("button", { name: "Add guest" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
    expect(screen.getByLabelText("Guest name")).toHaveValue("Meera");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("submits once when the same add request is triggered rapidly", async () => {
    let resolveCreate!: (value: unknown) => void;
    const onChanged = vi.fn().mockResolvedValue(undefined);
    vi.mocked(api.guests.create).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );
    render(<GuestsPanel eventId="event-1" guests={[]} onChanged={onChanged} />);

    fireEvent.change(screen.getByLabelText("Guest name"), { target: { value: "Meera" } });
    const form = screen.getByRole("form", { name: "Add guest" });
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(api.guests.create).toHaveBeenCalledTimes(1));
    resolveCreate({});
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("reuses the same key when retrying after a lost response", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn().mockResolvedValue(undefined);
    vi.mocked(api.guests.create).mockRejectedValueOnce(new Error("Network down"));
    render(<GuestsPanel eventId="event-1" guests={[]} onChanged={onChanged} />);

    await user.type(screen.getByLabelText("Guest name"), "Meera");
    await user.click(screen.getByRole("button", { name: "Add guest" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add guest" })).toBeEnabled()
    );

    await user.click(screen.getByRole("button", { name: "Add guest" }));
    await waitFor(() => expect(api.guests.create).toHaveBeenCalledTimes(2));

    const calls = vi.mocked(api.guests.create).mock.calls;
    expect(calls[0][2]).toEqual(calls[1][2]);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Guest name")).toHaveValue("");
  });

  it("uses a new key for a new submission after success", async () => {
    const user = userEvent.setup();
    render(
      <GuestsPanel
        eventId="event-1"
        guests={[]}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.type(screen.getByLabelText("Guest name"), "Meera");
    await user.click(screen.getByRole("button", { name: "Add guest" }));
    await waitFor(() => expect(api.guests.create).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Guest name")).toHaveValue("");

    await user.type(screen.getByLabelText("Guest name"), "Rohan");
    await user.click(screen.getByRole("button", { name: "Add guest" }));
    await waitFor(() => expect(api.guests.create).toHaveBeenCalledTimes(2));

    const calls = vi.mocked(api.guests.create).mock.calls;
    expect(calls[0][2]).not.toEqual(calls[1][2]);
  });

  it("clears a conflicted key and shows the server message", async () => {
    const user = userEvent.setup();
    const conflict = new IdempotencyConflict(
      "This Idempotency-Key was already used with a different request. Start a new submission."
    );
    vi.mocked(api.guests.create).mockRejectedValueOnce(conflict);
    render(
      <GuestsPanel
        eventId="event-1"
        guests={[]}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.type(screen.getByLabelText("Guest name"), "Meera");
    await user.click(screen.getByRole("button", { name: "Add guest" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This Idempotency-Key was already used with a different request"
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add guest" })).toBeEnabled()
    );

    await user.click(screen.getByRole("button", { name: "Add guest" }));
    await waitFor(() => expect(api.guests.create).toHaveBeenCalledTimes(2));

    const calls = vi.mocked(api.guests.create).mock.calls;
    expect(calls[0][2]).not.toEqual(calls[1][2]);
  });
});
