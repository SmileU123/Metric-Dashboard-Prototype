// In-app KPI ENGINE — the TypeScript mirror of recompute_kpis() in
// supabase/migrations/0005_kpi_engine.sql.
//
//   survey rows → sources (weight + transformation) → weighted formula →
//   thresholds → KPI_Result (+ a KPI_RunLog for the audit footer)
//
// Running it in the browser keeps Page 1 interactive under the Q1–Q3 filters
// (the DB function is the Phase-3 scheduled/batch path that writes KPI_Result).

import type {
  ComplianceState,
  KpiComputed,
  KpiConfig,
  KpiDefinition,
  KpiRunLog,
  KpiSource,
  KpiThreshold,
  KpiTransformation,
  SurveyResponse,
} from "./types";

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

function transform(v: number, t: KpiTransformation): number {
  switch (t) {
    case "normalize_1_5_to_0_100":
      return ((v - 1) / 4) * 100;
    case "invert_cost_to_income":
      return clamp(100 - (v - 25) * 3, 0, 100);
    case "passthrough":
    default:
      return v;
  }
}

// Weighted average of each source's transformed mean across the given rows.
function kpiValue(
  sources: KpiSource[],
  rows: SurveyResponse[]
): number {
  if (rows.length === 0) return 0;
  let wsum = 0;
  let vsum = 0;
  for (const s of sources) {
    if (!s.is_active) continue;
    const nums = rows
      .map((r) => Number((r as unknown as Record<string, unknown>)[s.source_key]))
      .filter((n) => Number.isFinite(n));
    if (nums.length === 0) continue;
    const mean =
      nums.reduce((a, n) => a + transform(n, s.transformation), 0) /
      nums.length;
    vsum += mean * s.weight;
    wsum += s.weight;
  }
  return wsum > 0 ? vsum / wsum : 0;
}

function evaluate(value: number, th: KpiThreshold | undefined): ComplianceState {
  if (!th) return "green";
  if (value >= th.green_min) return "green";
  if (value >= th.amber_min) return "amber";
  return "red";
}

// 6-month trend by re-running the KPI over each month's rows.
function monthlyTrend(sources: KpiSource[], rows: SurveyResponse[]) {
  const base = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() - (5 - i), 1);
    const bucket = rows.filter((r) => {
      const rd = new Date(r.submitted_at);
      return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
    });
    return {
      label: d.toLocaleString(undefined, { month: "short" }),
      value: kpiValue(sources, bucket),
    };
  });
}

export interface EngineOutput {
  results: KpiComputed[];
  runLog: KpiRunLog;
}

export function runKpiEngine(
  config: KpiConfig,
  rows: SurveyResponse[],
  tenantId: string,
  period = "live"
): EngineOutput {
  const started =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const now = new Date().toISOString();

  const defs = config.definitions
    .filter(
      (d) => d.is_active && (d.tenant_id === null || d.tenant_id === tenantId)
    )
    .sort((a, b) => a.display_order - b.display_order);

  const sourcesFor = (kpiId: string) =>
    config.sources.filter((s) => s.kpi_id === kpiId);
  const thresholdFor = (kpiId: string) =>
    config.thresholds.find((t) => t.kpi_id === kpiId);

  const results: KpiComputed[] = defs.map((d: KpiDefinition) => {
    const sources = sourcesFor(d.id);
    const th = thresholdFor(d.id);
    const value = kpiValue(sources, rows);
    const state = evaluate(value, th);
    const rounded = Math.round(value * 10) / 10;
    const unit = d.unit ?? "";
    const formatted =
      unit === "%" ? `${rounded}%` : unit ? `${rounded} ${unit}` : `${rounded}`;
    return {
      // audit fields (KPI_Result)
      kpi_id: d.id,
      kpi_code: d.kpi_code,
      category: d.category,
      data_period: period,
      calculated_at: now,
      // card/chart fields (MetricView)
      slot_index: d.display_order,
      metric_title: d.kpi_name,
      metric_value: formatted,
      raw_value: value,
      compliance_state: state,
      unit,
      green_at: th?.green_min ?? 75,
      amber_at: th?.amber_min ?? 50,
      direction: "higher_better",
      scale_max: 100,
      trend: monthlyTrend(sources, rows),
    };
  });

  const elapsed =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
    started;

  return {
    results,
    runLog: {
      tenant_id: tenantId,
      input_records_count: rows.length,
      calculation_version: "v1",
      execution_time_ms: Math.round(elapsed * 100) / 100,
      status: "success",
      error_message: null,
      created_at: now,
    },
  };
}
