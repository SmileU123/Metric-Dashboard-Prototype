// Application state: which tenant is active, the Q1-Q3 filter selection, and the
// loaded data (responses + metric definitions). Everything the dashboard renders
// flows from here, so the white-label switch and the filter bar update all pages
// at once.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchMetricDefinitions,
  fetchResponses,
  fetchTenants,
} from "@/data/repository";
import { applyTenantTheme } from "@/config/theme";
import type {
  FilterState,
  MetricDefinition,
  SurveyResponse,
  Tenant,
} from "@/data/types";

const NO_FILTERS: FilterState = {
  q1_demographic: "all",
  q2_asset_class: "all",
  q3_tenure: "all",
};

interface AppState {
  loading: boolean;
  error: string | null;
  tenants: Tenant[];
  tenant: Tenant | null;
  setTenantId: (id: string) => void;
  filters: FilterState;
  setFilter: (key: keyof FilterState, value: string) => void;
  resetFilters: () => void;
  responses: SurveyResponse[]; // already filtered by Q1-Q3
  metricDefs: MetricDefinition[];
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState<string>(
    (import.meta.env.VITE_DEFAULT_TENANT as string) || ""
  );
  const [filters, setFilters] = useState<FilterState>(NO_FILTERS);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [metricDefs, setMetricDefs] = useState<MetricDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tenant list once.
  useEffect(() => {
    fetchTenants()
      .then((ts) => {
        setTenants(ts);
        setTenantId((prev) => prev || ts[0]?.id || "");
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const tenant = useMemo(
    () => tenants.find((t) => t.id === tenantId) ?? null,
    [tenants, tenantId]
  );

  // Re-skin when the active tenant changes (white-label).
  useEffect(() => applyTenantTheme(tenant), [tenant]);

  // Reload data whenever tenant or filters change.
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchMetricDefinitions(tenantId),
      fetchResponses(tenantId, filters),
    ])
      .then(([defs, rows]) => {
        if (cancelled) return;
        setMetricDefs(defs);
        setResponses(rows);
        setError(null);
      })
      .catch((e) => !cancelled && setError(String(e?.message ?? e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tenantId, filters]);

  const setFilter = useCallback(
    (key: keyof FilterState, value: string) =>
      setFilters((f) => ({ ...f, [key]: value })),
    []
  );
  const resetFilters = useCallback(() => setFilters(NO_FILTERS), []);

  const value: AppState = {
    loading,
    error,
    tenants,
    tenant,
    setTenantId,
    filters,
    setFilter,
    resetFilters,
    responses,
    metricDefs,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
