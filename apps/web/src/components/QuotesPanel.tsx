import { useRef, useState } from "react";

import { api } from "../api/client";
import type { PlanItem, Quote, Vendor } from "../api/types";
import { formatPaise, rupeesToPaise } from "../lib/format";
import { useIdempotencyMutation } from "../lib/idempotency";
import { ErrorAlert } from "./ErrorAlert";

const STATUSES = ["estimated", "quoted", "confirmed", "declined"];

export function QuotesPanel({
  eventId,
  vendors,
  items,
  quotes,
  onChanged
}: {
  eventId: string;
  vendors: Vendor[];
  items: PlanItem[];
  quotes: Quote[];
  onChanged: () => Promise<void>;
}) {
  const [vendorId, setVendorId] = useState("");
  const [amount, setAmount] = useState("");
  const [budgetItemId, setBudgetItemId] = useState("");
  const [status, setStatus] = useState("quoted");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mutation = useIdempotencyMutation(`event:${eventId}:quotes`);

  const vendorNames = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
  const itemLabels = new Map(items.map((item) => [item.id, item.label]));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    setError("");
    if (!vendorId) {
      setError("Choose a vendor first.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const payload = {
        amount_minor: rupeesToPaise(amount),
        budget_item_id: budgetItemId || null,
        status
      };
      const fingerprint = { vendor_id: vendorId, ...payload };
      await api.quotes.create(eventId, vendorId, payload, mutation.keyFor(fingerprint));
      mutation.clear();
      setAmount("");
      await onChanged();
    } catch (caught) {
      setError(mutation.errorMessage(caught, "Could not add the quote"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="quotes-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="quotes-heading"
            className="font-serif-editorial text-2xl leading-tight text-[#12100E] sm:text-3xl"
          >
            Manual quotes
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#4A433E]">
            Link a vendor quote to a budget item. A confirmed quote replaces that item&apos;s
            estimated total; estimated, quoted and declined quotes leave the plan unchanged.
          </p>
        </div>
        <span className="rounded-full bg-[#181512]/5 px-3 py-1 font-mono-code text-[10px] uppercase tracking-[0.12em] text-[#4A433E]">
          {quotes.length} {quotes.length === 1 ? "quote" : "quotes"}
        </span>
      </div>

      {quotes.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-[#181512]/15 bg-[#FAF6F0] px-4 py-5 text-sm leading-relaxed text-[#4A433E]">
          No quotes yet. Record a vendor amount below and connect it to the line it covers.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-[#181512]/10">
          {quotes.map((quote) => (
            <li
              key={quote.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#12100E]">
                  {vendorNames.get(quote.vendor_id) ?? "Unknown vendor"}
                </p>
                <p className="mt-0.5 text-xs text-[#6E655F]">
                  {quote.budget_item_id
                    ? `Covers ${itemLabels.get(quote.budget_item_id) ?? "a budget item"}`
                    : "Not linked to a budget item"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono-code text-sm text-[#12100E]">
                  {formatPaise(quote.amount_minor)}
                </p>
                <span className="mt-1 inline-block rounded-full bg-[#F2ECE1] px-2.5 py-0.5 font-mono-code text-[9px] uppercase capitalize tracking-[0.1em] text-[#8F3A1D]">
                  {quote.status.replace(/_/g, " ")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-5 grid gap-3 border-t border-[#181512]/10 pt-5 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={submit}
        aria-label="Add quote"
      >
        <div>
          <label className="label" htmlFor="quote-vendor">
            Quote vendor
          </label>
          <select
            id="quote-vendor"
            className="input"
            value={vendorId}
            onChange={(event) => setVendorId(event.target.value)}
            required
          >
            <option value="">Choose vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="quote-amount">
            Quote amount (₹)
          </label>
          <input
            id="quote-amount"
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="quote-budget-item">
            Quote budget item
          </label>
          <select
            id="quote-budget-item"
            className="input"
            value={budgetItemId}
            onChange={(event) => setBudgetItemId(event.target.value)}
          >
            <option value="">No budget item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="quote-status">
            Quote status
          </label>
          <select
            id="quote-status"
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
        <button
          className="btn self-end sm:col-span-2 lg:col-span-1"
          disabled={busy || vendors.length === 0}
        >
          Add quote
        </button>
      </form>
      {vendors.length === 0 && (
        <p className="mt-3 text-sm text-[#6E655F]">
          Add a vendor before recording a quote.
        </p>
      )}
      <ErrorAlert message={error} />
    </section>
  );
}
