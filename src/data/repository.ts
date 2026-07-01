// Repository: the single seam between the UI and the data source.
//
// When Supabase is configured it queries the live, RLS-protected backend (Stream
// A). Otherwise it serves the built-in seed dataset. The UI imports ONLY this
// module, so swapping data sources (or wiring Phase 2/3 channels) never touches a
// component. Filtering (Q1-Q3) is applied uniformly here.

import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type {
  FilterState,
  KpiConfig,
  KpiDefinition,
  KpiFormula,
  KpiSource,
  KpiThreshold,
  SurveyResponse,
  Tenant,
} from "./types";
import { SEED_KPI_CONFIG, SEED_RESPONSES, SEED_TENANTS } from "./seed";

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

// The KPI engine config: definitions + their sources / formulas / thresholds.
// Global KPIs (tenant_id IS NULL) plus any tenant-specific ones.
export async function fetchKpiConfig(tenantId: string): Promise<KpiConfig> {
  if (!supabase) return SEED_KPI_CONFIG;

  const { data: definitions, error: dErr } = await supabase
    .from("kpi_definition")
    .select("*")
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .eq("is_active", true)
    .order("display_order");
  if (dErr) throw dErr;

  const ids = (definitions ?? []).map((d) => d.id);
  if (ids.length === 0)
    return { definitions: [], sources: [], formulas: [], thresholds: [] };

  const [sources, formulas, thresholds] = await Promise.all([
    supabase.from("kpi_sources").select("*").in("kpi_id", ids),
    supabase.from("kpi_formula").select("*").in("kpi_id", ids),
    supabase.from("kpi_thresholds").select("*").in("kpi_id", ids),
  ]);
  if (sources.error) throw sources.error;
  if (formulas.error) throw formulas.error;
  if (thresholds.error) throw thresholds.error;

  return {
    definitions: definitions as KpiConfig["definitions"],
    sources: sources.data as KpiConfig["sources"],
    formulas: formulas.data as KpiConfig["formulas"],
    thresholds: thresholds.data as KpiConfig["thresholds"],
  };
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

// =============================================================================
// KPI config writes (KPI Engine page). When Supabase is not configured these are
// no-ops — the caller keeps the edit in session-local state so the prototype
// still demonstrates the engine. `canPersist` tells the UI which mode it's in.
// =============================================================================
export const canPersist = isSupabaseConfigured;

// Update returning the row, so we can detect RLS silently blocking the write
// (0 rows affected) and tell the UI the edit didn't persist.
async function assertUpdated(
  promise: PromiseLike<{ data: unknown[] | null; error: unknown }>
) {
  const { data, error } = await promise;
  if (error) throw error;
  if (!data || data.length === 0)
    throw new Error("write blocked (row-level security)");
}

export async function saveThreshold(t: KpiThreshold): Promise<void> {
  if (!supabase) return;
  await assertUpdated(
    supabase
      .from("kpi_thresholds")
      .update({ green_min: t.green_min, amber_min: t.amber_min })
      .eq("id", t.id)
      .select()
  );
}

export async function saveSource(s: KpiSource): Promise<void> {
  if (!supabase) return;
  await assertUpdated(
    supabase
      .from("kpi_sources")
      .update({ weight: s.weight, transformation: s.transformation, is_active: s.is_active })
      .eq("id", s.id)
      .select()
  );
}

export async function saveDefinition(d: KpiDefinition): Promise<void> {
  if (!supabase) return;
  await assertUpdated(
    supabase
      .from("kpi_definition")
      .update({
        kpi_name: d.kpi_name,
        description: d.description,
        category: d.category,
        is_active: d.is_active,
      })
      .eq("id", d.id)
      .select()
  );
}

export async function createKpi(payload: {
  definition: KpiDefinition;
  sources: KpiSource[];
  formula: KpiFormula;
  threshold: KpiThreshold;
}): Promise<void> {
  if (!supabase) return;
  const { definition, sources, formula, threshold } = payload;
  const d = await supabase.from("kpi_definition").insert(definition);
  if (d.error) throw d.error;
  const s = await supabase.from("kpi_sources").insert(sources);
  if (s.error) throw s.error;
  const f = await supabase.from("kpi_formula").insert(formula);
  if (f.error) throw f.error;
  const t = await supabase.from("kpi_thresholds").insert(threshold);
  if (t.error) throw t.error;
}

export async function deleteKpi(kpiId: string): Promise<void> {
  if (!supabase) return;
  // FK on delete cascade removes sources / formula / thresholds / results.
  await assertUpdated(
    supabase.from("kpi_definition").delete().eq("id", kpiId).select()
  );
}
