import { Alert } from "./icons";

export function DashboardLoadingState() {
  return (
    <div
      className="min-h-screen bg-[#FAF6F0] font-sans-ui"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading your workspace…</span>
      <div className="lg:pl-[272px]">
        <div className="h-16 border-b border-[#181512]/10 bg-[#FAF6F0]/90" />
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
          <div className="h-24 animate-pulse rounded-2xl bg-[#181512]/5 motion-reduce:animate-none" />
          <div className="h-64 animate-pulse rounded-3xl bg-[#181512]/5 motion-reduce:animate-none" />
          <div className="h-40 animate-pulse rounded-3xl bg-[#181512]/5 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

export function DashboardErrorState({
  message,
  onRetry
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF6F0] px-4 py-16 font-sans-ui">
      <div className="w-full max-w-lg rounded-3xl border border-[#181512]/10 bg-white p-6 sm:p-8">
        <p className="inline-flex items-center gap-2 font-mono-code text-[10px] uppercase tracking-[0.2em] text-[#A84422]">
          <Alert className="h-3.5 w-3.5" />
          Workspace unavailable
        </p>
        <h1 className="mt-3 font-serif-editorial text-2xl leading-snug text-[#12100E]">
          We could not load your celebrations.
        </h1>
        <p role="alert" className="mt-2 text-sm leading-relaxed text-[#4A433E]">
          {message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#B04B25] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FAF6F0] transition-colors hover:bg-[#8F3A1D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export function DashboardEmptyState() {
  return (
    <section
      aria-labelledby="empty-heading"
      className="rounded-3xl border border-dashed border-[#181512]/20 bg-white/70 p-8 text-center sm:p-12"
    >
      <p className="font-mono-code text-[10px] uppercase tracking-[0.22em] text-[#A84422]">
        No celebrations yet
      </p>
      <h2
        id="empty-heading"
        className="mx-auto mt-3 max-w-md font-serif-editorial text-3xl leading-tight text-[#12100E] sm:text-4xl"
      >
        Begin with the celebration you are planning.
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#4A433E]">
        Set the date, guest baseline, budget and reserve. Every line item can be refined after the
        baseline exists.
      </p>
    </section>
  );
}
