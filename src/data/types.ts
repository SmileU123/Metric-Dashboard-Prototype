// Domain types shared across the data layer and UI.
// These mirror the Supabase schema (supabase/migrations/0001_init_multitenant.sql)
// but are hand-authored so the app compiles even before `db:types` is generated.

export type ComplianceState = "green" | "amber" | "red";
export type Sentiment = "positive" | "neutral" | "negative";
export type ResponseSource = "field_pwa" | "digital_public";
export type MetricDirection = "higher_better" | "lower_better";

// Survey channels (Survey Model v2). `source` is the legacy alias kept for the
// Page-4 channel filter (field_pwa = Field Intercept, digital_public = Online).
export type SurveyChannel = "field" | "online" | "private_ownership";
export type AssetClassState = "in_construction" | "completed";
export type Tenure = "btr" | "private_sale" | "private_ownership";

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

// A survey submission, projected flat from the v2 model (envelope ⋈ answers) by
// the `v_survey_flat` view. Impact columns are named by QUESTION CODE and are
// null when the channel didn't ask that question (field vs online).
export interface SurveyResponse {
  id: string;
  tenant_id: string;
  project_id: string | null;

  channel: SurveyChannel;
  source: ResponseSource; // legacy alias for the channel filter
  asset_class_state: AssetClassState;
  tenure: Tenure | null;
  respondent_typology: RespondentTypology; // derived from asset_class_state
  delivery_model: DeliveryModel | null; // derived from tenure

  temporal_cohort: string; // 'Q3-2026'
  period_year: number;
  period_quarter: number;
  submitted_at: string; // ISO

  // Q1-Q3 contextual filters (envelope dimensions)
  q1_demographic: string; // age bracket
  q2_asset_class: string; // asset state label
  q3_tenure: string; // tenure label

  // Impact questions by code (0-100 after normalization; null if not asked)
  fs_public_space: number | null; // Field Q4 — Public Space Sentiment
  fs_grievance: number | null; // Field Q5 — Grievance & Communication
  ol_green_infra: number | null; // Online — Green infra & efficiency
  ol_active_travel: number | null; // Online — Recycling / active travel
  ol_security: number | null; // Online — Off-peak security
  ol_public_realm: number | null; // Online — Public realm contribution
  ol_grievance: number | null; // Online — Management listens / grievance
  ol_wellbeing_aware: number | null; // Online — Community/wellness awareness

  // Placeholder KPI input (no survey question exists — external in production)
  housing_cost_to_income: number | null;

  // Open text (Field Q7 / Online Q10) + sentiment
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
export type KpiCalcType =
  | "weighted_average"
  | "weighted_sum"
  | "ratio"
  | "index"
  | "direct";
export type KpiUnitType = "score" | "percentage" | "ratio" | "points";
export type KpiDisplayFormat = "raw" | "percent" | "fixed_1dp";
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
  unit: string; // display suffix, e.g. 'pts', '%', 'score'
  unit_type: KpiUnitType; // semantic kind of the value
  display_format: KpiDisplayFormat; // how the number is rendered
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

// Question catalog entry (survey_questions).
export interface SurveyQuestion {
  code: string;
  channel: string; // field | online | private_ownership | shared
  seq: number;
  short_label: string;
  response_type: string; // scale_1_5 | single_choice | multi_choice | yes_no | numeric | open_text
}

// Raw survey data (for the Raw Data page). Preserves the verbatim capture.
export interface RawAnswer {
  question_code: string;
  value_raw: string | null;
  value_raw_type: string;
  value_numeric: number | null;
  value_normalized: number | null;
}

export interface RawResponse {
  id: string;
  tenant_id: string;
  channel: SurveyChannel;
  temporal_cohort: string;
  q1_demographic: string;
  q3_tenure: string;
  q10_text: string;
  q10_sentiment: Sentiment;
  submitted_at: string;
  answers: RawAnswer[];
}

// One stored monthly snapshot (KPI_Timeseries).
export interface KpiTimeseriesPoint {
  kpi_id: string;
  tenant_id: string;
  period: string; // 'YYYY-MM'
  value: number;
  compliance_state: ComplianceState;
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
