// KPI Engine page — VIEW + EDIT the configurable engine: tune each KPI's source
// weights and thresholds, toggle it on/off, delete it, or add a new one. Edits
// update the live dashboard immediately (via AppContext) and persist to Supabase
// when configured; otherwise they stay session-local (prototype fallback).

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { TrafficLight } from "@/components/TrafficLight";
import { useApp } from "@/state/AppContext";
import { runKpiEngine } from "@/data/kpiEngine";
import {
  canPersist,
  createKpi,
  deleteKpi,
  saveDefinition,
  saveSource,
  saveThreshold,
} from "@/data/repository";
import { IMPACT_THEMES } from "@/config/defensiveDesign";
import type {
  KpiComputed,
  KpiConfig,
  KpiSource,
  KpiTransformation,
} from "@/data/types";

// Survey columns a KPI source can bind to.
const AVAILABLE_SOURCES: { key: string; label: string; transform: KpiTransformation }[] = [
  ...IMPACT_THEMES.map((t) => ({
    key: t.column,
    label: `${t.code} · ${t.header}`,
    transform: "passthrough" as KpiTransformation,
  })),
  {
    key: "housing_cost_to_income",
    label: "Housing Cost-to-Income",
    transform: "invert_cost_to_income" as KpiTransformation,
  },
];
const sourceLabel = (key: string) =>
  AVAILABLE_SOURCES.find((s) => s.key === key)?.label.split(" · ")[0] ?? key;

const CATEGORIES = [
  "environmental",
  "public_realm",
  "mobility",
  "sustainability",
  "community",
  "housing",
  "general",
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
      {children}
    </span>
  );
}

const numInput =
  "h-8 w-16 rounded border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40";

