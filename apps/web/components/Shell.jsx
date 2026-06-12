"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ChevronDown, ChevronRight, Command, LogOut, Menu, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { flatNavItems, navSections } from "../lib/navigation";
import { AuthGate } from "./AuthGate";
import { ThemeToggle } from "./ThemeToggle";
import { clearTokens } from "../lib/api";

export function Shell({ children }) {
  return (
    <AuthGate>
      <ShellContent>{children}</ShellContent>
    </AuthGate>
  );
}

function ShellContent({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(navSections.map((section, index) => [section.label, index < 2]))
  );

  const activeItem = useMemo(
    () => flatNavItems.find((item) => pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`))),
    [pathname]
  );

  const visibleSections = useMemo(() => {
    const query = navQuery.trim().toLowerCase();
    if (!query) return navSections;

    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => `${section.label} ${item.label}`.toLowerCase().includes(query))
      }))
      .filter((section) => section.items.length);
  }, [navQuery]);

  const activeSection = activeItem?.section;

  function sectionOpen(section) {
    if (navQuery.trim()) return true;
    return openSections[section.label] || activeSection === section.label;
  }

  function toggleSection(label) {
    setOpenSections((current) => ({ ...current, [label]: !current[label] }));
  }

  function logout() {
    clearTokens();
    router.replace("/login");
  }

  const sidebar = (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:h-screen">
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-[11px] font-black tracking-tight text-white shadow-sm ring-1 ring-slate-800 dark:bg-white dark:text-slate-950 dark:ring-slate-200">
            OD
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold">OpenDeploy</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Control Panel</div>
          </div>
        </Link>
        <button className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" onClick={() => setMobileOpen(false)} type="button"><X className="h-5 w-5" /></button>
      </div>

      <div className="shrink-0 border-b border-slate-200 p-3 dark:border-slate-800">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-white py-2 pl-11 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-500 dark:focus:ring-slate-800"
            value={navQuery}
            onChange={(event) => setNavQuery(event.target.value)}
            placeholder="Menu search"
          />
        </label>
      </div>

      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
        {visibleSections.map((section) => (
          <div key={section.label}>
            <button
              className="mb-1 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              onClick={() => toggleSection(section.label)}
              type="button"
            >
              <span>{section.label}</span>
              {sectionOpen(section) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            {sectionOpen(section) ? <div className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition",
                      active
                        ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div> : null}
          </div>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:grid lg:h-screen lg:grid-cols-[244px_1fr] lg:overflow-hidden">
      <div className="hidden h-screen overflow-hidden lg:sticky lg:top-0 lg:block">{sidebar}</div>
      {mobileOpen ? <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-slate-950/40" onClick={() => setMobileOpen(false)} /> <div className="relative h-full w-80 max-w-[90vw]">{sidebar}</div></div> : null}

      <main className="min-w-0 overflow-x-hidden lg:h-screen lg:overflow-y-auto">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button className="rounded-xl border border-slate-200 p-2 dark:border-slate-800 lg:hidden" onClick={() => setMobileOpen(true)} type="button"><Menu className="h-4 w-4" /></button>
            <div className="min-w-0">
              <div className="text-sm text-slate-500 dark:text-slate-400">{activeItem?.section || "OpenDeploy"}</div>
              <div className="truncate font-semibold">{activeItem?.label || pathname}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 md:flex" type="button">
              <Search className="h-4 w-4" /> Search
            </button>
            <button className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800" title="Command palette" type="button">
              <Command className="h-4 w-4" />
            </button>
            <ThemeToggle />
            <button onClick={logout} className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800" title="Logout" type="button">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
