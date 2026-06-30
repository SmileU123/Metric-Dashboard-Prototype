// Repository: the single seam between the UI and the data source.
//
// When Supabase is configured it queries the live, RLS-protected backend (Stream
// A). Otherwise it serves the built-in seed dataset. The UI imports ONLY this
// module, so swapping data sources (or wiring Phase 2/3 channels) never touches a
// component. Filtering (Q1-Q3) is applied uniformly here.

import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type {
  FilterState,
  MetricDefinition,
  SurveyResponse,
  Tenant,
} from "./types";
import { SEED_METRICS, SEED_RESPONSES, SEED_TENANTS } from "./seed";

export const dataSource = isSupabaseConfigured ? "supabase" : "seed";

function applyFilters(rows: SurveyResponse[], f: FilterState): SurveyResponse[] {
  return rows.filter(
    (r) =>
      (f.q1_demographic === "all" || r.q1_demographic === f.q1_demographic) &&
      (f.q2_asset_class === "all" || r.q2_asset_class === f.q2_asset_class) &&
      (f.q3_tenure === "all" || r.q3_tenure === f.q3_tenure)
  );
}

export async function fetchTenants(): Promise<Tenant[]> {
  if (!supabase) return SEED_TENANTS;
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, branding")
    .order("name");
  if (error) throw error;
  return data as Tenant[];
}

export async function fetchMetricDefinitions(
  tenantId: string
): Promise<MetricDefinition[]> {
  if (!supabase) return SEED_METRICS.filter((m) => m.tenant_id === tenantId);
  const { data, error } = await supabase
    .from("metric_definitions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("slot_index");
  if (error) throw error;
  return data as MetricDefinition[];
}

export async function fetchResponses(
  tenantId: string,
  filters: FilterState
): Promise<SurveyResponse[]> {
  if (!supabase) {
    return applyFilters(
      SEED_RESPONSES.filter((r) => r.tenant_id === tenantId),
      filters
    );
  }
  let query = supabase
    .from("survey_responses")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("submitted_at", { ascending: false });

  // Push Q1-Q3 filters down to the database when set.
  if (filters.q1_demographic !== "all")
    query = query.eq("q1_demographic", filters.q1_demographic);
  if (filters.q2_asset_class !== "all")
    query = query.eq("q2_asset_class", filters.q2_asset_class);
  if (filters.q3_tenure !== "all")
    query = query.eq("q3_tenure", filters.q3_tenure);

  const { data, error } = await query.limit(2000);
  if (error) throw error;
  return data as SurveyResponse[];
}
