// Domain types shared across the data layer and UI.
// These mirror the Supabase schema (supabase/migrations/0001_init_multitenant.sql)
// but are hand-authored so the app compiles even before `db:types` is generated.

export type ComplianceState = "green" | "amber" | "red";
export type Sentiment = "positive" | "neutral" | "negative";
export type ResponseSource = "field_pwa" | "digital_public";
export type MetricDirection = "higher_better" | "lower_better";

// Respondent typology — drives the Pages 2-4 deep-dive segmentation.
export type RespondentTypology = "construction_adjacent" | "resident_completed";
export type DeliveryModel = "build_to_rent" | "build_to_sell";

export interface Tenant {
  id: string;
  name: string;
  branding: {
    brand?: string; // "r g b" triplet for the white-label accent
    logoText?: string;
  };
}

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  status: "active" | "in_report" | "completed" | "archived";
  completion_date: string | null;
  retention_expires_at: string | null;
}

export interface SurveyResponse {
  id: string;
  tenant_id: string;
  project_id: string | null;

  respondent_typology: RespondentTypology;
  delivery_model: DeliveryModel | null;

  source: ResponseSource;
  submitted_at: string; // ISO

  // Q1-Q3 contextual filters
  q1_demographic: string;
  q2_asset_class: string;
  q3_tenure: string;

  // Q4-Q9 generalized impact variables (0-100)
  q4_score: number;
  q5_score: number;
  q6_score: number;
  q7_score: number;
  q8_score: number;
  q9_score: number;

  // Quantitative: housing cost-to-income ratio (%). Lower is better.
  housing_cost_to_income: number;

  // Q10 qualitative NLP
  q10_text: string;
  q10_sentiment: Sentiment;
  q10_sentiment_score: number;
}

// A computed metric ready to render in a card (+ everything the charts need).
export interface MetricView {
  slot_index: number;
  metric_title: string;
  metric_value: string; // formatted, with unit
  raw_value: number;
  compliance_state: ComplianceState;
  unit: string;
  green_at: number;
  amber_at: number;
  direction: MetricDirection;
  scale_max: number;
  trend: { label: string; value: number }[]; // last 6 months
}

// =============================================================================
// KPI ENGINE (mirrors supabase/migrations/0005_kpi_engine.sql)
// =============================================================================
export type KpiCalcType = "weighted_average" | "ratio" | "index" | "direct";
export type KpiSourceType = "survey" | "external" | "computed";
export type KpiTransformation =
  | "passthrough"
  | "normalize_1_5_to_0_100"
  | "invert_cost_to_income";
export type KpiFormulaType =
  | "weighted_sum"
  | "weighted_average"
  | "ratio"
  | "index"
  | "direct";

export interface KpiDefinition {
  id: string;
  tenant_id: string | null; // null = global
  project_id: string | null;
  kpi_code: string;
  kpi_name: string;
  description: string;
  category: string;
  calculation_type: KpiCalcType;
  is_composite: boolean;
  is_active: boolean;
  display_order: number;
}

export interface KpiSource {
  id: string;
  kpi_id: string;
  source_type: KpiSourceType;
  source_key: string; // survey column, e.g. 'q4_score'
  weight: number;
  transformation: KpiTransformation;
  is_active: boolean;
}

export interface KpiFormula {
  id: string;
  kpi_id: string;
  formula_type: KpiFormulaType;
  expression: string;
  normalization_min: number;
  normalization_max: number;
}

export interface KpiThreshold {
  id: string;
  kpi_id: string;
  condition_type: "absolute" | "percentage" | "score_range";
  green_min: number;
  amber_min: number;
  red_min: number;
  is_global: boolean;
}

// Everything the engine needs, fetched together.
export interface KpiConfig {
  definitions: KpiDefinition[];
  sources: KpiSource[];
  formulas: KpiFormula[];
  thresholds: KpiThreshold[];
}

// Runtime output (KPI_Result) enriched with the extras the charts need.
export interface KpiComputed extends MetricView {
  kpi_id: string;
  kpi_code: string;
  category: string;
  data_period: string;
  calculated_at: string;
}

// Audit record for one engine run (KPI_RunLog).
export interface KpiRunLog {
  tenant_id: string;
  input_records_count: number;
  calculation_version: string;
  execution_time_ms: number;
  status: "success" | "failed";
  error_message: string | null;
  created_at: string;
}

// The Q1-Q3 filter selection that drives every screen.
export interface FilterState {
  q1_demographic: string | "all";
  q2_asset_class: string | "all";
  q3_tenure: string | "all";
}
