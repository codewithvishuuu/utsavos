const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

/** Display only. Arithmetic never happens in the browser. */
export function formatPaise(minor: number): string {
  return inr.format(minor / 100);
}

/** Parse a rupee string into integer paise without floating point. */
export function rupeesToPaise(value: string): number {
  const cleaned = value.replace(/[,\s₹]/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) throw new Error("Enter rupees like 1800000 or 1800000.50");
  const rupees = Number(match[1]);
  if (!Number.isSafeInteger(rupees)) throw new Error("Amount is too large");
  const paise = Number((match[2] ?? "0").padEnd(2, "0"));
  return rupees * 100 + paise;
}

export function paiseToInput(minor: number): string {
  const rupees = Math.floor(minor / 100);
  const paise = minor % 100;
  return paise === 0 ? String(rupees) : `${rupees}.${String(paise).padStart(2, "0")}`;
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

/** Whole calendar days from one YYYY-MM-DD date to another, independent of local time. */
export function daysBetween(fromIso: string, toIso: string): number {
  const dayMs = 86_400_000;
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / dayMs
  );
}

/** Today as a local YYYY-MM-DD string. Never UTC, so date comparisons stay calendar-based. */
export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}
