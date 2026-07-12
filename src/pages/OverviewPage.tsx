// Page 1 — the headline cross-portfolio metric grid.
// Six identical, decoupled MetricCard slots driven entirely by config
// (metric_definitions + KPI_VIZ) + computed values. Each KPI renders a best-fit
// chart. Reassigning a metric or its chart is a config change; this page doesn't.

import { useMemo } from "react";
import { PageHeader, Card } from "@/components/ui";
import { MetricCard, MetricCardSkeleton } from "@/components/MetricCard";
import { SentimentSummary } from "@/components/SentimentFeed";
import { useApp } from "@/state/AppContext";
import { runKpiEngine } from "@/data/kpiEngine";
import { KPI_VIZ } from "@/config/defensiveDesign";
import { cn } from "@/lib/cn";
import type { Sentiment, SurveyResponse } from "@/data/types";

function cohortCounts(rows: SurveyResponse[]) {
  const c = { construction: 0, btr: 0, bts: 0 };
  for (const r of rows) {
    if (r.respondent_typology === "construction_adjacent") c.construction++;
    else if (r.delivery_model === "build_to_rent") c.btr++;
    else if (r.delivery_model === "build_to_sell") c.bts++;
  }
  return c;
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-[7rem]">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold", accent ? "text-brand" : "text-ink")}>
        {value}
      </p>
    </div>
  );
}

function CohortMix({ rows }: { rows: SurveyResponse[] }) {
  const c = cohortCounts(rows);
  const total = rows.length || 1;
  const bars = [
    { label: "Construction-Adjacent", n: c.construction, color: "rgb(var(--brand))" },
    { label: "Build to Rent", n: c.btr, color: "rgb(var(--state-green))" },
    { label: "Build to Sell", n: c.bts, color: "rgb(var(--state-amber))" },
  ];
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-muted">Portfolio Breakdown</p>
      <div className="mt-4 space-y-3">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-xs text-muted">{b.label}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-line/70">
              <div
                className="h-full rounded-full"
                style={{ width: `${(100 * b.n) / total}%`, backgroundColor: b.color }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-ink">
              <span className="font-semibold">{Math.round((100 * b.n) / total)}%</span>
              <span className="text-muted"> · {b.n}</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function OverviewPage() {
  const { kpiConfig, responses, textAnswers, loading, tenant } = useApp();

  const engine = useMemo(
    () => runKpiEngine(kpiConfig, responses, tenant?.id ?? ""),
    [kpiConfig, responses, tenant]
  );
  const metrics = engine.results;

  // Sentiment is computed from the SAME multi-stream qualitative source as the
  // deep dive (every text answer incl. Online Q3B), so the distribution is
  // unified across both views.
  const sentimentRows = useMemo(
    () =>
      textAnswers
        .filter((a) => a.sentiment)
        .map((a) => ({ q10_sentiment: a.sentiment as Sentiment })),
    [textAnswers]
  );

  const positivePct = useMemo(() => {
    if (sentimentRows.length === 0) return 0;
    return Math.round(
      (100 * sentimentRows.filter((r) => r.q10_sentiment === "positive").length) /
        sentimentRows.length
    );
  }, [sentimentRows]);

  // Split the six KPIs into the four multi-option dials and the two binary
  // linear bars, so the grid can lock them into the required column groups.
  const dials = metrics.filter((m) => KPI_VIZ[m.slot_index] !== "bartarget");
  const bars = metrics.filter((m) => KPI_VIZ[m.slot_index] === "bartarget");

  return (
    <div>
      <PageHeader
        title="Portfolio Metrics"
        subtitle={`Standardized cross-portfolio KPIs${tenant ? ` · ${tenant.name}` : ""}`}
      />

      {/* Summary hero */}
      <Card className="mb-6 bg-gradient-to-r from-brand/5 to-transparent p-5">
        <div className="flex flex-wrap items-center gap-8">
          <StatTile label="Responses" value={responses.length.toLocaleString()} accent />
          <StatTile label="Positive sentiment" value={`${positivePct}%`} />
          <StatTile
            label="KPIs on track"
            value={`${metrics.filter((m) => m.compliance_state === "green").length}/${metrics.length || 6}`}
          />
          <StatTile
            label="At risk"
            value={`${metrics.filter((m) => m.compliance_state === "red").length}`}
          />
        </div>
      </Card>

      {/* Locked KPI grid — 3 columns / 2 rows on desktop:
          Col 1-2: the four multi-option dials (ENV/Public Realm top,
          Sustainability/Community bottom). Col 3: the two binary linear bars
          (Facilities top, Housing bottom) stacked. On narrow screens the four
          dials stack first, then the two bars. */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Dial block: cols 1-2, a 2×2 grid of half-circle dials */}
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
            {dials.map((m) => (
              <MetricCard key={m.slot_index} metric={m} viz={KPI_VIZ[m.slot_index] ?? "gauge"} />
            ))}
          </div>
          {/* Binary stack: col 3, the two linear bars stacked and paired */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2">
            {bars.map((m) => (
              <MetricCard key={m.slot_index} metric={m} viz={KPI_VIZ[m.slot_index] ?? "bartarget"} />
            ))}
          </div>
        </div>
      )}

      {/* Secondary analytics */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CohortMix rows={responses} />
        <SentimentSummary rows={sentimentRows} />
      </div>

      {/* KPI engine audit footer (KPI_RunLog) */}
      <p className="mt-4 text-xs text-muted">
        KPI engine · computed {metrics.length} KPIs from{" "}
        {engine.runLog.input_records_count.toLocaleString()} records in{" "}
        {engine.runLog.execution_time_ms} ms ·{" "}
        {engine.runLog.calculation_version} · status {engine.runLog.status} ·{" "}
        {/* <Link to="/engine" className="text-brand hover:underline">
          view engine config →
        </Link> */}
      </p>
    </div>
  );
}
