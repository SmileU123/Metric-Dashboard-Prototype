// Built-in seed dataset — mirrors supabase/migrations/0004_seed.sql so the
// dashboard is fully demoable with zero backend. Deterministic (seeded PRNG) so
// the demo looks identical on every reload.

import type {
  DeliveryModel,
  KpiConfig,
  Project,
  RespondentTypology,
  Sentiment,
  SurveyResponse,
  Tenant,
} from "./types";
import { FILTER_DEFS } from "@/config/defensiveDesign";

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

// source_key, weight, transformation, keyed by kpi code
const KPI_SRC: Record<string, Array<[string, number, KpiConfig["sources"][number]["transformation"]]>> = {
  LOCAL_ENV_QUALITY: [["q4_score", 0.6, "passthrough"], ["q9_score", 0.4, "passthrough"]],
  PR_SAFETY_ACCESS: [["q5_score", 0.7, "passthrough"], ["q8_score", 0.3, "passthrough"]],
  SUS_MOBILITY: [["q6_score", 1.0, "passthrough"]],
  SUSTAINABILITY: [["q7_score", 0.7, "passthrough"], ["q4_score", 0.3, "passthrough"]],
  COMMUNITY_WELLBEING: [["q8_score", 0.5, "passthrough"], ["q9_score", 0.5, "passthrough"]],
  HOUSING_AFFORDABILITY: [["housing_cost_to_income", 1.0, "invert_cost_to_income"]],
};

const KPI_FORMULA: Record<string, [KpiConfig["formulas"][number]["formula_type"], string]> = {
  LOCAL_ENV_QUALITY: ["weighted_average", "Q4*0.6 + Q9*0.4"],
  PR_SAFETY_ACCESS: ["weighted_average", "Q5*0.7 + Q8*0.3"],
  SUS_MOBILITY: ["direct", "Q6"],
  SUSTAINABILITY: ["weighted_average", "Q7*0.7 + Q4*0.3"],
  COMMUNITY_WELLBEING: ["weighted_average", "Q8*0.5 + Q9*0.5"],
  HOUSING_AFFORDABILITY: ["index", "100 - normalize(cost_to_income)"],
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

const opt = (key: "q1_demographic" | "q2_asset_class" | "q3_tenure") =>
  FILTER_DEFS.find((f) => f.key === key)!.options;

function buildResponses(): SurveyResponse[] {
  const rows: SurveyResponse[] = [];
  const now = Date.now();
  SEED_TENANTS.forEach((tenant, ti) => {
    const rand = mulberry32(1000 + ti * 99);
    const projects = SEED_PROJECTS.filter((p) => p.tenant_id === tenant.id);
    for (let i = 0; i < 160; i++) {
      const base = 45 + rand() * 45;
      let sscore = (base - 60) / 30 + (rand() - 0.5) * 0.4;
      sscore = Math.max(-1, Math.min(1, sscore));
      const sentiment: Sentiment =
        sscore > 0.2 ? "positive" : sscore < -0.15 ? "negative" : "neutral";
      const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
      const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

      const isConstruction = rand() < 0.4;
      const typology: RespondentTypology = isConstruction
        ? "construction_adjacent"
        : "resident_completed";
      const delivery: DeliveryModel | null = isConstruction
        ? null
        : rand() < 0.5
          ? "build_to_rent"
          : "build_to_sell";

      rows.push({
        id: `${tenant.id}-r${i}`,
        tenant_id: tenant.id,
        project_id: pick(projects).id,
        respondent_typology: typology,
        delivery_model: delivery,
        source: rand() < 0.65 ? "field_pwa" : "digital_public",
        submitted_at: new Date(now - rand() * 180 * 864e5).toISOString(),
        q1_demographic: pick(opt("q1_demographic")),
        q2_asset_class: pick(opt("q2_asset_class")),
        q3_tenure: pick(opt("q3_tenure")),
        q4_score: clamp(base + (rand() - 0.5) * 20),
        q5_score: clamp(base + (rand() - 0.5) * 24),
        q6_score: clamp(base + (rand() - 0.5) * 22),
        q7_score: clamp(base + (rand() - 0.5) * 26),
        q8_score: clamp(base + (rand() - 0.5) * 20),
        q9_score: clamp(base + (rand() - 0.5) * 18),
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
