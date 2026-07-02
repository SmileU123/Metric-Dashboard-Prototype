// Raw Data page — inspect the verbatim captured survey responses (like the two
// source sheets): a Field vs Online channel toggle, and a Raw / Numeric /
// Normalized value mode so both the raw capture and its derivations are visible.
// Reads the true stored value_raw from survey_answers (derived in seed mode).

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { SentimentTag } from "@/components/ScoreBadge";
import { useApp } from "@/state/AppContext";
import { fetchRawResponses } from "@/data/repository";
import { IMPACT_THEMES } from "@/config/defensiveDesign";
import { cn } from "@/lib/cn";
import type { RawAnswer, RawResponse, SurveyChannel } from "@/data/types";

const PAGE_SIZE = 30;
type ValueMode = "raw" | "numeric" | "normalized";

const CHANNELS: { key: Exclude<SurveyChannel, "private_ownership">; label: string }[] = [
  { key: "field", label: "Field Survey" },
  { key: "online", label: "Online / QR" },
];

const MODES: { key: ValueMode; label: string }[] = [
  { key: "raw", label: "Raw (1–5)" },
  { key: "numeric", label: "Numeric" },
  { key: "normalized", label: "0–100" },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "numeric" });

function cellValue(a: RawAnswer | undefined, mode: ValueMode): string {
  if (!a) return "—";
  if (mode === "raw") return a.value_raw ?? "—";
  if (mode === "numeric") return a.value_numeric != null ? String(a.value_numeric) : "—";
  return a.value_normalized != null ? String(Math.round(a.value_normalized)) : "—";
}

export function RawDataPage() {
  const { tenant } = useApp();
  const [rows, setRows] = useState<RawResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [channel, setChannel] = useState<"field" | "online">("field");
  const [mode, setMode] = useState<ValueMode>("raw");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    setLoading(true);
    fetchRawResponses(tenant.id)
      .then((r) => !cancelled && (setRows(r), setError(null)))
      .catch((e) => !cancelled && setError(String(e?.message ?? e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  // Columns for the selected channel (fs_* for field, ol_* for online).
  const prefix = channel === "field" ? "fs_" : "ol_";
  const columns = IMPACT_THEMES.filter((t) => t.column.startsWith(prefix));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.channel === channel &&
        (q === "" ||
          r.q10_text.toLowerCase().includes(q) ||
          r.answers.some((a) => (a.value_raw ?? "").toLowerCase().includes(q)))
    );
  }, [rows, channel, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const slice = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const resetPage = () => setPage(0);

  // per-response answer lookup keyed by lowercased question code
  const answerMap = (r: RawResponse) => {
    const m = new Map<string, RawAnswer>();
    for (const a of r.answers) m.set(a.question_code.toLowerCase(), a);
    return m;
  };

  return (
    <div>
      <PageHeader
        title="Raw Survey Data"
        subtitle="Verbatim captured responses — raw value, numeric, and normalized."
      />

      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {/* Channel toggle */}
        <div className="inline-flex overflow-hidden rounded-md border border-line">
          {CHANNELS.map((c) => (
            <button
              key={c.key}
              onClick={() => {
                setChannel(c.key);
                resetPage();
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium",
                channel === c.key ? "bg-brand text-brand-fg" : "bg-surface text-muted hover:bg-canvas"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Value mode */}
        <div className="inline-flex overflow-hidden rounded-md border border-line">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium",
                mode === m.key ? "bg-brand text-brand-fg" : "bg-surface text-muted hover:bg-canvas"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          placeholder="Search raw values or open text…"
          className="h-9 min-w-[14rem] flex-1 rounded-md border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red/30 bg-red/10 px-4 py-2 text-sm text-red">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-left">
                <Th>Captured</Th>
                <Th>Cohort</Th>
                <Th>Age</Th>
                {channel === "online" && <Th>Tenure</Th>}
                {columns.map((c) => (
                  <Th key={c.column} className="whitespace-nowrap">
                    {c.header} ({c.code})
                  </Th>
                ))}
                <Th>Open Text</Th>
                <Th>Sentiment</Th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => {
                const m = answerMap(r);
                return (
                  <tr key={r.id} className="border-b border-line/60 align-top last:border-0 hover:bg-canvas/50">
                    <Td className="whitespace-nowrap text-muted">{fmtDate(r.submitted_at)}</Td>
                    <Td className="whitespace-nowrap">{r.temporal_cohort}</Td>
                    <Td className="whitespace-nowrap text-muted">{r.q1_demographic}</Td>
                    {channel === "online" && (
                      <Td className="whitespace-nowrap text-muted">{r.q3_tenure}</Td>
                    )}
                    {columns.map((c) => (
                      <Td key={c.column} className="text-center tabular-nums">
                        {cellValue(m.get(c.column), mode)}
                      </Td>
                    ))}
                    <Td className="max-w-md text-ink">&ldquo;{r.q10_text}&rdquo;</Td>
                    <Td>
                      <SentimentTag sentiment={r.q10_sentiment} />
                    </Td>
                  </tr>
                );
              })}
              {!loading && slice.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 6} className="p-8 text-center text-sm text-muted">
                    No {channel === "field" ? "field" : "online"} responses match.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={columns.length + 6} className="p-8 text-center text-sm text-muted">
                    Loading raw data…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-xs text-muted">
          <span>
            {filtered.length === 0
              ? "0 records"
              : `Showing ${current * PAGE_SIZE + 1}–${current * PAGE_SIZE + slice.length} of ${filtered.length.toLocaleString()} ${channel} responses`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              className="rounded border border-line px-2 py-1 disabled:opacity-40 enabled:hover:bg-canvas"
            >
              ← Prev
            </button>
            <span>Page {current + 1} of {pageCount}</span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={current >= pageCount - 1}
              className="rounded border border-line px-2 py-1 disabled:opacity-40 enabled:hover:bg-canvas"
            >
              Next →
            </button>
          </div>
        </div>
      </Card>

      <p className="mt-3 text-xs text-muted">
        Scale answers store the raw Likert 1–5, its numeric value, and the 0–100
        normalization used by the KPI engine — toggle above to view each.
      </p>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted ${className ?? ""}`}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 ${className ?? ""}`}>{children}</td>;
}
