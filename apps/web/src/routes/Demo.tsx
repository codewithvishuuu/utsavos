import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { DemoFixture, DemoResult } from "../api/types";
import { BudgetSummary } from "../components/BudgetSummary";
import { formatDate, formatPaise } from "../lib/format";

export default function Demo() {
  const [fixture, setFixture] = useState<DemoFixture | null>(null);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api.demo
      .fixture()
      .then((value) => {
        if (active) setFixture(value);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Demo unavailable");
      });
    return () => {
      active = false;
    };
  }, []);

  async function simulate() {
    setBusy(true);
    setError("");
    try {
      setResult(await api.demo.simulate());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Public demo</h1>
        <p className="text-sm text-slate-600">
          Read-only. No account, no database writes, no AI. Every figure is computed by the same
          deterministic engine the signed-in app uses.
        </p>
      </header>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {fixture && (
        <section className="card">
          <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">{fixture.disclaimer}</p>
          <h2 className="mt-3 font-medium">{fixture.event.name}</h2>
          <p className="text-sm text-slate-600">
            {fixture.persona.name}, {fixture.persona.age}, {fixture.persona.city} ·{" "}
            {formatDate(fixture.event.event_date)} · {fixture.event.guest_count} guests
          </p>
          <div className="mt-3">
            <BudgetSummary totals={fixture.baseline} />
          </div>
          <p className="mt-3 text-sm">
            Scenario: <strong>{fixture.scenario.label}</strong>
          </p>
          <button className="btn mt-3" onClick={simulate} disabled={busy}>
            {busy ? "Computing…" : "Run simulation"}
          </button>
        </section>
      )}

      {result && (
        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Computed impact</h2>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
              {result.result.feasible ? "feasible" : "needs a decision"}
            </span>
          </div>
          <div className="mt-3">
            <BudgetSummary totals={result.result.projected} />
          </div>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th scope="col" className="py-1">Change</th>
                <th scope="col" className="text-right">Delta</th>
              </tr>
            </thead>
            <tbody>
              {result.result.lines.map((line) => (
                <tr key={`${line.kind}-${line.label}`} className="border-t border-slate-100">
                  <td className="py-1">{line.label}</td>
                  <td className="text-right">
                    {line.value_type === "money"
                      ? formatPaise(Number(line.delta))
                      : String(line.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="mt-4 font-medium">Alternatives computed from real constraints</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {result.result.alternatives.map((alternative) => (
              <div key={alternative.id} className="rounded border border-slate-200 p-3">
                <p className="text-sm font-medium">{alternative.title}</p>
                <p className="mt-1 text-sm text-slate-600">{alternative.summary}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Committed after: {formatPaise(alternative.committed_after_minor)}
                </p>
              </div>
            ))}
          </div>
          {result.result.alternative_notes.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {result.result.alternative_notes.join(" ")}
            </p>
          )}
        </section>
      )}

      {!fixture && !error && <p className="text-sm text-slate-600">Loading fixture…</p>}
    </div>
  );
}
