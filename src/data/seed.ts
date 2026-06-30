// Built-in seed dataset — mirrors supabase/migrations/0004_seed.sql so the
// dashboard is fully demoable with zero backend. Deterministic (seeded PRNG) so
// the demo looks identical on every reload.

import type {
  MetricDefinition,
  SurveyResponse,
  Sentiment,
  Tenant,
} from "./types";
import { FILTER_DEFS } from "@/config/defensiveDesign";

export const SEED_TENANTS: Tenant[] = [
  {
    id: "northgate",
    name: "Northgate Holdings",
    branding: { brand: "37 99 235", logoText: "Northgate" },
  },
  {
    id: "meridian",
    name: "Meridian Group",
    branding: { brand: "13 148 136", logoText: "Meridian" },
  },
];

const metricRows = (tenant_id: string): MetricDefinition[] =>
  [
    ["Overall Compliance Index", "q4_score", "avg", "pts", 75, 50],
    ["Spatial Transit Sentiment", "q5_score", "avg", "pts", 70, 45],
    ["Service Responsiveness", "q6_score", "avg", "pts", 72, 48],
    ["Positive Sentiment Rate", "q10", "pct_positive", "%", 60, 40],
    ["Total Responses", "id", "count", "", 1, 1],
    ["Wellbeing Score", "q9_score", "avg", "pts", 68, 45],
  ].map((r, i) => ({
    id: `${tenant_id}-m${i + 1}`,
    tenant_id,
    slot_index: i + 1,
    metric_title: r[0] as string,
    source_column: r[1] as MetricDefinition["source_column"],
    aggregation: r[2] as MetricDefinition["aggregation"],
    unit: r[3] as string,
    green_at: r[4] as number,
    amber_at: r[5] as number,
    is_active: true,
  }));

export const SEED_METRICS: MetricDefinition[] = [
  ...metricRows("northgate"),
  ...metricRows("meridian"),
];

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
    "Really happy with how responsive the team has been lately.",
    "Transit access has improved a lot this quarter.",
    "Great communication and the facilities feel well maintained.",
  ],
  neutral: [
    "Things are fine, nothing major to report this period.",
    "No strong feelings either way, broadly as expected.",
    "Average experience overall, some ups and some downs.",
  ],
  negative: [
    "Maintenance requests are taking far too long to resolve.",
    "Noise and access issues have gotten worse recently.",
    "Communication has been poor and unclear this month.",
  ],
};

const opt = (key: "q1_demographic" | "q2_asset_class" | "q3_tenure") =>
  FILTER_DEFS.find((f) => f.key === key)!.options;

function buildResponses(): SurveyResponse[] {
  const rows: SurveyResponse[] = [];
  const now = Date.now();
  SEED_TENANTS.forEach((tenant, ti) => {
    const rand = mulberry32(1000 + ti * 99);
    for (let i = 0; i < 160; i++) {
      const base = 45 + rand() * 45;
      let sscore = (base - 60) / 30 + (rand() - 0.5) * 0.4;
      sscore = Math.max(-1, Math.min(1, sscore));
      const sentiment: Sentiment =
        sscore > 0.2 ? "positive" : sscore < -0.15 ? "negative" : "neutral";
      const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
      const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

      rows.push({
        id: `${tenant.id}-r${i}`,
        tenant_id: tenant.id,
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
        q10_text: pick(BLURBS[sentiment]),
        q10_sentiment: sentiment,
        q10_sentiment_score: Math.round(sscore * 100) / 100,
      });
    }
  });
  return rows;
}

export const SEED_RESPONSES: SurveyResponse[] = buildResponses();
