// Renders a 0-100 impact score as a colored chip using the same traffic-light
// thresholds the metric cards use, so tables and KPIs stay visually consistent.

import { cn } from "@/lib/cn";
import type { ComplianceState, Sentiment } from "@/data/types";

const GREEN_AT = 70;
const AMBER_AT = 45;

export function scoreState(value: number): ComplianceState {
  if (value >= GREEN_AT) return "green";
  if (value >= AMBER_AT) return "amber";
  return "red";
}

const STATE_CLASS: Record<ComplianceState, string> = {
  green: "bg-green/10 text-green",
  amber: "bg-amber/10 text-amber",
  red: "bg-red/10 text-red",
};

export function ScoreBadge({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "inline-block min-w-[2.5rem] rounded-md px-2 py-0.5 text-center text-sm font-medium tabular-nums",
        STATE_CLASS[scoreState(value)]
      )}
    >
      {Math.round(value)}
    </span>
  );
}

const SENTIMENT_CLASS: Record<Sentiment, string> = {
  positive: "bg-green/10 text-green",
  neutral: "bg-amber/10 text-amber",
  negative: "bg-red/10 text-red",
};

export function SentimentTag({ sentiment }: { sentiment: Sentiment }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        SENTIMENT_CLASS[sentiment]
      )}
    >
      {sentiment}
    </span>
  );
}
