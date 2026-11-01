import { useRef, useState } from "react";

import { api } from "../api/client";
import type { Vendor } from "../api/types";
import { useIdempotencyMutation } from "../lib/idempotency";
import { ErrorAlert } from "./ErrorAlert";

const STATUSES = ["considering", "contacted", "confirmed", "declined"];

export function VendorsPanel({
  eventId,
  vendors,
  onChanged
}: {
  eventId: string;
  vendors: Vendor[];
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Venue");
  const [status, setStatus] = useState("considering");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mutation = useIdempotencyMutation(`event:${eventId}:vendors`);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setBusy(true);
    try {
      const payload = { name, category, status };
      await api.vendors.create(eventId, payload, mutation.keyFor(payload));
      mutation.clear();
      setName("");
      await onChanged();
    } catch (caught) {
      setError(mutation.errorMessage(caught, "Could not add the vendor"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="vendors-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="vendors-heading"
            className="font-serif-editorial text-2xl leading-tight text-[#12100E] sm:text-3xl"
          >
            Vendors
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[#4A433E]">
            Who you are considering, and where each conversation stands.
          </p>
        </div>
        <span className="rounded-full bg-[#181512]/5 px-3 py-1 font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#4A433E]">
          {vendors.length} {vendors.length === 1 ? "vendor" : "vendors"}
        </span>
      </div>

      {vendors.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-[#181512]/15 bg-[#FAF6F0] px-4 py-5 text-sm leading-relaxed text-[#4A433E]">
          No vendors yet. Add a partner below to start tracking the booking.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-[#181512]/10">
          {vendors.map((vendor) => (
            <li
              key={vendor.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#12100E]">{vendor.name}</p>
                <p className="mt-0.5 text-xs text-[#6E655F]">{vendor.category}</p>
              </div>
              <span className="rounded-full bg-[#F2ECE1] px-3 py-1 font-mono-code text-[10px] uppercase capitalize tracking-[0.1em] text-[#8F3A1D]">
                {vendor.status.replace(/_/g, " ")}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-5 grid gap-3 border-t border-[#181512]/10 pt-5 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={submit}
        aria-label="Add vendor"
      >
        <div>
          <label className="label" htmlFor="vendor-name">
            Vendor name
          </label>
          <input
            id="vendor-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="vendor-category">
            Vendor category
          </label>
          <input
            id="vendor-category"
            className="input"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="vendor-status">
            Vendor status
          </label>
          <select
            id="vendor-status"
            className="input"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <button className="btn self-end sm:col-span-2 lg:col-span-1" disabled={busy}>
          Add vendor
        </button>
      </form>
      <ErrorAlert message={error} />
    </section>
  );
}
