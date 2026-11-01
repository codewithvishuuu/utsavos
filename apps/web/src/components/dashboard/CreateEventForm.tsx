import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../../api/client";
import { rupeesToPaise } from "../../lib/format";
import { useIdempotencyMutation } from "../../lib/idempotency";

const inputClass =
  "w-full rounded-xl border border-[#181512]/15 bg-white px-3 py-2.5 text-sm text-[#181512] placeholder:text-[#6E655F]/70 focus:outline-none focus:ring-2 focus:ring-[#C85A32]";
const labelClass =
  "mb-1.5 block font-mono-code text-[10px] uppercase tracking-[0.16em] text-[#6E655F]";

export function CreateEventForm() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mutation = useIdempotencyMutation("account:events");

  const [name, setName] = useState("Ananya & Rohan wedding");
  const [city, setCity] = useState("Hyderabad");
  const [eventDate, setEventDate] = useState("2027-02-14");
  const [guests, setGuests] = useState("180");
  const [budget, setBudget] = useState("1800000");
  const [reserve, setReserve] = useState("180000");

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setBusy(true);
    try {
      const payload = {
        name,
        city,
        event_type: "wedding",
        event_date: eventDate,
        guest_count: Number(guests),
        budget_minor: rupeesToPaise(budget),
        reserve_minor: rupeesToPaise(reserve),
        currency: "INR"
      };
      const created = await api.events.create(payload, mutation.keyFor(payload));
      mutation.clear();
      navigate(`/events/${created.id}`);
    } catch (caught) {
      setError(mutation.errorMessage(caught, "Could not create the event"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={create}>
      {error && (
        <p className="sm:col-span-2 text-sm text-[#A84422]" role="alert">
          {error}
        </p>
      )}
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="event-name">
          Event name
        </label>
        <input
          id="event-name"
          className={inputClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="event-city">
          City
        </label>
        <input
          id="event-city"
          className={inputClass}
          value={city}
          onChange={(event) => setCity(event.target.value)}
          required
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="event-date">
          Event date
        </label>
        <input
          id="event-date"
          className={inputClass}
          type="date"
          value={eventDate}
          onChange={(event) => setEventDate(event.target.value)}
          required
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="event-guests">
          Guests
        </label>
        <input
          id="event-guests"
          className={inputClass}
          type="number"
          min={0}
          value={guests}
          onChange={(event) => setGuests(event.target.value)}
          required
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="event-budget">
          Total budget (₹)
        </label>
        <input
          id="event-budget"
          className={inputClass}
          inputMode="decimal"
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          required
        />
      </div>
      <div className="sm:col-span-2 sm:max-w-xs">
        <label className={labelClass} htmlFor="event-reserve">
          Contingency reserve (₹)
        </label>
        <input
          id="event-reserve"
          className={inputClass}
          inputMode="decimal"
          value={reserve}
          onChange={(event) => setReserve(event.target.value)}
          required
        />
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center rounded-full bg-[#B04B25] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FAF6F0] transition-colors hover:bg-[#8F3A1D] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-2"
        >
          {busy ? "Creating…" : "Create event"}
        </button>
      </div>
    </form>
  );
}
