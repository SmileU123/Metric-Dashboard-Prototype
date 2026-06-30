// Page 1 — the headline cross-portfolio metric grid.
// Six identical, decoupled MetricCard slots driven entirely by config
// (metric_definitions) + computed values. Reassigning a metric is a config
// change; this page never changes.

import { useMemo } from "react";
import { PageHeader } from "@/components/ui";
import { MetricCard, MetricCardSkeleton } from "@/components/MetricCard";
import { SentimentSummary } from "@/components/SentimentFeed";
import { useApp } from "@/state/AppContext";
import { computeMetrics } from "@/data/metrics";

export function OverviewPage() {
  const { metricDefs, responses, loading, tenant } = useApp();

  const metrics = useMemo(
    () => computeMetrics(metricDefs, responses),
    [metricDefs, responses]
  );

  return (
    <div>
      <PageHeader
        title="Portfolio Metrics"
        subtitle={`Cross-portfolio headline indicators${
          tenant ? ` · ${tenant.name}` : ""
        }`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <MetricCardSkeleton key={i} />)
          : metrics.map((m) => (
              <MetricCard
                key={m.slot_index}
                metric_title={m.metric_title}
                metric_value={m.metric_value}
                compliance_state={m.compliance_state}
              />
            ))}
      </div>

      <div className="mt-6">
        <SentimentSummary rows={responses} />
      </div>
    </div>
  );
}
