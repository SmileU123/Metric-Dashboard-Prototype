// Built-in seed dataset — mirrors supabase/migrations/0004_seed.sql so the
// dashboard is fully demoable with zero backend. Deterministic (seeded PRNG) so
// the demo looks identical on every reload.

import type {
  DeliveryModel,
  KpiConfig,
  Project,
  Sentiment,
  SurveyResponse,
  Tenant,
} from "./types";
import { FILTER_DEFS, ALL_IMPACT_COLUMNS } from "@/config/defensiveDesign";
import type { RawAnswer, RawResponse, SurveyQuestion } from "./types";

export const SEED_TENANTS: Tenant[] = [
  {
    id: "northgate",
    name: "Northgate Developments",
    branding: { brand: "37 99 235", logoText: "Northgate" },
  },
  {
    id: "meridian",
    name: "Meridian Urban",
    branding: { brand: "13 148 136", logoText: "Meridian" },
  },
];

export const SEED_PROJECTS: Project[] = [
  {
    id: "northgate-p1",
    tenant_id: "northgate",
    name: "Canalside Quarter",
    status: "in_report",
    completion_date: "2026-05-01",
    retention_expires_at: "2026-11-01",
  },
  {
    id: "northgate-p2",
    tenant_id: "northgate",
    name: "Elm Street Regen",
    status: "active",
    completion_date: null,
    retention_expires_at: null,
  },
  {
    id: "meridian-p1",
    tenant_id: "meridian",
    name: "Harbour View Phase 1",
    status: "completed",
    completion_date: "2026-03-15",
    retention_expires_at: "2026-09-15",
  },
  {
    id: "meridian-p2",
    tenant_id: "meridian",
    name: "Parkgate Mews",
    status: "active",
    completion_date: null,
    retention_expires_at: null,
  },
];

// Six STANDARDIZED (global) KPIs — the client's REVISED set (mirrors 0005).
// tuple: [code, name, description, category, calculation_type, is_composite, unit]
const KPI_DEFS: Array<
  [string, string, string, string, KpiConfig["definitions"][number]["calculation_type"], boolean, string]
> = [
  ["ENV_QUALITY", "Environmental Quality", "Dust, noise, air and mobility impact of the site, and mitigation efforts (plants, murals, etc.).", "environmental", "direct", false, "pts"],
  ["PR_SAFETY_ACCESS", "Public Realm Safety & Accessibility", "Perception of safety, security and quality of the shared public realm.", "public_realm", "weighted_average", true, "pts"],
  ["CIRC_MOBILITY", "Circularity & Mobility Integration", "Intuitiveness and uptake of recycling and active-travel infrastructure.", "mobility", "direct", false, "pts"],
  ["SUSTAINABILITY", "Sustainability Performance", "Understanding of how to use the development's sustainability features (50/50 by tenure).", "sustainability", "direct_tenure_split", false, "pts"],
  ["COMMUNITY_WELLBEING", "Community Wellbeing & Belonging", "Awareness of community events, green space and wellness initiatives (field + online).", "community", "weighted_average", true, "pts"],
  ["HOUSING_AFFORDABILITY", "Operational Housing Affordability", "Agreement that living costs in the development are manageable and sustainable (50/50 by tenure).", "housing", "direct_tenure_split", false, "pts"],
];

// source_key (question code) → weight, transformation. Scored categoricals
// (energy Yes/No, field wellbeing awareness) are normalized at ingest, so all
// sources are passthrough here.
const KPI_SRC: Record<string, Array<[string, number, KpiConfig["sources"][number]["transformation"]]>> = {
  ENV_QUALITY: [["fs_public_space", 1.0, "passthrough"]],
  PR_SAFETY_ACCESS: [["ol_public_realm", 0.4, "passthrough"], ["ol_security", 0.35, "passthrough"], ["fs_public_space", 0.25, "passthrough"]],
  CIRC_MOBILITY: [["ol_active_travel", 1.0, "passthrough"]],
  SUSTAINABILITY: [["ol_energy_know", 1.0, "passthrough"]],
  COMMUNITY_WELLBEING: [["fs_wellbeing_aware", 0.5, "passthrough"], ["ol_wellbeing_aware", 0.5, "passthrough"]],
  HOUSING_AFFORDABILITY: [["ol_cost_manageable", 1.0, "passthrough"]],
};

