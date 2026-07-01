// KPI Engine page — makes the configurable engine visible and auditable:
// each KPI's inputs (sources + weights + transforms), formula, thresholds, live
// computed value/state, and the run-log for the latest computation.

import { useMemo } from "react";
import { PageHeader, Card } from "@/components/ui";
import { TrafficLight } from "@/components/TrafficLight";
import { useApp } from "@/state/AppContext";
import { runKpiEngine } from "@/data/kpiEngine";
import { IMPACT_THEMES } from "@/config/defensiveDesign";
import type { KpiComputed } from "@/data/types";

function sourceLabel(key: string): string {
  const theme = IMPACT_THEMES.find((t) => t.column === key);
  if (theme) return theme.code;
  if (key === "housing_cost_to_income") return "Cost-to-Income";
  return key;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
      {children}
    </span>
  );
}

export function KpiEnginePage() {
  const { kpiConfig, responses, tenant } = useApp();
  const engine = useMemo(
    () => runKpiEngine(kpiConfig, responses, tenant?.id ?? ""),
    [kpiConfig, responses, tenant]
  );

  const byId = useMemo(() => {
    const m = new Map<string, KpiComputed>();
    engine.results.forEach((r) => m.set(r.kpi_id, r));
    return m;
  }, [engine.results]);

  const sourcesOf = (kpiId: string) =>
    kpiConfig.sources.filter((s) => s.kpi_id === kpiId);
  const formulaOf = (kpiId: string) =>
    kpiConfig.formulas.find((f) => f.kpi_id === kpiId);
  const thresholdOf = (kpiId: string) =>
    kpiConfig.thresholds.find((t) => t.kpi_id === kpiId);

  const defs = [...kpiConfig.definitions].sort(
    (a, b) => a.display_order - b.display_order
  );

  return (
    <div>
      <PageHeader
        title="KPI Engine"
        subtitle="Configurable calculation pipeline: sources → formula → thresholds → result → audit"
      />

      {/* Run log */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <span className="text-muted">
            Records in:{" "}
            <span className="font-semibold text-ink">
              {engine.runLog.input_records_count.toLocaleString()}
            </span>
          </span>
          <span className="text-muted">
            Exec:{" "}
            <span className="font-semibold text-ink">
              {engine.runLog.execution_time_ms} ms
            </span>
          </span>
          <span className="text-muted">
            Version:{" "}
            <span className="font-semibold text-ink">
              {engine.runLog.calculation_version}
            </span>
          </span>
          <span className="text-muted">
            Status:{" "}
            <span className="font-semibold text-green">
              {engine.runLog.status}
            </span>
          </span>
          <span className="text-muted">
            Period:{" "}
            <span className="font-semibold text-ink">
              {engine.results[0]?.data_period ?? "live"}
            </span>
          </span>
        </div>
      </Card>

      <div className="space-y-4">
        {defs.map((d) => {
          const r = byId.get(d.id);
          const formula = formulaOf(d.id);
          const th = thresholdOf(d.id);
          return (
            <Card key={d.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-ink">
                      {d.kpi_name}
                    </h3>
                    <Chip>{d.kpi_code}</Chip>
                    <Chip>{d.category}</Chip>
                    {d.is_composite && <Chip>composite</Chip>}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-muted">
                    {d.description}
                  </p>
                </div>
                {r && (
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-ink">
                      {r.metric_value}
                    </p>
                    <TrafficLight state={r.compliance_state} showLabel />
                  </div>
                )}
              </div>

              {/* pipeline */}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted">
                    Sources ({d.calculation_type})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {sourcesOf(d.id).map((s) => (
                      <Chip key={s.id}>
                        {sourceLabel(s.source_key)} · ×{s.weight}
                        {s.transformation !== "passthrough"
                          ? ` · ${s.transformation}`
                          : ""}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted">
                    Formula
                  </p>
                  <code className="rounded bg-canvas px-2 py-1 text-xs text-ink">
                    {formula?.expression || "—"}
                  </code>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted">
                    Thresholds
                  </p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-green" />
                      ≥ {th?.green_min}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber" />
                      ≥ {th?.amber_min}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-red" />
                      &lt; {th?.amber_min}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
