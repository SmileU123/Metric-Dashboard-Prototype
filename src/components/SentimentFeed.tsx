// Q10 Qualitative NLP engine view: the 280-char open-feedback strings paired
// with their color-coded sentiment tags, plus a quick sentiment distribution.

import { Card } from "./ui";
import { SentimentTag } from "./ScoreBadge";
import { cn } from "@/lib/cn";
import type { SurveyResponse, Sentiment } from "@/data/types";

function distribution(rows: SurveyResponse[]) {
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

export function SentimentSummary({ rows }: { rows: SurveyResponse[] }) {
  const dist = distribution(rows);
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-muted">
        Sentiment distribution (Q10)
      </p>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-line">
        {dist.map((d) => (
          <div
            key={d.sentiment}
            className={cn("h-full", BAR[d.sentiment])}
            style={{ width: `${d.pct}%` }}
            title={`${d.sentiment}: ${d.pct}%`}
          />
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted">
        {dist.map((d) => (
          <span key={d.sentiment} className="capitalize">
            {d.sentiment}: <span className="font-semibold">{d.pct}%</span>
          </span>
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
