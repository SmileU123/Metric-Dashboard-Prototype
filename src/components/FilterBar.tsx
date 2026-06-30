// Q1-Q3 contextual filter bar. Drives interface filtering logic across every
// screen via AppContext. Options come from the Defensive Design config, so
// adding/relabelling a filter is a one-line config change.

import { Select } from "./ui";
import { useApp } from "@/state/AppContext";
import { FILTER_DEFS } from "@/config/defensiveDesign";

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
