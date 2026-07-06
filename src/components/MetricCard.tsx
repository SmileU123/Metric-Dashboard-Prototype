// Reusable Component Container (Page 1 metric slot).
//
// Per the brief: a decoupled layout slot bound to metric_title, metric_value and
// compliance_state. The *visualization* is also config-driven (KPI_VIZ), so each
// of the six headline KPIs renders a different, best-fit chart while the binding
// contract stays identical — reassigning a metric or its chart is a config edit.

import { Card } from "./ui";
import { TrafficLight } from "./TrafficLight";
import {
  Gauge,
  Ring,
  ZoneBar,
  TrendColumns,
  TrendArea,
  BarTarget,
} from "./charts";
import type { KpiViz } from "@/config/defensiveDesign";
import type { MetricView } from "@/data/types";

// Quarter-over-quarter movement. Compares the latest quarter WITH data against
// the previous quarter WITH data — empty quarters (value 0 = no responses) are
// never used as a baseline, so a single-quarter dataset reads honestly as
// "first tracked quarter" instead of a bogus "▲ 54.2 vs Q4".
function TrendDelta({ m }: { m: MetricView }) {
  const withData = m.trend.filter((t) => t.value > 0);
  if (withData.length === 0) return null;
  const current = withData[withData.length - 1];
  const prev = withData.length >= 2 ? withData[withData.length - 2] : null;

  if (!prev)
    return (
      <span className="text-xs text-muted">
        {current.label} · first tracked quarter
      </span>
    );

  const delta = current.value - prev.value;
  if (Math.abs(delta) < 0.05)
    return (
      <span className="text-xs text-muted">no change vs {prev.label}</span>
    );
  const improving = m.direction === "lower_better" ? delta < 0 : delta > 0;
  const arrow = delta > 0 ? "▲" : "▼";
  return (
    <span
      className="text-xs font-medium"
      style={{ color: `rgb(var(--state-${improving ? "green" : "red"}))` }}
    >
      {arrow} {Math.abs(Math.round(delta * 10) / 10)}
      {m.unit === "%" ? "%" : ""} vs {prev.label}
    </span>
  );
}

const isRadial = (viz: KpiViz) => viz === "gauge" || viz === "ring";

export function MetricCard({ metric, viz }: { metric: MetricView; viz: KpiViz }) {
  const chart = renderChart(metric, viz);

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{metric.metric_title}</p>
        <TrafficLight state={metric.compliance_state} showLabel />
      </div>

      {isRadial(viz) ? (
        <div className="mt-2 flex items-center gap-4">
          <div className="shrink-0">{chart}</div>
          <div>
            <p className="text-3xl font-semibold tracking-tight text-ink">
              {metric.metric_value}
            </p>
            <div className="mt-1">
              <TrendDelta m={metric} />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-3xl font-semibold tracking-tight text-ink">
              {metric.metric_value}
            </p>
            <TrendDelta m={metric} />
          </div>
          <div className="mt-3">{chart}</div>
        </>
      )}
    </Card>
  );
}

function renderChart(m: MetricView, viz: KpiViz) {
  switch (viz) {
    case "gauge":
      return (
        <Gauge value={m.raw_value} max={m.scale_max} state={m.compliance_state} width={150} />
      );
    case "ring":
      return (
        <Ring value={m.raw_value} max={m.scale_max} state={m.compliance_state} size={112} />
      );
    case "zonebar":
      return (
        <ZoneBar
          value={m.raw_value}
          max={m.scale_max}
          greenAt={m.green_at}
          amberAt={m.amber_at}
          direction={m.direction}
          unit={m.unit === "%" ? "%" : ""}
        />
      );
    case "columns":
      return (
        <TrendColumns points={m.trend} state={m.compliance_state} max={m.scale_max} />
      );
    case "area":
      return (
        <TrendArea points={m.trend} state={m.compliance_state} max={m.scale_max} />
      );
    case "bartarget":
      return (
        <BarTarget
          value={m.raw_value}
          max={m.scale_max}
          target={m.green_at}
          state={m.compliance_state}
          unit={m.unit === "%" ? "%" : ""}
        />
      );
  }
}

export function MetricCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="h-4 w-2/3 animate-pulse rounded bg-line/60" />
      <div className="mt-4 h-8 w-1/2 animate-pulse rounded bg-line/60" />
      <div className="mt-4 h-20 w-full animate-pulse rounded bg-line/60" />
    </Card>
  );
}
