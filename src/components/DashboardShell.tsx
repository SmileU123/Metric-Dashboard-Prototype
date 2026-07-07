// App shell: white-label header with tenant switcher, left nav across the four
// dashboard screens (+ Q10), and the persistent Q1-Q3 filter bar.

import { NavLink } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FilterBar } from "./FilterBar";
import { useApp } from "@/state/AppContext";
import { dataSource } from "@/data/repository";
import { DEEP_DIVE_PAGES } from "@/config/defensiveDesign";
import { cn } from "@/lib/cn";

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive ? "bg-brand text-brand-fg" : "text-muted hover:bg-canvas hover:text-ink"
  );

export function DashboardShell({ children }: { children: ReactNode }) {
  const { tenant, tenants, setTenantId } = useApp();

  // Demo placeholder (investor-pitch trigger): the Export button is visually
  // active but gated — clicking raises a governance toast instead of exporting.
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const showLockedToast = () => {
    setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3500);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface px-3 py-5 md:block">
        <div className="px-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Data Monitoring
          </p>
          <p className="mt-0.5 text-lg font-semibold text-brand">
            {tenant?.branding?.logoText ?? tenant?.name ?? "Platform"}
          </p>
        </div>
        <nav className="mt-6 space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase text-muted/70">
            Overview
          </p>
          <NavLink to="/" end className={navItemClass}>
            Portfolio Metrics
          </NavLink>
          <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase text-muted/70">
            In-Depth View
          </p>
          {DEEP_DIVE_PAGES.map((p) => (
            <NavLink key={p.slug} to={`/feed/${p.slug}`} className={navItemClass}>
              {p.title}
            </NavLink>
          ))}
          <NavLink to="/qualitative" className={navItemClass}>
            Qualitative Feedback
          </NavLink>
          <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase text-muted/70">
            Raw Data
          </p>
          <NavLink to="/raw" className={navItemClass}>
            Full Survey Data
          </NavLink>
          <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase text-muted/70">
            Configuration
          </p>
          <NavLink to="/engine" className={navItemClass}>
            KPI Engine
          </NavLink>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-muted">
                Tenant
                <select
                  value={tenant?.id ?? ""}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="ml-2 h-9 rounded-md border border-line bg-surface px-2 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <DataSourceBadge />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <FilterBar />
              {/* Global export — demo placeholder, gated until Phase 2 */}
              <button
                onClick={showLockedToast}
                title="Download Report"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-sm font-medium text-brand-fg shadow-sm hover:opacity-90"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export PDF
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>

      {/* Corner governance toast */}
      <div
        aria-live="polite"
        className={cn(
          "fixed bottom-5 right-5 z-50 transition-all duration-300",
          toastVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        )}
      >
        <div className="flex items-center gap-2.5 rounded-lg border border-line bg-ink px-4 py-3 text-sm font-medium text-surface shadow-lg">
          <span aria-hidden>🔒</span>
          Feature locked for Phase 2 Production Launch
        </div>
      </div>
    </div>
  );
}

function DataSourceBadge() {
  const live = dataSource === "supabase";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        live ? "bg-green/10 text-green" : "bg-amber/10 text-amber"
      )}
      title={
        live
          ? "Connected to Supabase (RLS-protected Stream A)"
          : "Running on built-in seed data — set VITE_SUPABASE_URL to go live"
      }
    >
      <span
        className={cn("h-2 w-2 rounded-full", live ? "bg-green" : "bg-amber")}
      />
      {live ? "Live" : "Seed data"}
    </span>
  );
}
