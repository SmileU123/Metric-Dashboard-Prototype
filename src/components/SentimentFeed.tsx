// Q10 Qualitative NLP engine view: the 280-char open-feedback strings paired
// with their color-coded sentiment tags, plus a quick sentiment distribution.

import { Card } from "./ui";
import { SentimentTag } from "./ScoreBadge";
import { cn } from "@/lib/cn";
import type { SurveyResponse, Sentiment } from "@/data/types";

// Accepts anything sentiment-bearing — full responses OR lighter rows (e.g. the
// multi-stream text answers), so the same card can render either source.
type SentimentRow = { q10_sentiment: Sentiment };

function distribution(rows: SentimentRow[]) {
  const counts: Record<Sentiment, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  rows.forEach((r) => (counts[r.q10_sentiment] += 1));
  const total = rows.length || 1;
  return (["positive", "neutral", "negative"] as Sentiment[]).map((s) => ({
    sentiment: s,
    count: counts[s],
    pct: Math.round((100 * counts[s]) / total),
  }));
}

const BAR: Record<Sentiment, string> = {
  positive: "bg-green",
  neutral: "bg-amber",
  negative: "bg-red",
};

// Three separate, labelled bars — easier to compare at a glance than one
// merged/stacked bar.
export function SentimentSummary({ rows }: { rows: SentimentRow[] }) {
  const dist = distribution(rows);
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-muted">
          Sentiment Distribution
        </p>
        <p className="text-xs text-muted">{rows.length.toLocaleString()} responses</p>
      </div>
      <div className="mt-4 space-y-3">
        {dist.map((d) => (
          <div key={d.sentiment} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs font-medium capitalize text-muted">
              {d.sentiment}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-line/70">
              <div
                className={cn("h-full rounded-full", BAR[d.sentiment])}
                style={{ width: `${d.pct}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-ink">
              <span className="font-semibold">{d.pct}%</span>
              <span className="text-muted"> · {d.count}</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SentimentFeed({
  rows,
  limit = 30,
}: {
  rows: SurveyResponse[];
  limit?: number;
}) {
  const withText = rows.filter((r) => r.q10_text).slice(0, limit);
  return (
    <Card className="divide-y divide-line/60">
      {withText.map((r) => (
        <div key={r.id} className="flex items-start gap-3 p-4">
          <SentimentTag sentiment={r.q10_sentiment} />
          <div className="min-w-0">
            <p className="text-sm text-ink">&ldquo;{r.q10_text}&rdquo;</p>
            <p className="mt-1 text-xs text-muted">
              {r.q2_asset_class} · {r.q3_tenure} ·{" "}
              {new Date(r.submitted_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
      {withText.length === 0 && (
        <div className="p-8 text-center text-sm text-muted">
          No qualitative feedback matches the current filters.
        </div>
      )}
    </Card>
  );
}