const KPI_FORMULA: Record<string, [KpiConfig["formulas"][number]["formula_type"], string]> = {
  ENV_QUALITY: ["direct", "FS_Q4 (environmental quality / physical impact)"],
  PR_SAFETY_ACCESS: ["weighted_average", "OL_PUBLIC*0.4 + OL_SECURITY*0.35 + FS_PUBLIC*0.25"],
  CIRC_MOBILITY: ["direct", "OL_ACTIVE_TRAVEL"],
  SUSTAINABILITY: ["direct", "OL_ENERGY_KNOW (Yes=100/No=0), 50/50 by tenure"],
  COMMUNITY_WELLBEING: ["weighted_average", "FS_WELLBEING*0.5 + OL_WELLBEING*0.5"],
  HOUSING_AFFORDABILITY: ["direct", "OL_COST_MANAGEABLE (agreement 1-5), 50/50 by tenure"],
};

const KPI_THRESH: Record<string, [number, number]> = {
  ENV_QUALITY: [75, 40],
  PR_SAFETY_ACCESS: [70, 40],
  CIRC_MOBILITY: [70, 40],
  SUSTAINABILITY: [70, 40],
  COMMUNITY_WELLBEING: [65, 40],
  HOUSING_AFFORDABILITY: [65, 40],
};

export const SEED_KPI_CONFIG: KpiConfig = {
  definitions: KPI_DEFS.map(([code, name, desc, cat, calc, composite, unit], i) => ({
    id: `kpi-${code}`,
    tenant_id: null,
    project_id: null,
    kpi_code: code,
    kpi_name: name,
    description: desc,
    category: cat,
    unit,
    unit_type: "points" as const,
    display_format: "fixed_1dp" as const,
    calculation_type: calc,
    is_composite: composite,
    is_active: true,
    display_order: i + 1,
  })),
  sources: KPI_DEFS.flatMap(([code]) =>
    KPI_SRC[code].map(([key, weight, tr], j) => ({
      id: `src-${code}-${j}`,
      kpi_id: `kpi-${code}`,
      source_type: "survey" as const,
      source_key: key,
      weight,
      transformation: tr,
      is_active: true,
    }))
  ),
  formulas: KPI_DEFS.map(([code]) => ({
    id: `frm-${code}`,
    kpi_id: `kpi-${code}`,
    formula_type: KPI_FORMULA[code][0],
    expression: KPI_FORMULA[code][1],
    normalization_min: 0,
    normalization_max: 100,
  })),
  thresholds: KPI_DEFS.map(([code]) => ({
    id: `thr-${code}`,
    kpi_id: `kpi-${code}`,
    condition_type: "score_range" as const,
    green_min: KPI_THRESH[code][0],
    amber_min: KPI_THRESH[code][1],
    red_min: 0,
    is_global: true,
  })),
};

// --- deterministic PRNG (mulberry32) -----------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BLURBS: Record<Sentiment, string[]> = {
  positive: [
    "Really happy with how responsive the on-site team has been lately.",
    "Transit access and cycle storage have improved a lot this quarter.",
    "Great communication and the public spaces feel safe and well kept.",
  ],
  neutral: [
    "Things are fine, nothing major to report this period.",
    "No strong feelings either way, broadly as expected.",
    "Average experience overall, some ups and some downs.",
  ],
  negative: [
    "Construction noise and dust have gotten worse recently.",
    "Lighting around the open spaces feels poor after dark.",
    "Communication about works has been unclear this month.",
    "Service charges doubled with zero breakdown of what we pay for.",
    "Car parking rent went up out of nowhere; costs feel unsustainable.",
  ],
};

const AGE_BRACKETS = FILTER_DEFS.find((f) => f.key === "q1_demographic")!.options;

