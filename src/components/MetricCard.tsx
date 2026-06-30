// Reusable Component Container (Page 1 metric slot).
//
// Per the brief: an identical, decoupled layout slot bound to EXACTLY three
// generic variables — metric_title, metric_value, compliance_state. It has no
// knowledge of which underlying question or aggregation produced it, so a metric
// can be reassigned (config change) without touching this component.

import { Card } from "./ui";
import { TrafficLight } from "./TrafficLight";
import { cn } from "@/lib/cn";
import type { ComplianceState } from "@/data/types";

const ACCENT: Record<ComplianceState, string> = {
  green: "before:bg-green",
  amber: "before:bg-amber",
  red: "before:bg-red",
};

export function MetricCard({
  metric_title,
  metric_value,
  compliance_state,
}: {
  metric_title: string;
  metric_value: string;
  compliance_state: ComplianceState;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-5",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
        ACCENT[compliance_state]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{metric_title}</p>
        <TrafficLight state={compliance_state} />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">
        {metric_value}
      </p>
      <div className="mt-2">
        <TrafficLight state={compliance_state} showLabel />
      </div>
    </Card>
  );
}

export function MetricCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="h-4 w-2/3 animate-pulse rounded bg-line/60" />
      <div className="mt-4 h-8 w-1/2 animate-pulse rounded bg-line/60" />
      <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-line/60" />
    </Card>
  );
}
