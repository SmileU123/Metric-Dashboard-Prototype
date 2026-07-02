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
import type { RawResponse } from "./types";

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

// Six STANDARDIZED (global) KPIs — the KPI engine config (mirrors 0005_kpi_engine.sql).
// tuple: [code, name, description, category, calculation_type, is_composite, unit]
const KPI_DEFS: Array<
  [string, string, string, string, KpiConfig["definitions"][number]["calculation_type"], boolean, string]
> = [
  ["LOCAL_ENV_QUALITY", "Local Health & Environmental Quality", "Composite of environmental/health quality and wellbeing signal.", "environmental", "weighted_average", true, "pts"],
  ["PR_SAFETY_ACCESS", "Public Realm Safety & Accessibility", "Perception of safety, lighting, inclusivity and access of open spaces.", "public_realm", "weighted_average", true, "pts"],
  ["SUS_MOBILITY", "Sustainable Mobility Integration", "Satisfaction with low-carbon transit, cycle storage and access.", "mobility", "direct", false, "pts"],
  ["SUSTAINABILITY", "Sustainability Performance", "Composite sustainability and environmental-quality signal.", "sustainability", "weighted_average", true, "pts"],
  ["COMMUNITY_WELLBEING", "Community Wellbeing & Belonging", "Belonging, community and overall wellbeing themes.", "community", "weighted_average", true, "pts"],
  ["HOUSING_AFFORDABILITY", "Housing Affordability", "Cost-to-income ratio inverted to a 0–100 affordability score (higher = more affordable).", "housing", "direct", false, "pts"],
];

// source_key (question code) → weight, transformation. Re-tagged to the DRAFT
// question architecture. Scale answers are pre-normalized to 0-100 by the flat
// view, so transformation is passthrough (except the cost-to-income placeholder).
const KPI_SRC: Record<string, Array<[string, number, KpiConfig["sources"][number]["transformation"]]>> = {
  LOCAL_ENV_QUALITY: [["ol_green_infra", 0.6, "passthrough"], ["ol_wellbeing_aware", 0.4, "passthrough"]],
  PR_SAFETY_ACCESS: [["ol_public_realm", 0.4, "passthrough"], ["ol_security", 0.35, "passthrough"], ["fs_public_space", 0.25, "passthrough"]],
  SUS_MOBILITY: [["ol_active_travel", 1.0, "passthrough"]],
  SUSTAINABILITY: [["ol_green_infra", 0.7, "passthrough"], ["ol_public_realm", 0.3, "passthrough"]],
  COMMUNITY_WELLBEING: [["ol_wellbeing_aware", 0.5, "passthrough"], ["ol_grievance", 0.5, "passthrough"]],
  HOUSING_AFFORDABILITY: [["housing_cost_to_income", 1.0, "invert_cost_to_income"]],
};

const KPI_FORMULA: Record<string, [KpiConfig["formulas"][number]["formula_type"], string]> = {
  LOCAL_ENV_QUALITY: ["weighted_average", "OL_GREEN*0.6 + OL_WELLBEING*0.4"],
  PR_SAFETY_ACCESS: ["weighted_average", "OL_PUBLIC*0.4 + OL_SECURITY*0.35 + FS_PUBLIC*0.25"],
  SUS_MOBILITY: ["direct", "OL_ACTIVE_TRAVEL"],
  SUSTAINABILITY: ["weighted_average", "OL_GREEN*0.7 + OL_PUBLIC*0.3"],
  COMMUNITY_WELLBEING: ["weighted_average", "OL_WELLBEING*0.5 + OL_GRIEVANCE*0.5"],
  HOUSING_AFFORDABILITY: ["index", "100 - normalize(cost_to_income)  [placeholder — external in prod]"],
};

const KPI_THRESH: Record<string, [number, number]> = {
  LOCAL_ENV_QUALITY: [75, 50],
  PR_SAFETY_ACCESS: [70, 45],
  SUS_MOBILITY: [70, 45],
  SUSTAINABILITY: [72, 48],
  COMMUNITY_WELLBEING: [68, 45],
  HOUSING_AFFORDABILITY: [65, 45],
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
        // impact questions by code — only the channel's questions are answered
        fs_public_space: isField ? S(24) : null,
        fs_grievance: isField ? S(28) : null,
        ol_green_infra: isField ? null : S(22),
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

// Raw view (seed mode): derive raw Likert 1-5 back from the normalized columns
// so the Raw Data page works without a backend. Live mode reads the true
// stored value_raw from survey_answers.
const rawScale = (norm: number) => Math.round(norm / 25) + 1; // 0→1 … 100→5

export const SEED_RAW_RESPONSES: RawResponse[] = SEED_RESPONSES.map((r) => ({
  id: r.id,
  tenant_id: r.tenant_id,
  channel: r.channel,
  temporal_cohort: r.temporal_cohort,
  q1_demographic: r.q1_demographic,
  q3_tenure: r.q3_tenure,
  q10_text: r.q10_text,
  q10_sentiment: r.q10_sentiment,
  submitted_at: r.submitted_at,
  answers: ALL_IMPACT_COLUMNS.filter((c) => r[c] != null).map((c) => {
    const norm = Number(r[c]);
    const scale = rawScale(norm);
    return {
      question_code: c.toUpperCase(),
      value_raw: String(scale),
      value_raw_type: "numeric",
      value_numeric: scale,
      value_normalized: norm,
    };
  }),
}));