function buildResponses(): SurveyResponse[] {
  const rows: SurveyResponse[] = [];
  const now = Date.now();
  SEED_TENANTS.forEach((tenant, ti) => {
    const rand = mulberry32(1000 + ti * 99);
    const projects = SEED_PROJECTS.filter((p) => p.tenant_id === tenant.id);
    for (let i = 0; i < 175; i++) {
      const base = 45 + rand() * 45;
      let sscore = (base - 60) / 30 + (rand() - 0.5) * 0.4;
      sscore = Math.max(-1, Math.min(1, sscore));
      const sentiment: Sentiment =
        sscore > 0.2 ? "positive" : sscore < -0.15 ? "negative" : "neutral";
      const S = (spread: number) =>
        Math.max(0, Math.min(100, Math.round(base + (rand() - 0.5) * spread)));
      const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

      const isField = rand() < 0.4;
      const submitted = new Date(now - rand() * 450 * 864e5); // ~5 quarters
      const year = submitted.getFullYear();
      const quarter = Math.floor(submitted.getMonth() / 3) + 1;

      // tenure only for completed/online residents
      const tenure = isField ? null : rand() < 0.55 ? "btr" : "private_sale";
      const delivery: DeliveryModel | null = isField
        ? null
        : tenure === "btr"
          ? "build_to_rent"
          : "build_to_sell";

      rows.push({
        id: `${tenant.id}-r${i}`,
        tenant_id: tenant.id,
        project_id: pick(projects).id,
        channel: isField ? "field" : "online",
        source: isField ? "field_pwa" : "digital_public",
        asset_class_state: isField ? "in_construction" : "completed",
        tenure,
        respondent_typology: isField ? "construction_adjacent" : "resident_completed",
        delivery_model: delivery,
        temporal_cohort: `Q${quarter}-${year}`,
        period_year: year,
        period_quarter: quarter,
        submitted_at: submitted.toISOString(),
        q1_demographic: pick(AGE_BRACKETS),
        q2_asset_class: isField ? "In-Construction" : "Completed",
        q3_tenure: isField ? "—" : tenure === "btr" ? "BTR" : "Private Sale",
        // impact questions by code — only the channel's questions are answered.
        // Scored categoricals take their discrete normalized values (100/50/0).
        fs_public_space: isField ? S(24) : null,
        fs_grievance: isField ? S(28) : null,
        fs_wellbeing_aware: isField ? [100, 50, 0][Math.floor(rand() * 3)] : null,
        ol_cost_manageable: isField ? null : Math.round(S(30) / 25) * 25,
        ol_energy_know: isField ? null : (rand() < base / 90 ? 100 : 0),
        ol_active_travel: isField ? null : S(24),
        ol_security: isField ? null : S(26),
        ol_public_realm: isField ? null : S(20),
        ol_grievance: isField ? null : S(28),
        ol_wellbeing_aware: isField ? null : S(20),
        housing_cost_to_income:
          Math.round((52 - (base - 45) * 0.25 + (rand() - 0.5) * 8) * 10) / 10,
        q10_text: pick(BLURBS[sentiment]),
        q10_sentiment: sentiment,
        q10_sentiment_score: Math.round(sscore * 100) / 100,
      });
    }
  });
  return rows;
}

export const SEED_RESPONSES: SurveyResponse[] = buildResponses();

// Question catalog (mirrors 0004 seed) — drives the Raw Data page columns.
export const SEED_QUESTIONS: SurveyQuestion[] = [
  { code: "FS_AGE", channel: "field", seq: 1, short_label: "Age", response_type: "numeric" },
  { code: "FS_ACCESS_COHORT", channel: "field", seq: 2, short_label: "Accessibility & Mobility Cohort", response_type: "single_choice" },
  { code: "FS_PROXIMITY", channel: "field", seq: 3, short_label: "Local Proximity", response_type: "single_choice" },
  { code: "FS_PUBLIC_SPACE", channel: "field", seq: 4, short_label: "Public Space Sentiment", response_type: "scale_1_5" },
  { code: "FS_GRIEVANCE", channel: "field", seq: 5, short_label: "Grievance & Communication", response_type: "scale_1_5" },
  { code: "FS_WELLBEING_AWARE", channel: "field", seq: 6, short_label: "Wellbeing/Offerings Awareness", response_type: "single_choice" },
  { code: "FS_OFFERING", channel: "field", seq: 7, short_label: "Desired Offering (Q6-B)", response_type: "single_choice" },
  { code: "FS_OPEN", channel: "field", seq: 8, short_label: "Constructive Suggestion", response_type: "open_text" },
  { code: "OL_OCCUPANCY", channel: "online", seq: 0, short_label: "Occupancy Status (Q2)", response_type: "single_choice" },
  { code: "OL_COST_MANAGEABLE", channel: "online", seq: 1, short_label: "Cost Manageability (Q3)", response_type: "scale_1_5" },
  { code: "OL_ENERGY_KNOW", channel: "online", seq: 2, short_label: "Knows Energy Settings (Q4)", response_type: "yes_no" },
  { code: "OL_ACTIVE_TRAVEL", channel: "online", seq: 3, short_label: "Recycling & Active Travel", response_type: "scale_1_5" },
  { code: "OL_SECURITY", channel: "online", seq: 4, short_label: "Off-Peak Security", response_type: "scale_1_5" },
  { code: "OL_PUBLIC_REALM", channel: "online", seq: 5, short_label: "Public Realm Contribution", response_type: "scale_1_5" },
  { code: "OL_GRIEVANCE", channel: "online", seq: 6, short_label: "Management Responsiveness", response_type: "scale_1_5" },
  { code: "OL_WELLBEING_AWARE", channel: "online", seq: 7, short_label: "Community & Wellbeing", response_type: "scale_1_5" },
  { code: "OL_OFFERING_1", channel: "online", seq: 8, short_label: "Top Offering 1", response_type: "multi_choice" },
  { code: "OL_OFFERING_2", channel: "online", seq: 9, short_label: "Top Offering 2", response_type: "multi_choice" },
  { code: "OL_OPEN", channel: "online", seq: 10, short_label: "Constructive Suggestion", response_type: "open_text" },
];

