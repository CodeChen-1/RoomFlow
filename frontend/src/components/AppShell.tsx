import type { ReactNode } from "react";
import { CalendarDays, DoorOpen, LayoutDashboard } from "lucide-react";

import { timezoneLabel } from "../lib/datetime";
import { pageLabel, type Page } from "../lib/router";

const NAV_ITEMS: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { page: "rooms", label: "Rooms", icon: DoorOpen },
  { page: "reservations", label: "Reservations", icon: CalendarDays },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a href="#/dashboard" className="flex items-center gap-3 rounded-xl">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-500 text-slate-950 shadow-sm">
        <DoorOpen className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span>
        <span
          className={`block font-semibold tracking-tight ${compact ? "text-base text-slate-950" : "text-lg text-white"}`}
        >
          RoomFlow
        </span>
        <span className={`block text-[11px] ${compact ? "text-slate-500" : "text-slate-400"}`}>
          Smart room booking
        </span>
      </span>
    </a>
  );
}

export function AppShell({ page, children }: { page: Page; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-teal-800 focus:shadow-lg"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-slate-950 lg:flex">
        <div className="px-6 py-6">
          <Brand />
        </div>
        <div className="mx-6 mb-6 h-px bg-white/10" />
        <nav aria-label="Primary" className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map(({ page: itemPage, label, icon: Icon }) => {
            const active = page === itemPage;
            return (
              <a
                key={itemPage}
                href={`#/${itemPage}`}
                aria-current={active ? "page" : undefined}
                className={`nav-link ${active ? "nav-link-active" : ""}`}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {label}
                {active ? (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-400" aria-hidden="true" />
                ) : null}
              </a>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-5">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Local workspace
            </p>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-200">Small office</p>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{timezoneLabel()}</p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand compact />
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {pageLabel(page)}
          </span>
        </div>
      </header>

      <main id="main-content" className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-10 lg:pb-12">
          {children}
        </div>
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {NAV_ITEMS.map(({ page: itemPage, label, icon: Icon }) => {
            const active = page === itemPage;
            return (
              <a
                key={itemPage}
                href={`#/${itemPage}`}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] font-semibold transition ${
                  active ? "text-teal-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg ${
                    active ? "bg-teal-50" : ""
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                {label}
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
