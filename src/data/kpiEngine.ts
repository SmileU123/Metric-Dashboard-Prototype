// In-app KPI ENGINE — the TypeScript mirror of recompute_kpis() in
// supabase/migrations/0005_kpi_engine.sql.
//
//   survey rows → sources (weight) → formula (per calculation_type)
//   → normalization clamp → thresholds → KPI_Result (+ a KPI_RunLog for audit)
//
// Values are read DYNAMICALLY from each response's `scores` map (question code →
// normalized 0-100, produced by the mapping layer / survey_value_maps), with a
// fallback to the typed impact columns. A brand-new question + KPI is therefore
// pure data — no schema or code changes here.
//
// Running it in the browser keeps Page 1 interactive under the Q1–Q3 filters
// (the DB function is the Phase-3 scheduled/batch path that writes KPI_Result).

import type {
  ComplianceState,
  KpiComputed,
  KpiConfig,
  KpiDefinition,
  KpiFormula,
  KpiRunLog,
  KpiSource,
  KpiThreshold,
  SurveyResponse,
} from "./types";

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

// Dynamic source read: scores map first (any catalogued question), typed
// column fallback. Returns null when the response didn't answer the question.
function srcVal(r: SurveyResponse, key: string): number | null {
  const fromScores = r.scores?.[key.toLowerCase()];
  const v = fromScores ?? (r as unknown as Record<string, unknown>)[key];
  const n = Number(v);
  return v != null && Number.isFinite(n) ? n : null;
}

// Per-source mean (of normalized values) across the given rows.
function sourceMeans(
  sources: KpiSource[],
  rows: SurveyResponse[]
): { weight: number; mean: number }[] {
  const out: { weight: number; mean: number }[] = [];
  for (const s of sources) {
    if (!s.is_active) continue;
    const nums = rows
      .map((r) => srcVal(r, s.source_key))
      .filter((n): n is number => n !== null);
    if (nums.length === 0) continue;
    out.push({
      weight: s.weight,
      mean: nums.reduce((a, n) => a + n, 0) / nums.length,
    });
  }
  return out;
}

// "50/50 by tenure": mean of the source per tenure group (BTR vs private sale),
// then the average of the group means — each tenure counts equally regardless
// of sample size. Falls back to the single available group.
function tenureSplitMean(
  source: KpiSource,
  rows: SurveyResponse[]
): number | null {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.tenure) continue;
    const v = srcVal(r, source.source_key);
    if (v === null) continue;
    const g = groups.get(r.tenure) ?? [];
    g.push(v);
    groups.set(r.tenure, g);
  }
  if (groups.size === 0) return null;
  const means = [...groups.values()].map(
    (g) => g.reduce((a, n) => a + n, 0) / g.length
  );
  return means.reduce((a, n) => a + n, 0) / means.length;
}

// Combine the source means according to the KPI's calculation_type, then clamp
// to the formula's normalization range.
function kpiValue(
  def: KpiDefinition,
  sources: KpiSource[],
  formula: KpiFormula | undefined,
  rows: SurveyResponse[]
): number {
  const lo0 = formula?.normalization_min ?? 0;
  const hi0 = formula?.normalization_max ?? 100;

  if (def.calculation_type === "direct_tenure_split") {
    const src = sources.find((s) => s.is_active);
    const v = src ? tenureSplitMean(src, rows) : null;
    return clamp(v ?? 0, lo0, hi0);
  }

  const parts = sourceMeans(sources, rows);
  if (parts.length === 0) return 0;

  const wsum = parts.reduce((a, p) => a + p.weight, 0);
  let value: number;
  switch (def.calculation_type) {
    case "ratio":
      // ratio of the first two sources → percentage.
      value =
        parts.length >= 2 && parts[1].mean !== 0
          ? (100 * parts[0].mean) / parts[1].mean
          : parts[0].mean;
      break;
    case "weighted_sum":
      value = parts.reduce((a, p) => a + p.weight * p.mean, 0);
      break;
    case "direct":
      value = parts[0].mean;
      break;
    case "index":
    case "weighted_average":
    default:
      value =
        wsum > 0
          ? parts.reduce((a, p) => a + p.weight * p.mean, 0) / wsum
          : parts[0].mean;
  }

  const lo = formula?.normalization_min ?? 0;
  const hi = formula?.normalization_max ?? 100;
  return clamp(value, lo, hi);
}

function evaluate(value: number, th: KpiThreshold | undefined): ComplianceState {
  if (!th) return "green";
  if (value >= th.green_min) return "green";
  if (value >= th.amber_min) return "amber";
  return "red";
}

// Render the value per its display_format + unit suffix.
function formatValue(value: number, unit: string, fmt: KpiDefinition["display_format"]): string {
  const f1 = Math.round(value * 10) / 10;
  switch (fmt) {
    case "raw":
      return unit === "%" ? `${Math.round(value)}%` : unit ? `${Math.round(value)} ${unit}` : `${Math.round(value)}`;
    case "percent":
      return `${f1}%`;
    case "fixed_1dp":
    default:
      return unit === "%" ? `${f1}%` : unit ? `${f1} ${unit}` : `${f1}`;
  }
}

const quarterOf = (d: Date) => Math.floor(d.getMonth() / 3); // 0..3

// Quarterly trend (surveys run on a quarterly/biannual cadence, not monthly).
// Re-runs the KPI over each of the last N quarters → smooth Q1–Q4 timelines
// with no empty monthly drops.
function quarterlyTrend(
  def: KpiDefinition,
  sources: KpiSource[],
  formula: KpiFormula | undefined,
  rows: SurveyResponse[],
  quarters = 4
) {
  const now = new Date();
  const curQ = quarterOf(now);
  return Array.from({ length: quarters }, (_, i) => {
    const back = quarters - 1 - i;
    let q = curQ - back;
    let year = now.getFullYear();
    while (q < 0) {
      q += 4;
      year -= 1;
    }
    const bucket = rows.filter((r) => {
      const rd = new Date(r.submitted_at);
      return rd.getFullYear() === year && quarterOf(rd) === q;
    });
    return {
      label: `Q${q + 1}`,
      value: kpiValue(def, sources, formula, bucket),
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
  const formulaFor = (kpiId: string) =>
    config.formulas.find((f) => f.kpi_id === kpiId);
  const thresholdFor = (kpiId: string) =>
    config.thresholds.find((t) => t.kpi_id === kpiId);

  const results: KpiComputed[] = defs.map((d) => {
    const sources = sourcesFor(d.id);
    const formula = formulaFor(d.id);
    const th = thresholdFor(d.id);
    const value = kpiValue(d, sources, formula, rows);
    const state = evaluate(value, th);
    const unit = d.unit ?? "";
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
      metric_description: d.description ?? "",
      metric_value: formatValue(value, unit, d.display_format ?? "fixed_1dp"),
      raw_value: value,
      compliance_state: state,
      unit,
      green_at: th?.green_min ?? 75,
      amber_at: th?.amber_min ?? 50,
      direction: "higher_better",
      scale_max: 100,
      trend: quarterlyTrend(d, sources, formula, rows),
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
