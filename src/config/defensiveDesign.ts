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

// A verbatim categorical column rendered in the capture table (proximity,
// offering chips, cohort identifiers, text follow-ups).
export interface RawColumn {
  code: string; // survey_questions.code (matched case-insensitively against raws)
  header: string; // includes the channel-prefixed reference, e.g. "(F-Q3)"
  normalized?: boolean; // render the 0-100 mapped score instead of the raw value
  wide?: boolean; // long text/label — wrap instead of a single nowrap cell
  place?: "before" | "after"; // sits before (default) or after the impact themes
}

// The "What people want" slot — a reusable aggregation of a respondent's chosen
// interventions / desired changes. Bound to question CODES, so the underlying
// prompt can change without touching the component (client's explicit ask:
// "the question may change, but we'll always use this slot").
export interface WantSlot {
  title: string;
  note: string; // sub-label naming the source question(s)
  codes: string[]; // one or more offering/intervention question codes to tally
  topN?: number;
}

export interface DeepDivePage {
  slug: string;
  title: string;
  description: string;
  channel: "field" | "online"; // drives the F-/O- question-reference prefix
  typology: RespondentTypology;
  delivery?: DeliveryModel; // narrows completed-building residents
  columns: ImpactColumn[];
  rawColumns?: RawColumn[]; // verbatim categorical captures
  showTenure?: boolean; // field intercepts have no tenure — hide the column
  wantSlot?: WantSlot; // "this is what people want" aggregation panel
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

// Verbatim online captures shown after the impact themes on the BTR/BTS pages:
// the cost follow-up text (O-Q3B) and the top-two desired interventions.
const ONLINE_RAW_COLUMNS: RawColumn[] = [
  { code: "OL_COST_FOLLOWUP", header: "Cost Follow-up (O-Q3B)", wide: true, place: "after" },
  { code: "OL_OFFERING_1", header: "Top Choice 1 (O-Q10A)", wide: true, place: "after" },
  { code: "OL_OFFERING_2", header: "Top Choice 2 (O-Q10B)", wide: true, place: "after" },
];

export const DEEP_DIVE_PAGES: DeepDivePage[] = [
  {
    slug: "construction",
    title: "Construction Sites",
    description: "Field intercepts adjacent to active construction sites.",
    channel: "field",
    typology: "construction_adjacent",
    columns: FIELD_COLUMNS,
    showTenure: false, // field intercepts carry no tenure
    rawColumns: [
      // F-Q2 shows the 0-100 mapped accessibility score; F-Q3 the verbatim
      // proximity code. F-Q6B sits AFTER the impact themes, next to F-Q6.
      { code: "FS_ACCESS_COHORT", header: "Accessibility & Mobility Cohort (F-Q2)", normalized: true, place: "before" },
      { code: "FS_PROXIMITY", header: "Local Proximity (F-Q3)", place: "before" },
      { code: "FS_OFFERING", header: "Desired Offering (F-Q6B)", wide: true, place: "after" },
    ],
    wantSlot: {
      title: "What people want",
      note: "Desired on-site interventions — Field Q6B",
      codes: ["FS_OFFERING"],
    },
  },
  {
    slug: "build-to-rent",
    title: "Completed · Build to Rent",
    description: "Online/QR responses from completed Build-to-Rent buildings.",
    channel: "online",
    typology: "resident_completed",
    delivery: "build_to_rent",
    columns: ONLINE_COLUMNS,
    rawColumns: ONLINE_RAW_COLUMNS,
    wantSlot: {
      title: "What people want",
      note: "Top two desired interventions — Online Q10A / Q10B",
      codes: ["OL_OFFERING_1", "OL_OFFERING_2"],
    },
  },
  {
    slug: "build-to-sell",
    title: "Completed · Build to Sell",
    description: "Online/QR responses from completed Build-to-Sell buildings.",
    channel: "online",
    typology: "resident_completed",
    delivery: "build_to_sell",
    columns: ONLINE_COLUMNS,
    rawColumns: ONLINE_RAW_COLUMNS,
    wantSlot: {
      title: "What people want",
      note: "Top two desired interventions — Online Q10A / Q10B",
      codes: ["OL_OFFERING_1", "OL_OFFERING_2"],
    },
  },
];

// Best-effort human labels for the field Q6-B chip codes (inferred from the
// capture codes — adjust if the client confirms a different legend). Full-text
// online offering values are already readable and pass through unchanged.
const OFFERING_LABELS: Record<string, string> = {
  HEALTH_Fit: "Health & Fitness Facilities",
  Green_Pock: "Green Pocket Parks",
  STREET_Safe: "Street Safety Improvements",
  YPPL_Activity: "Young People's Activities",
  MWL_Events: "Community / Meanwhile Events",
  NEG_Need: "No Particular Need",
};

// Prettify a captured categorical value for display (verbatim-safe: unknown
// codes just get underscores turned into spaces).
export const prettyOffering = (raw: string): string =>
  OFFERING_LABELS[raw] ?? raw.replace(/_/g, " ");

// Read a verbatim categorical capture by question code (null when unanswered).
export const rawValue = (r: SurveyResponse, code: string): string | null =>
  r.raws?.[code.toLowerCase()] ?? null;

// Tally the chosen interventions across a cohort for a WantSlot: returns
// [{ label, count }] sorted desc. Any of the slot's codes contributes a vote.
export function tallyWants(
  rows: SurveyResponse[],
  slot: WantSlot
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const code of slot.codes) {
      const raw = rawValue(r, code);
      if (!raw) continue;
      const label = prettyOffering(raw);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, slot.topN ?? 6);
}

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

// Multi-stream text intake: every qualitative text question feeding the
// Qualitative Feedback ledger. Adding a stream = adding a row here (the data
// layer picks up any value_raw_type='text' answer automatically).
export interface TextStream {
  code: string; // survey_questions.code
  label: string; // shown in the ledger + Question Filter
}

export const TEXT_STREAMS: TextStream[] = [
  { code: "FS_OPEN", label: "Field Q7 · Street-level remedies" },
  { code: "OL_COST_FOLLOWUP", label: "Online Q3B · Cost & affordability" },
  { code: "OL_OPEN", label: "Online Q10 · Estate improvements" },
];

export const textStreamLabel = (code: string) =>
  TEXT_STREAMS.find((s) => s.code === code)?.label ?? code;

// Helper: read an impact column (null when the channel didn't ask it).
export const impactValue = (r: SurveyResponse, col: ImpactColumn): number =>
  Number(r[col] ?? 0);
