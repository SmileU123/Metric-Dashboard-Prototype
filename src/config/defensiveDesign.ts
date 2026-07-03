// =============================================================================
// Defensive Design config layer (Survey Model v2)
//
// Decouples the *presentation* from the survey's question wording. Impact columns
// are now QUESTION CODES from the catalog (survey_questions), so which questions
// a screen/KPI shows is config, not schema.
//
//  * FILTER_DEFS   -> contextual filters (envelope dimensions)
//  * IMPACT_THEMES -> impact questions (thematic table headers)
//  * QUALITATIVE   -> open-text (Field Q7 / Online Q10) + sentiment
//  * DEEP_DIVE_PAGES are segmented by respondent cohort (typology + tenure).
// =============================================================================

import type {
  DeliveryModel,
  RespondentTypology,
  SurveyResponse,
} from "@/data/types";

// Impact question codes (match v_survey_flat columns + survey_questions.code).
export type ImpactColumn =
  | "fs_public_space"
  | "fs_grievance"
  | "fs_wellbeing_aware"
  | "ol_cost_manageable"
  | "ol_energy_know"
  | "ol_active_travel"
  | "ol_security"
  | "ol_public_realm"
  | "ol_grievance"
  | "ol_wellbeing_aware";

export interface ImpactTheme {
  column: ImpactColumn;
  code: string; // short tag shown next to the header
  // Broad thematic category shown as the column header — NOT the literal question.
  header: string;
}

// ---- Impact question themes (headers abstracted from literal question text) ---
export const IMPACT_THEMES: ImpactTheme[] = [
  { column: "fs_public_space", code: "F-Q4", header: "Environmental Quality" },
  { column: "fs_grievance", code: "F-Q5", header: "Grievance & Communication" },
  { column: "fs_wellbeing_aware", code: "F-Q6", header: "Wellbeing Awareness" },
  { column: "ol_cost_manageable", code: "O-Q3", header: "Cost Manageability" },
  { column: "ol_energy_know", code: "O-Q4", header: "Energy Settings Awareness" },
  { column: "ol_active_travel", code: "O-Q5", header: "Recycling & Active Travel" },
  { column: "ol_security", code: "O-Q6", header: "Off-Peak Security" },
  { column: "ol_public_realm", code: "O-Q7", header: "Public Realm Contribution" },
  { column: "ol_grievance", code: "O-Q8", header: "Management Responsiveness" },
  { column: "ol_wellbeing_aware", code: "O-Q9", header: "Community & Wellbeing" },
];

export const ALL_IMPACT_COLUMNS: ImpactColumn[] = IMPACT_THEMES.map(
  (t) => t.column
);

export const impactHeader = (t: ImpactTheme) => `${t.header} (${t.code})`;

// ---- Pages 2-4: typology deep-dive screens ----------------------------------
// Each screen filters to one respondent cohort and shows that channel's columns.
export interface DeepDivePage {
  slug: string;
  title: string;
  description: string;
  typology: RespondentTypology;
  delivery?: DeliveryModel; // narrows completed-building residents
  columns: ImpactColumn[];
}

const FIELD_COLUMNS: ImpactColumn[] = [
  "fs_public_space",
  "fs_grievance",
  "fs_wellbeing_aware",
];
const ONLINE_COLUMNS: ImpactColumn[] = [
  "ol_cost_manageable",
  "ol_energy_know",
  "ol_active_travel",
  "ol_security",
  "ol_public_realm",
  "ol_grievance",
  "ol_wellbeing_aware",
];

export const DEEP_DIVE_PAGES: DeepDivePage[] = [
  {
    slug: "construction",
    title: "Construction-Adjacent",
    description: "Field intercepts adjacent to active construction sites.",
    typology: "construction_adjacent",
    columns: FIELD_COLUMNS,
  },
  {
    slug: "build-to-rent",
    title: "Completed · Build to Rent",
    description: "Online/QR responses from completed Build-to-Rent buildings.",
    typology: "resident_completed",
    delivery: "build_to_rent",
    columns: ONLINE_COLUMNS,
  },
  {
    slug: "build-to-sell",
    title: "Completed · Build to Sell",
    description: "Online/QR responses from completed private-sale buildings.",
    typology: "resident_completed",
    delivery: "build_to_sell",
    columns: ONLINE_COLUMNS,
  },
];

// Predicate: does a response belong to this deep-dive cohort?
export const matchesCohort = (r: SurveyResponse, page: DeepDivePage): boolean =>
  r.respondent_typology === page.typology &&
  (page.delivery === undefined || r.delivery_model === page.delivery);

// ---- Page 1 visualization per KPI slot --------------------------------------
export type KpiViz = "gauge" | "ring" | "zonebar" | "columns" | "area" | "bartarget";

export const KPI_VIZ: Record<number, KpiViz> = {
  1: "gauge",
  2: "ring",
  3: "zonebar",
  4: "gauge",
  5: "ring",
  6: "bartarget",
};

// ---- Contextual filters (envelope dimensions) -------------------------------
export interface FilterDef {
  key: "q1_demographic" | "q2_asset_class" | "q3_tenure";
  code: string;
  label: string;
  options: string[];
}

export const FILTER_DEFS: FilterDef[] = [
  {
    key: "q1_demographic",
    code: "Age",
    label: "Age Bracket",
    options: ["18-24", "25-34", "35-49", "50-64", "65+"],
  },
  {
    key: "q2_asset_class",
    code: "State",
    label: "Asset State",
    options: ["In-Construction", "Completed"],
  },
  {
    key: "q3_tenure",
    code: "Tenure",
    label: "Tenure",
    options: ["BTR", "Private Sale", "Private Ownership"],
  },
];

// ---- Qualitative open text --------------------------------------------------
export const QUALITATIVE = {
  column: "q10_text" as const,
  code: "Q10",
  label: "Open Feedback",
  maxLength: 280, // hard cap, per brief
};

// Helper: read an impact column (null when the channel didn't ask it).
export const impactValue = (r: SurveyResponse, col: ImpactColumn): number =>
  Number(r[col] ?? 0);