export function KpiEnginePage() {
  const { kpiConfig, setKpiConfig, responses, tenant } = useApp();
  const [notice, setNotice] = useState<string | null>(null);

  // Always-latest config, so persist-on-blur reads current values.
  const cfgRef = useRef(kpiConfig);
  useEffect(() => {
    cfgRef.current = kpiConfig;
  }, [kpiConfig]);

  const engine = useMemo(
    () => runKpiEngine(kpiConfig, responses, tenant?.id ?? ""),
    [kpiConfig, responses, tenant]
  );
  const byId = useMemo(() => {
    const m = new Map<string, KpiComputed>();
    engine.results.forEach((r) => m.set(r.kpi_id, r));
    return m;
  }, [engine.results]);

  const defs = [...kpiConfig.definitions].sort(
    (a, b) => a.display_order - b.display_order
  );
  const sourcesOf = (id: string) =>
    kpiConfig.sources.filter((s) => s.kpi_id === id);
  const formulaOf = (id: string) =>
    kpiConfig.formulas.find((f) => f.kpi_id === id);
  const thresholdOf = (id: string) =>
    kpiConfig.thresholds.find((t) => t.kpi_id === id);

  const persistFail = () =>
    setNotice(
      "Saved in this session only. To persist edits to the database, run supabase/migrations/0007_phase1_demo_write.sql."
    );

  // ---- mutations (update context immediately, persist on commit) ----
  const patchThreshold = (kpiId: string, patch: Partial<{ green_min: number; amber_min: number }>) =>
    setKpiConfig((p) => ({
      ...p,
      thresholds: p.thresholds.map((t) =>
        t.kpi_id === kpiId ? { ...t, ...patch } : t
      ),
    }));
  const commitThreshold = (kpiId: string) => {
    const t = cfgRef.current.thresholds.find((x) => x.kpi_id === kpiId);
    if (t) saveThreshold(t).catch(persistFail);
  };

  const patchWeight = (sourceId: string, weight: number) =>
    setKpiConfig((p) => ({
      ...p,
      sources: p.sources.map((s) =>
        s.id === sourceId ? { ...s, weight } : s
      ),
    }));
  const commitSource = (sourceId: string) => {
    const s = cfgRef.current.sources.find((x) => x.id === sourceId);
    if (s) saveSource(s).catch(persistFail);
  };

  const toggleActive = (kpiId: string, is_active: boolean) => {
    setKpiConfig((p) => ({
      ...p,
      definitions: p.definitions.map((d) =>
        d.id === kpiId ? { ...d, is_active } : d
      ),
    }));
    const d = { ...cfgRef.current.definitions.find((x) => x.id === kpiId)!, is_active };
    saveDefinition(d).catch(persistFail);
  };

  const removeKpi = (kpiId: string) => {
    setKpiConfig((p) => ({
      definitions: p.definitions.filter((d) => d.id !== kpiId),
      sources: p.sources.filter((s) => s.kpi_id !== kpiId),
      formulas: p.formulas.filter((f) => f.kpi_id !== kpiId),
      thresholds: p.thresholds.filter((t) => t.kpi_id !== kpiId),
    }));
    deleteKpi(kpiId).catch(persistFail);
  };

  return (
    <div>
      <PageHeader
        title="KPI Engine"
        subtitle="Configure the calculation pipeline: sources → weighted formula → thresholds → result"
      />

      {!canPersist && (
        <div className="mb-4 rounded-md border border-amber/30 bg-amber/10 px-4 py-2 text-sm text-amber">
          No database connected — edits apply live but are session-only. Set
          Supabase env vars to persist.
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-md border border-amber/30 bg-amber/10 px-4 py-2 text-sm text-amber">
          {notice}
        </div>
      )}

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
            KPIs:{" "}
            <span className="font-semibold text-ink">
              {engine.results.length}
            </span>
          </span>
          <span className="text-muted">
            Status:{" "}
            <span className="font-semibold text-green">
              {engine.runLog.status}
            </span>
          </span>
        </div>
      </Card>

      <AddKpiForm
        existingOrders={defs.map((d) => d.display_order)}
        onCreate={(cfg) => {
          setKpiConfig((p) => ({
            definitions: [...p.definitions, cfg.definition],
            sources: [...p.sources, ...cfg.sources],
            formulas: [...p.formulas, cfg.formula],
            thresholds: [...p.thresholds, cfg.threshold],
          }));
          createKpi(cfg).catch(persistFail);
        }}
      />

      <div className="mt-6 space-y-4">
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
                <div className="flex items-center gap-4">
                  {r && (
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-ink">
                        {d.is_active ? r.metric_value : "—"}
                      </p>
                      {d.is_active && (
                        <TrafficLight state={r.compliance_state} showLabel />
                      )}
                    </div>
                  )}
                  <div className="flex flex-col items-end gap-1">
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={d.is_active}
                        onChange={(e) => toggleActive(d.id, e.target.checked)}
                      />
                      active
                    </label>
                    <button
                      onClick={() => removeKpi(d.id)}
                      className="text-xs text-red hover:underline"
                    >
                      delete
                    </button>
                  </div>
                </div>
              </div>

              {/* editable pipeline */}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted">
                    Sources &amp; weights
                  </p>
                  <div className="space-y-2">
                    {sourcesOf(d.id).map((s) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <Chip>{sourceLabel(s.source_key)}</Chip>
                        <span className="text-xs text-muted">×</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          className={numInput}
                          value={s.weight}
                          onChange={(e) =>
                            patchWeight(s.id, Number(e.target.value))
                          }
                          onBlur={() => commitSource(s.id)}
                        />
                        {s.transformation !== "passthrough" && (
                          <span className="text-[10px] text-muted">
                            {s.transformation}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted">
                    Formula (from weights)
                  </p>
                  <code className="rounded bg-canvas px-2 py-1 text-xs text-ink">
                    {formula?.formula_type ?? "weighted_average"}(
                    {sourcesOf(d.id)
                      .map((s) => `${sourceLabel(s.source_key)}×${s.weight}`)
                      .join(" + ")}
                    )
                  </code>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted">
                    Thresholds
                  </p>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-green" /> ≥
                      <input
                        type="number"
                        className={numInput}
                        value={th?.green_min ?? 0}
                        onChange={(e) =>
                          patchThreshold(d.id, { green_min: Number(e.target.value) })
                        }
                        onBlur={() => commitThreshold(d.id)}
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber" /> ≥
                      <input
                        type="number"
                        className={numInput}
                        value={th?.amber_min ?? 0}
                        onChange={(e) =>
                          patchThreshold(d.id, { amber_min: Number(e.target.value) })
                        }
                        onBlur={() => commitThreshold(d.id)}
                      />
                    </label>
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

// -----------------------------------------------------------------------------
// Add-KPI form
// -----------------------------------------------------------------------------
type NewSourceRow = { key: string; weight: number };

function AddKpiForm({
  existingOrders,
  onCreate,
}: {
  existingOrders: number[];
  onCreate: (cfg: {
    definition: KpiConfig["definitions"][number];
    sources: KpiSource[];
    formula: KpiConfig["formulas"][number];
    threshold: KpiConfig["thresholds"][number];
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("general");
  const [green, setGreen] = useState(70);
  const [amber, setAmber] = useState(45);
  const [rows, setRows] = useState<NewSourceRow[]>([
    { key: "q4_score", weight: 1 },
  ]);

  const reset = () => {
    setName("");
    setCode("");
    setCategory("general");
    setGreen(70);
    setAmber(45);
    setRows([{ key: "q4_score", weight: 1 }]);
    setOpen(false);
  };

  const submit = () => {
    if (!name.trim() || !code.trim() || rows.length === 0) return;
    const id = crypto.randomUUID();
    const nextOrder = (existingOrders.length ? Math.max(...existingOrders) : 0) + 1;
    const sources: KpiSource[] = rows.map((r) => ({
      id: crypto.randomUUID(),
      kpi_id: id,
      source_type: "survey",
      source_key: r.key,
      weight: r.weight,
      transformation:
        AVAILABLE_SOURCES.find((s) => s.key === r.key)?.transform ?? "passthrough",
      is_active: true,
    }));
    onCreate({
      definition: {
        id,
        tenant_id: null,
        project_id: null,
        kpi_code: code.trim().toUpperCase().replace(/\s+/g, "_"),
        kpi_name: name.trim(),
        description: "Custom KPI added from the KPI Engine page.",
        category,
        calculation_type: rows.length > 1 ? "weighted_average" : "direct",
        is_composite: rows.length > 1,
        is_active: true,
        display_order: nextOrder,
      },
      sources,
      formula: {
        id: crypto.randomUUID(),
        kpi_id: id,
        formula_type: rows.length > 1 ? "weighted_average" : "direct",
        expression: rows
          .map((r) => `${sourceLabel(r.key)}×${r.weight}`)
          .join(" + "),
        normalization_min: 0,
        normalization_max: 100,
      },
      threshold: {
        id: crypto.randomUUID(),
        kpi_id: id,
        condition_type: "score_range",
        green_min: green,
        amber_min: amber,
        red_min: 0,
        is_global: true,
      },
    });
    reset();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-fg hover:opacity-90"
      >
        + Add KPI
      </button>
    );
  }

  return (
    <Card className="border-brand/40 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">New KPI</h3>
        <button onClick={reset} className="text-xs text-muted hover:underline">
          cancel
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-muted">
          Name
          <input
            className="mt-1 h-9 w-full rounded border border-line bg-surface px-2 text-sm text-ink"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Noise & Air Quality"
          />
        </label>
        <label className="text-xs text-muted">
          Code
          <input
            className="mt-1 h-9 w-full rounded border border-line bg-surface px-2 text-sm text-ink"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="NOISE_AIR"
          />
        </label>
        <label className="text-xs text-muted">
          Category
          <select
            className="mt-1 h-9 w-full rounded border border-line bg-surface px-2 text-sm text-ink"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className="text-xs text-muted">
            Green ≥
            <input
              type="number"
              className={`mt-1 ${numInput} w-full`}
              value={green}
              onChange={(e) => setGreen(Number(e.target.value))}
            />
          </label>
          <label className="text-xs text-muted">
            Amber ≥
            <input
              type="number"
              className={`mt-1 ${numInput} w-full`}
              value={amber}
              onChange={(e) => setAmber(Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      <p className="mt-4 mb-2 text-xs font-semibold uppercase text-muted">
        Sources &amp; weights
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              className="h-9 rounded border border-line bg-surface px-2 text-sm text-ink"
              value={r.key}
              onChange={(e) =>
                setRows((rs) =>
                  rs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x))
                )
              }
            >
              {AVAILABLE_SOURCES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">×</span>
            <input
              type="number"
              step="0.1"
              min="0"
              className={numInput}
              value={r.weight}
              onChange={(e) =>
                setRows((rs) =>
                  rs.map((x, j) =>
                    j === i ? { ...x, weight: Number(e.target.value) } : x
                  )
                )
              }
            />
            {rows.length > 1 && (
              <button
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                className="text-xs text-red hover:underline"
              >
                remove
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => setRows((rs) => [...rs, { key: "q5_score", weight: 0.5 }])}
        className="mt-2 text-xs text-brand hover:underline"
      >
        + add source
      </button>

      <div className="mt-4 flex gap-2">
        <button
          onClick={submit}
          className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-fg hover:opacity-90"
        >
          Create KPI
        </button>
        <button
          onClick={reset}
          className="rounded-md border border-line px-3 py-2 text-sm text-muted hover:bg-canvas"
        >
          Cancel
        </button>
      </div>
    </Card>
  );
}
