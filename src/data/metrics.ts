// Metric computation. Turns a config-driven MetricDefinition + a set of filtered
// responses into a render-ready MetricView (value + traffic-light state).
// Shared by both the Supabase and seed data paths.

import type {
  ComplianceState,
  MetricDefinition,
  MetricView,
  SurveyResponse,
} from "./types";

function aggregate(def: MetricDefinition, rows: SurveyResponse[]): number {
  if (rows.length === 0) return 0;
  switch (def.aggregation) {
    case "count":
      return rows.length;
    case "pct_positive":
      return (
        (100 * rows.filter((r) => r.q10_sentiment === "positive").length) /
        rows.length
      );
    case "pct_compliant": {
      const col = def.source_column as keyof SurveyResponse;
      const compliant = rows.filter(
        (r) => Number(r[col]) >= def.green_at
      ).length;
      return (100 * compliant) / rows.length;
    }
    case "avg":
    default: {
      const col = def.source_column as keyof SurveyResponse;
      const sum = rows.reduce((acc, r) => acc + Number(r[col] ?? 0), 0);
      return sum / rows.length;
    }
  }
}

function complianceState(
  def: MetricDefinition,
  value: number
): ComplianceState {
  if (def.direction === "lower_better") {
    // e.g. Housing Cost-to-Income Ratio: a LOWER value is healthier.
    if (value <= def.green_at) return "green";
    if (value <= def.amber_at) return "amber";
    return "red";
  }
  if (value >= def.green_at) return "green";
  if (value >= def.amber_at) return "amber";
  return "red";
}

function format(def: MetricDefinition, value: number): string {
  if (def.aggregation === "count") return Math.round(value).toLocaleString();
  const rounded = Math.round(value * 10) / 10;
  return def.unit === "%" ? `${rounded}%` : `${rounded}${def.unit ? " " + def.unit : ""}`;
}

export function computeMetric(
  def: MetricDefinition,
  rows: SurveyResponse[]
): MetricView {
  const raw = aggregate(def, rows);
  return {
    slot_index: def.slot_index,
    metric_title: def.metric_title,
    raw_value: raw,
    metric_value: format(def, raw),
    // "Total Responses" style count metrics are informational, not graded.
    compliance_state:
      def.aggregation === "count" ? "green" : complianceState(def, raw),
  };
}

export function computeMetrics(
  defs: MetricDefinition[],
  rows: SurveyResponse[]
): MetricView[] {
  return defs
    .filter((d) => d.is_active)
    .sort((a, b) => a.slot_index - b.slot_index)
    .map((d) => computeMetric(d, rows));
}
