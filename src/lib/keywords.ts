// Lightweight open-text keyword extraction for the Page-4 clustering element.
// No word cloud — we surface the top recurring terms (ranked) so they can be
// rendered as a horizontal frequency bar chart and used as ledger filters.

import type { Sentiment, SurveyResponse } from "@/data/types";

// Common English + domain-generic fillers we don't want ranking as "themes".
const STOPWORDS = new Set<string>([
  "the", "and", "for", "are", "that", "this", "with", "have", "has", "had",
  "been", "was", "were", "will", "would", "could", "should", "can", "get",
  "got", "our", "your", "yours", "their", "they", "them", "some", "from",
  "out", "not", "but", "all", "any", "more", "most", "than", "then", "there",
  "here", "what", "which", "when", "how", "who", "why", "into", "over",
  "about", "just", "like", "really", "very", "much", "many", "one", "two",
  "also", "still", "even", "only", "make", "makes", "made", "feel", "feels",
  "thing", "things", "overall", "either", "broadly", "expected", "strong",
  "feelings", "nothing", "major", "report", "period", "average", "experience",
  "fine", "good", "great", "poor", "better", "worse", "around", "near",
  "during", "being", "because", "after", "before", "while", "these", "those",
  "development", "developments", "building", "buildings", "estate", "resident",
  "residents", "local", "area", "areas", "quarter", "team", "help", "helps",
  "keep", "keeps", "stops", "use", "used", "using", "give", "given", "want",
  "need", "needs", "please", "with", "those", "some", "onsite",
]);

// Rough singularization so 'lockers'/'screens'/'jobs' merge with their singular.
function normalize(w: string): string {
  const t = w.replace(/[’'-]+$/g, "");
  if (t.length > 4 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

const dominant = (e: { pos: number; neu: number; neg: number }): Sentiment =>
  e.neg >= e.pos && e.neg >= e.neu
    ? "negative"
    : e.pos >= e.neu
      ? "positive"
      : "neutral";

export interface Keyword {
  term: string;
  count: number; // # of responses mentioning it
  sentiment: Sentiment; // dominant sentiment among those responses
}

export function extractKeywords(
  rows: SurveyResponse[],
  topN = 12
): Keyword[] {
  const map = new Map<string, { count: number; pos: number; neu: number; neg: number }>();

  for (const r of rows) {
    if (!r.q10_text) continue;
    const tokens = r.q10_text.toLowerCase().match(/[a-z][a-z’'-]{2,}/g) ?? [];
    const seen = new Set<string>(); // count each term once per response
    for (const raw of tokens) {
      const w = normalize(raw);
      if (w.length < 4 || STOPWORDS.has(w) || seen.has(w)) continue;
      seen.add(w);
      const e = map.get(w) ?? { count: 0, pos: 0, neu: 0, neg: 0 };
      e.count += 1;
      if (r.q10_sentiment === "positive") e.pos += 1;
      else if (r.q10_sentiment === "negative") e.neg += 1;
      else e.neu += 1;
      map.set(w, e);
    }
  }

  return [...map.entries()]
    .map(([term, e]) => ({ term, count: e.count, sentiment: dominant(e) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}