// Raw view (seed mode): derive raw Likert 1-5 from the normalized columns and
// synthesize the categorical answers so the Raw Data page works without a
// backend. Live mode reads the true stored value_raw from survey_answers.
const rawScale = (norm: number) => Math.round(norm / 25) + 1; // 0→1 … 100→5
const rrand = mulberry32(4242);
const rpick = <T>(a: T[]) => a[Math.floor(rrand() * a.length)];
const PROX = ["DCW", "LR", "Occ_Ten", "FTV_Passerby"];
const OFFER = [
  "Expanded Green Space / Shading",
  "Community Workshops & Social Events",
  "Secure Bicycle & EV Infrastructure",
  "Improved Lighting & Public Safety Measures",
  "Local Business/Independent Retail Pop-ups",
];

// Scored categoricals: derive the verbatim raw label back from the normalized value.
const WELL_BY_NORM: Record<number, string> = { 100: "Yes_POS", 50: "YES_NEG", 0: "NO_NEG" };

export const SEED_RAW_RESPONSES: RawResponse[] = SEED_RESPONSES.map((r) => {
  const scaleAnswers: RawAnswer[] = ALL_IMPACT_COLUMNS.filter((c) => r[c] != null).map((c) => {
    const norm = Number(r[c]);
    if (c === "ol_energy_know") {
      return { question_code: "OL_ENERGY_KNOW", value_raw: norm >= 50 ? "Yes" : "No", value_raw_type: "categorical", value_numeric: null, value_normalized: norm };
    }
    if (c === "fs_wellbeing_aware") {
      return { question_code: "FS_WELLBEING_AWARE", value_raw: WELL_BY_NORM[norm] ?? "NO_NEG", value_raw_type: "categorical", value_numeric: null, value_normalized: norm };
    }
    const scale = rawScale(norm);
    return { question_code: c.toUpperCase(), value_raw: String(scale), value_raw_type: "numeric", value_numeric: scale, value_normalized: norm };
  });
  const cat: RawAnswer[] = [];
  if (r.channel === "field") {
    const age = 18 + Math.floor(rrand() * 57);
    cat.push({ question_code: "FS_AGE", value_raw: String(age), value_raw_type: "numeric", value_numeric: age, value_normalized: null });
    cat.push({ question_code: "FS_ACCESS_COHORT", value_raw: String(Math.floor(rrand() * 4)), value_raw_type: "categorical", value_numeric: null, value_normalized: null });
    cat.push({ question_code: "FS_PROXIMITY", value_raw: rpick(PROX), value_raw_type: "categorical", value_numeric: null, value_normalized: null });
  } else {
    cat.push({ question_code: "OL_OFFERING_1", value_raw: rpick(OFFER), value_raw_type: "multi", value_numeric: null, value_normalized: null });
    cat.push({ question_code: "OL_OFFERING_2", value_raw: rpick(OFFER), value_raw_type: "multi", value_numeric: null, value_normalized: null });
  }
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    channel: r.channel,
    temporal_cohort: r.temporal_cohort,
    q1_demographic: r.q1_demographic,
    q3_tenure: r.q3_tenure,
    q10_text: r.q10_text,
    q10_sentiment: r.q10_sentiment,
    submitted_at: r.submitted_at,
    answers: [...scaleAnswers, ...cat],
  };
});
