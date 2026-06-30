// =============================================================================
// Defensive Design config layer
//
// This single file decouples the *presentation* of the survey from the survey's
// actual question wording. Every label the UI renders for Q1-Q10 comes from here.
// If a survey question is reworded after a pitch, you edit ONE line here — no
// component, column, or migration changes.
//
//  * Q1-Q3  -> contextual FILTERS  (drive interface filtering logic)
//  * Q4-Q9  -> IMPACT variables    (thematic table headers, e.g. the brief's
//                                    "Spatial Transit Sentiment (Q4)")
//  * Q10    -> QUALITATIVE NLP      (280-char text + sentiment tag)
// =============================================================================

import type { SurveyResponse } from "@/data/types";

export type ImpactColumn =
  | "q4_score"
  | "q5_score"
  | "q6_score"
  | "q7_score"
  | "q8_score"
  | "q9_score";

export interface ImpactTheme {
  column: ImpactColumn;
  code: string; // "Q4"
  // Broad thematic category shown as the column header — NOT the literal question.
  header: string;
}

// ---- Q4-Q9: thematic column headers (abstracted from question strings) -------
export const IMPACT_THEMES: ImpactTheme[] = [
  { column: "q4_score", code: "Q4", header: "Spatial Transit Sentiment" },
  { column: "q5_score", code: "Q5", header: "Amenity & Facilities" },
  { column: "q6_score", code: "Q6", header: "Service Responsiveness" },
  { column: "q7_score", code: "Q7", header: "Safety & Security" },
  { column: "q8_score", code: "Q8", header: "Community & Belonging" },
  { column: "q9_score", code: "Q9", header: "Wellbeing & Environment" },
];

export const impactHeader = (t: ImpactTheme) => `${t.header} (${t.code})`;

// ---- Pages 2-4: each deep-dive screen renders a subset of the impact themes ---
// (typology deep-dive screens; grouping is config, so screens re-bind freely).
export interface DeepDivePage {
  slug: string;
  title: string;
  description: string;
  columns: ImpactColumn[];
}

export const DEEP_DIVE_PAGES: DeepDivePage[] = [
  {
    slug: "mobility",
    title: "Mobility & Access",
    description: "Spatial transit and amenity signal across captured records.",
    columns: ["q4_score", "q5_score"],
  },
  {
    slug: "service",
    title: "Service & Safety",
    description: "Operational responsiveness and perceived safety.",
    columns: ["q6_score", "q7_score"],
  },
  {
    slug: "wellbeing",
    title: "Community & Wellbeing",
    description: "Belonging, environment and overall wellbeing themes.",
    columns: ["q8_score", "q9_score"],
  },
];

// ---- Q1-Q3: contextual filters ----------------------------------------------
export interface FilterDef {
  key: "q1_demographic" | "q2_asset_class" | "q3_tenure";
  code: string;
  label: string;
  options: string[];
}

export const FILTER_DEFS: FilterDef[] = [
  {
    key: "q1_demographic",
    code: "Q1",
    label: "Demographic Bracket",
    options: ["18-29", "30-44", "45-59", "60+"],
  },
  {
    key: "q2_asset_class",
    code: "Q2",
    label: "Asset Class",
    options: ["Residential", "Commercial", "Mixed-Use", "Industrial"],
  },
  {
    key: "q3_tenure",
    code: "Q3",
    label: "Tenure",
    options: ["<1yr", "1-3yr", "3-5yr", "5yr+"],
  },
];

// ---- Q10: qualitative NLP engine --------------------------------------------
export const QUALITATIVE = {
  column: "q10_text" as const,
  code: "Q10",
  label: "Open Feedback",
  maxLength: 280, // hard cap, per brief
};

// Helper: type guard tying impact columns back to the response shape.
export const impactValue = (r: SurveyResponse, col: ImpactColumn): number =>
  r[col];
