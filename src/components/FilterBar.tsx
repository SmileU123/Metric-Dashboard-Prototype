// Q1-Q3 contextual filter bar. Drives interface filtering logic across every
// screen via AppContext. Options come from the Defensive Design config, so
// adding/relabelling a filter is a one-line config change.
//
// FilterBar        -> inline dropdown row for the desktop header.
// MobileFilters    -> a floating funnel control + popover panel for narrow
//                     screens, where the header has room only for Tenant/Export.

import { useState } from "react";
import { Select } from "./ui";
import { useApp } from "@/state/AppContext";
import { FILTER_DEFS } from "@/config/defensiveDesign";
import { cn } from "@/lib/cn";

export function FilterBar() {
  const { filters, setFilter, resetFilters } = useApp();
  const anyActive = Object.values(filters).some((v) => v !== "all");

  return (
    <div className="flex flex-wrap items-end gap-3">
      {FILTER_DEFS.map((def) => (
        <Select
          key={def.key}
          label={`${def.label} (${def.code})`}
          value={filters[def.key]}
          onChange={(e) => setFilter(def.key, e.target.value)}
        >
          <option value="all">All</option>
          {def.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      ))}
      {anyActive && (
        <button
          onClick={resetFilters}
          className="h-9 rounded-md border border-line px-3 text-sm text-muted hover:bg-canvas"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// Floating filter control for narrow screens: a funnel button (top-right) that
// opens a popover with the same Q1-Q3 dropdowns.
export function MobileFilters() {
  const { filters, setFilter, resetFilters } = useApp();
  const [open, setOpen] = useState(false);
  const activeCount = Object.values(filters).filter((v) => v !== "all").length;

  return (
    <div className="fixed right-4 top-[68px] z-30">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Filters"
        aria-expanded={open}
        className={cn(
          "relative inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium shadow-md",
          open ? "bg-brand text-brand-fg" : "bg-surface text-ink"
        )}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span
            className={cn(
              "ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-semibold",
              open ? "bg-brand-fg/20 text-brand-fg" : "bg-brand text-brand-fg"
            )}
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 -z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 rounded-xl border border-line bg-surface p-4 shadow-xl">
            <div className="flex flex-col gap-3">
              {FILTER_DEFS.map((def) => (
                <Select
                  key={def.key}
                  label={`${def.label} (${def.code})`}
                  value={filters[def.key]}
                  onChange={(e) => setFilter(def.key, e.target.value)}
                  className="w-full"
                >
                  <option value="all">All</option>
                  {def.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              ))}
            </div>
            {activeCount > 0 && (
              <button
                onClick={resetFilters}
                className="mt-3 w-full rounded-md border border-line px-3 py-2 text-sm text-muted hover:bg-canvas"
              >
                Clear filters
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
