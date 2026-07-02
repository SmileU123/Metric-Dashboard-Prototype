// Thematic clustering for Page-4 open text. Curated themes (label + trigger
// terms) — an institutional "thematic tag" view rather than raw single words.
// Edit a theme's triggers here to re-scope what a cluster catches (config, not
// code). A response counts toward a theme if its open text contains any trigger.

import type { Sentiment, SurveyResponse } from "@/data/types";

export interface TextTheme {
  label: string;
  triggers: string[]; // lowercase substrings
}

export const TEXT_THEMES: TextTheme[] = [
  { label: "Construction Noise & Dust", triggers: ["noise", "drilling", "dust", "grime", "sweeping", "screen", "air quality"] },
  { label: "Scaffolding / Access", triggers: ["scaffolding", "access", "closure", "hoarding", "pavement"] },
  { label: "Cycle Infrastructure", triggers: ["cycle", "bike", "cycling"] },
  { label: "Deliveries & Logistics", triggers: ["delivery", "locker", "grocery", "parcel"] },
  { label: "Waste & Recycling", triggers: ["recycling", "waste", "bin", "overflow"] },
  { label: "Lighting & Security", triggers: ["lighting", "light", "dark", "unsafe", "security", "secure", "safe"] },
  { label: "Amenities & Community", triggers: ["workshop", "community", "event", "repair", "tool", "courtyard", "pop-up", "retail"] },
  { label: "Management & Communication", triggers: ["management", "communication", "grievance", "update", "notice", "schedule", "respond", "unclear"] },
  { label: "Jobs & Local Economy", triggers: ["job", "business", "employment"] },
  { label: "Green & Public Realm", triggers: ["green", "public realm", "public space", "open space", "courtyard", "walk"] },
];

export interface ThemeStat {
  label: string;
  count: number; // responses mentioning the theme
  sentiment: Sentiment; // dominant sentiment among them
  pct: number; // that sentiment's share, 0-100
}

// Match a trigger at a WORD START (\b prefix) so 'cycle' catches 'cycles'/'cycling'
// but not 'recycling', and 'grievance' catches 'grievances'. Phrases work too.
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const THEME_RE = new Map<string, RegExp>(
  TEXT_THEMES.map((t) => [
    t.label,
    new RegExp("\\b(" + t.triggers.map(esc).join("|") + ")", "i"),
  ])
);

export const responseMatchesTheme = (r: SurveyResponse, label: string): boolean => {
  const re = THEME_RE.get(label);
  return !!(re && r.q10_text && re.test(r.q10_text));
};

export function extractThemes(rows: SurveyResponse[], topN = 8): ThemeStat[] {
  const stats = TEXT_THEMES.map((t) => {
    const re = THEME_RE.get(t.label)!;
    let pos = 0, neu = 0, neg = 0;
    for (const r of rows) {
      if (!r.q10_text) continue;
      if (re.test(r.q10_text)) {
        if (r.q10_sentiment === "positive") pos += 1;
        else if (r.q10_sentiment === "negative") neg += 1;
        else neu += 1;
      }
    }
    const count = pos + neu + neg;
    const [sentiment, top]: [Sentiment, number] =
      neg >= pos && neg >= neu ? ["negative", neg]
        : pos >= neu ? ["positive", pos]
          : ["neutral", neu];
    return { label: t.label, count, sentiment, pct: count ? Math.round((top / count) * 100) : 0 };
  });
  return stats
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}
