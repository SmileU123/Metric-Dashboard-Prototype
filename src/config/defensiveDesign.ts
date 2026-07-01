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
//
// Pages 2-4 are segmented by respondent TYPOLOGY (construction-adjacent vs
// completed-building BTR/BTS residents), not by theme — see DEEP_DIVE_PAGES.
// =============================================================================

import type {
  DeliveryModel,
  RespondentTypology,
  SurveyResponse,
} from "@/data/types";

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
  { column: "q4_score", code: "Q4", header: "Environmental & Health Quality" },
  { column: "q5_score", code: "Q5", header: "Public Realm Safety & Access" },
  { column: "q6_score", code: "Q6", header: "Sustainable Mobility" },
  { column: "q7_score", code: "Q7", header: "Sustainability & Energy" },
  { column: "q8_score", code: "Q8", header: "Community & Belonging" },
  { column: "q9_score", code: "Q9", header: "Wellbeing & Amenity" },
];

export const ALL_IMPACT_COLUMNS: ImpactColumn[] = IMPACT_THEMES.map(
  (t) => t.column
);

export const impactHeader = (t: ImpactTheme) => `${t.header} (${t.code})`;

// ---- Pages 2-4: typology deep-dive screens ----------------------------------
// Each screen is the SAME table component filtered to one respondent cohort.
export interface DeepDivePage {
  slug: string;
  title: string;
  description: string;
  typology: RespondentTypology;
  delivery?: DeliveryModel; // narrows completed-building residents
  columns: ImpactColumn[];
}

export const DEEP_DIVE_PAGES: DeepDivePage[] = [
  {
    slug: "construction",
    title: "Construction-Adjacent",
    description:
      "Responses from residents living adjacent to active construction sites.",
    typology: "construction_adjacent",
    columns: ALL_IMPACT_COLUMNS,
  },
  {
    slug: "build-to-rent",
    title: "Completed · Build to Rent",
    description:
      "Residents of completed Build-to-Rent buildings across the portfolio.",
    typology: "resident_completed",
    delivery: "build_to_rent",
    columns: ALL_IMPACT_COLUMNS,
  },
  {
    slug: "build-to-sell",
    title: "Completed · Build to Sell",
    description:
      "Residents of completed Build-to-Sell buildings across the portfolio.",
    typology: "resident_completed",
    delivery: "build_to_sell",
    columns: ALL_IMPACT_COLUMNS,
  },
];

// Predicate: does a response belong to this deep-dive cohort?
export const matchesCohort = (r: SurveyResponse, page: DeepDivePage): boolean =>
  r.respondent_typology === page.typology &&
  (page.delivery === undefined || r.delivery_model === page.delivery);

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

// ---- Page 1 visualization per KPI slot --------------------------------------
// Chart type is presentation config too: swap a slot's visual without code.
export type KpiViz = "gauge" | "ring" | "zonebar" | "columns" | "area" | "bartarget";

// Boardroom layout: four consistent radial dials (slots 1,2,4,5) mirroring the
// first two tiles (gauge + ring), and two horizontal linear gauges (slots 3,6)
// for tracking against strict targets.
export const KPI_VIZ: Record<number, KpiViz> = {
  1: "gauge", // radial dial
  2: "ring", // radial dial
  3: "zonebar", // horizontal linear gauge (Sustainable Mobility)
  4: "gauge", // radial dial (Sustainability Performance)
  5: "ring", // radial dial (Community Wellbeing & Belonging)
  6: "bartarget", // horizontal linear gauge (Housing Affordability)
};

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
