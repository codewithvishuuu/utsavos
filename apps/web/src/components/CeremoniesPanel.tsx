import { useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import type { Ceremony } from "../api/types";
import { formatDate } from "../lib/format";
import { useIdempotencyMutation } from "../lib/idempotency";
import { ErrorAlert } from "./ErrorAlert";

export function CeremoniesPanel({
  eventId,
  eventDate,
  ceremonies,
  onChanged
}: {
  eventId: string;
  eventDate: string;
  ceremonies: Ceremony[];
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(eventDate);
  const [guests, setGuests] = useState("0");
  const [venue, setVenue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mutation = useIdempotencyMutation(`event:${eventId}:ceremonies`);

  useEffect(() => {
    setDate(eventDate);
  }, [eventDate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setBusy(true);
    try {
      const payload = {
        name,
        ceremony_date: date,
        guest_count: Number(guests),
        venue: venue || null
      };
      await api.ceremonies.create(eventId, payload, mutation.keyFor(payload));
      mutation.clear();
      setName("");
      setGuests("0");
      setVenue("");
      await onChanged();
    } catch (caught) {
      setError(mutation.errorMessage(caught, "Could not add the ceremony"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="ceremonies-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="ceremonies-heading"
            className="font-serif-editorial text-2xl leading-tight text-[#12100E] sm:text-3xl"
          >
            Ceremonies
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[#4A433E]">
            The individual functions within the celebration, each with its own date and headcount.
          </p>
        </div>
        <span className="rounded-full bg-[#181512]/5 px-3 py-1 font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#4A433E]">
          {ceremonies.length} {ceremonies.length === 1 ? "ceremony" : "ceremonies"}
        </span>
      </div>

      {ceremonies.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-[#181512]/15 bg-[#FAF6F0] px-4 py-5 text-sm leading-relaxed text-[#4A433E]">
          No ceremonies yet. Add the first function below to start the schedule.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-[#181512]/10">
          {ceremonies.map((ceremony) => (
            <li
              key={ceremony.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#12100E]">{ceremony.name}</p>
                {ceremony.venue && <p className="mt-0.5 text-xs text-[#6E655F]">{ceremony.venue}</p>}
              </div>
              <div className="text-right">
                <p className="font-mono-code text-[11px] uppercase tracking-[0.08em] text-[#A84422]">
                  {formatDate(ceremony.ceremony_date)}
                </p>
                <p className="mt-0.5 text-xs text-[#6E655F]">{ceremony.guest_count} guests</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-5 grid gap-3 border-t border-[#181512]/10 pt-5 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={submit}
        aria-label="Add ceremony"
      >
        <div>
          <label className="label" htmlFor="ceremony-name">
            Ceremony name
          </label>
          <input
            id="ceremony-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="ceremony-date">
            Ceremony date
          </label>
          <input
            id="ceremony-date"
            className="input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="ceremony-guests">
            Ceremony guests
          </label>
          <input
            id="ceremony-guests"
            className="input"
            type="number"
            min={0}
            value={guests}
            onChange={(event) => setGuests(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="ceremony-venue">
            Ceremony venue (optional)
          </label>
          <input
            id="ceremony-venue"
            className="input"
            value={venue}
            onChange={(event) => setVenue(event.target.value)}
          />
        </div>
        <button className="btn self-end sm:col-span-2 lg:col-span-1" disabled={busy}>
          Add ceremony
        </button>
      </form>
      <ErrorAlert message={error} />
    </section>
  );
}
