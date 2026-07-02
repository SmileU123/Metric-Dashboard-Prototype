// App shell: white-label header with tenant switcher, left nav across the four
// dashboard screens (+ Q10), and the persistent Q1-Q3 filter bar.

import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
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
            Deep Dives
          </p>
          {DEEP_DIVE_PAGES.map((p) => (
            <NavLink key={p.slug} to={`/feed/${p.slug}`} className={navItemClass}>
              {p.title}
            </NavLink>
          ))}
          <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase text-muted/70">
            Qualitative
          </p>
          <NavLink to="/qualitative" className={navItemClass}>
            Open Feedback (Q10)
          </NavLink>
          <NavLink to="/raw" className={navItemClass}>
            Raw Survey Data
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
            <FilterBar />
          </div>
        </header>

        <main className="flex-1 px-6 py-6">{children}</main>
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
