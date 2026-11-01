import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-[#181512]/10 bg-white p-6 sm:p-8">
      <p className="font-mono-code text-[10px] uppercase tracking-[0.2em] text-[#A84422]">
        Page not found
      </p>
      <h1 className="mt-3 font-serif-editorial text-3xl leading-tight text-[#12100E]">
        We could not find that page.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#4A433E]">
        The address may be mistyped or the page may have moved.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/events" className="btn">
          Your events
        </Link>
        <Link to="/" className="btn-secondary">
          Home
        </Link>
      </div>
    </div>
  );
}
