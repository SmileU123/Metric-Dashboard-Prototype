// Domain types shared across the data layer and UI.
// These mirror the Supabase schema (supabase/migrations/0001_init_multitenant.sql)
// but are hand-authored so the app compiles even before `db:types` is generated.

export type ComplianceState = "green" | "amber" | "red";
export type Sentiment = "positive" | "neutral" | "negative";
export type ResponseSource = "field_pwa" | "digital_public";
export type Aggregation = "avg" | "count" | "pct_positive" | "pct_compliant";

export interface Tenant {
  id: string;
  name: string;
  branding: {
    brand?: string; // "r g b" triplet for the white-label accent
    logoText?: string;
  };
}

export interface SurveyResponse {
  id: string;
  tenant_id: string;
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

  // Q10 qualitative NLP
  q10_text: string;
  q10_sentiment: Sentiment;
  q10_sentiment_score: number;
}

// Config-driven binding for a Page 1 headline metric slot.
export interface MetricDefinition {
  id: string;
  tenant_id: string;
  slot_index: number; // 1..6
  metric_title: string;
  source_column: keyof SurveyResponse | "id";
  aggregation: Aggregation;
  unit: string;
  green_at: number;
  amber_at: number;
  is_active: boolean;
}

// A computed metric ready to render in a card.
export interface MetricView {
  slot_index: number;
  metric_title: string;
  metric_value: string; // formatted, with unit
  raw_value: number;
  compliance_state: ComplianceState;
}

// The Q1-Q3 filter selection that drives every screen.
export interface FilterState {
  q1_demographic: string | "all";
  q2_asset_class: string | "all";
  q3_tenure: string | "all";
}
