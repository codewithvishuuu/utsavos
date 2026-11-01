import { useRef, useState } from "react";

import { api } from "../api/client";
import type { Guest } from "../api/types";
import { useIdempotencyMutation } from "../lib/idempotency";
import { ErrorAlert } from "./ErrorAlert";

export function GuestsPanel({
  eventId,
  guests,
  onChanged
}: {
  eventId: string;
  guests: Guest[];
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [dietary, setDietary] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mutation = useIdempotencyMutation(`event:${eventId}:guests`);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setBusy(true);
    try {
      const payload = {
        full_name: name,
        party_size: Number(partySize),
        dietary_tags: dietary || null,
        phone: phone || null
      };
      await api.guests.create(eventId, payload, mutation.keyFor(payload));
      mutation.clear();
      setName("");
      setPartySize("1");
      setDietary("");
      setPhone("");
      await onChanged();
    } catch (caught) {
      setError(mutation.errorMessage(caught, "Could not add the guest"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-label="Guest list">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="guests-heading"
            className="font-serif-editorial text-2xl leading-tight text-[#12100E] sm:text-3xl"
          >
            Guests
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[#4A433E]">
            Keep the guest list here. Changing the event headcount still needs a simulation and an
            approved proposal.
          </p>
        </div>
        <span className="rounded-full bg-[#181512]/5 px-3 py-1 font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#4A433E]">
          {guests.length} {guests.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {guests.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-[#181512]/15 bg-[#FAF6F0] px-4 py-5 text-sm leading-relaxed text-[#4A433E]">
          No guests yet. Add the first person or party below.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-[#181512]/10">
          {guests.map((guest) => (
            <li
              key={guest.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#12100E]">{guest.full_name}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6E655F]">
                  <span>Party of {guest.party_size}</span>
                  {guest.dietary_tags && <span>Dietary: {guest.dietary_tags}</span>}
                  {guest.phone && <span>{guest.phone}</span>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-5 grid gap-3 border-t border-[#181512]/10 pt-5 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={submit}
        aria-label="Add guest"
      >
        <div>
          <label className="label" htmlFor="guest-name">
            Guest name
          </label>
          <input
            id="guest-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="guest-party-size">
            Party size
          </label>
          <input
            id="guest-party-size"
            className="input"
            type="number"
            min={0}
            max={50}
            value={partySize}
            onChange={(event) => setPartySize(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="guest-dietary">
            Dietary tags (optional)
          </label>
          <input
            id="guest-dietary"
            className="input"
            value={dietary}
            onChange={(event) => setDietary(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="guest-phone">
            Guest phone (optional)
          </label>
          <input
            id="guest-phone"
            className="input"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <button className="btn self-end sm:col-span-2 lg:col-span-1" disabled={busy}>
          Add guest
        </button>
      </form>
      <ErrorAlert message={error} />
    </section>
  );
}
