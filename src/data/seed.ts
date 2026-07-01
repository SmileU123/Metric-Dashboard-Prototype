// Built-in seed dataset — mirrors supabase/migrations/0004_seed.sql so the
// dashboard is fully demoable with zero backend. Deterministic (seeded PRNG) so
// the demo looks identical on every reload.

import type {
  DeliveryModel,
  MetricDefinition,
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

// Six STANDARDIZED (global) KPI slots — one set shared by all tenants.
export const SEED_METRICS: MetricDefinition[] = (
  [
    ["Local Health & Environmental Quality", "q4_score", "avg", "pts", "higher_better", 75, 50],
    ["Public Realm Safety & Accessibility", "q5_score", "avg", "pts", "higher_better", 70, 45],
    ["Sustainable Mobility Integration", "q6_score", "avg", "pts", "higher_better", 70, 45],
    ["Sustainability Performance", "q7_score", "avg", "pts", "higher_better", 72, 48],
    ["Community Wellbeing & Belonging", "q8_score", "avg", "pts", "higher_better", 68, 45],
    ["Housing Cost-to-Income Ratio", "housing_cost_to_income", "avg", "%", "lower_better", 35, 45],
  ] as const
).map((r, i) => ({
  id: `global-m${i + 1}`,
  tenant_id: null,
  slot_index: i + 1,
  metric_title: r[0],
  source_column: r[1] as MetricDefinition["source_column"],
  aggregation: r[2] as MetricDefinition["aggregation"],
  unit: r[3],
  direction: r[4] as MetricDefinition["direction"],
  green_at: r[5],
  amber_at: r[6],
  is_active: true,
}));

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
