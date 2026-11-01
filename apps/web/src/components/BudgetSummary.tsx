import type { Totals } from "../api/types";
import { formatPaise } from "../lib/format";

export function BudgetSummary({
  totals,
  label = "Budget summary"
}: {
  totals: Totals;
  label?: string;
}) {
  return (
    <section
      className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[#181512]/10 bg-[#181512]/10 min-[360px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
      aria-label={label}
    >
      <Metric label="Total budget" value={formatPaise(totals.budget_minor)} />
      <Metric label="Reserve" value={formatPaise(totals.reserve_minor)} />
      <Metric label="Spendable after reserve" value={formatPaise(totals.spendable_minor)} />
      <Metric label="Projected spend" value={formatPaise(totals.committed_minor)} />
      <Metric
        label="Remaining total budget"
        value={formatPaise(totals.remaining_budget_minor)}
        tone={totals.remaining_budget_minor < 0 ? "bad" : undefined}
      />
      <Metric
        label={totals.over_budget ? "Spendable shortfall" : "Remaining spendable"}
        value={formatPaise(
          totals.over_budget ? totals.spendable_shortfall_minor : totals.remaining_spendable_minor
        )}
        tone={totals.over_budget ? "bad" : "good"}
      />
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="bg-white p-4">
      <p className="font-mono-code text-[9px] uppercase leading-relaxed tracking-[0.14em] text-[#6E655F]">
        {label}
      </p>
      <p
        className={`mt-2 break-words font-mono-code text-[13px] tracking-tight sm:text-sm ${
          tone === "bad"
            ? "text-[#A84422]"
            : tone === "good"
              ? "text-[#3F4A3E]"
              : "text-[#12100E]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
