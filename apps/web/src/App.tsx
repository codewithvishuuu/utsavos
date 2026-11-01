import { Link, Outlet, Route, Routes } from "react-router-dom";

import Dashboard from "./routes/Dashboard";
import Demo from "./routes/Demo";
import EventDetail from "./routes/EventDetail";
import Landing from "./routes/Landing";
import Login from "./routes/Login";
import NotFound from "./routes/NotFound";

function AppShell() {
  return (
    <div className="min-h-screen bg-[#FAF6F0] font-sans-ui text-[#181512] antialiased">
      <header className="border-b border-[#181512]/10 bg-[#FAF6F0]">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link
            to="/events"
            className="flex items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
          >
            <img
              src="/brand/utsavos-icon-dark.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 rounded-full object-cover"
            />
            <span className="text-[15px] font-extrabold tracking-[-0.04em] text-[#12100E]">
              UTSAV
              <span className="font-serif-editorial font-semibold italic text-[#A84422]">OS</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              to="/events"
              className="rounded text-[#4A433E] hover:text-[#A84422] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
            >
              Events
            </Link>
            <Link
              to="/demo"
              className="rounded text-[#4A433E] hover:text-[#A84422] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
            >
              Public demo
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/events" element={<Dashboard />} />
      <Route path="/events/:id" element={<EventDetail />} />
      <Route element={<AppShell />}>
        <Route path="/login" element={<Login />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
