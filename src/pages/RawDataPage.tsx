// Raw Data page — inspect the verbatim captured survey responses (like the two
// source sheets). Columns are driven by the question CATALOG, so every field /
// online question shows — scale, categorical, yes/no and multi-select — with a
// Field/Online channel toggle and a Raw / Numeric / Normalized value mode.
// Reads the true stored value_raw from survey_answers (derived in seed mode).

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { SentimentTag } from "@/components/ScoreBadge";
import { useApp } from "@/state/AppContext";
import { fetchRawResponses, fetchSurveyQuestions } from "@/data/repository";
import { cn } from "@/lib/cn";
import type { RawAnswer, RawResponse, SurveyQuestion } from "@/data/types";

const PAGE_SIZE = 30;
type ValueMode = "raw" | "numeric" | "normalized";

const CHANNELS: { key: "field" | "online"; label: string }[] = [
  { key: "field", label: "Field Survey" },
  { key: "online", label: "Online / QR" },
];
const MODES: { key: ValueMode; label: string }[] = [
  { key: "raw", label: "Raw" },
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
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
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
    Promise.all([fetchRawResponses(tenant.id), fetchSurveyQuestions()])
      .then(([r, q]) => {
        if (cancelled) return;
        setRows(r);
        setQuestions(q);
        setError(null);
      })
      .catch((e) => !cancelled && setError(String(e?.message ?? e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  // A column per catalogued question for this channel. The primary open-text
  // answers (FS_OPEN / OL_OPEN) are shown via the envelope "Open Text" column;
  // every OTHER question — including open-text follow-ups like Q3B — gets its
  // own column.
  const ENVELOPE_TEXT_CODES = ["FS_OPEN", "OL_OPEN"];
  const columns = useMemo(
    () =>
      questions
        .filter(
          (q) => q.channel === channel && !ENVELOPE_TEXT_CODES.includes(q.code)
        )
        .sort((a, b) => a.seq - b.seq),
    [questions, channel]
  );

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

  const answerMap = (r: RawResponse) => {
    const m = new Map<string, RawAnswer>();
    for (const a of r.answers) m.set(a.question_code, a);
    return m;
  };

  const envCols = channel === "online" ? 6 : 5; // Captured, Cohort, Age, [Tenure], Open, Sentiment

  return (
    <div>
      <PageHeader
        title="Full Survey Data"
        subtitle="Unified Database containing all raw, numeric, and normalized responses."
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
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
                {columns.map((q) => (
                  <Th key={q.code} className="whitespace-nowrap">
                    {q.short_label}
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
                    {columns.map((q) =>
                      q.response_type === "open_text" ? (
                        // Text answers (e.g. the Q3B cost follow-up) always show
                        // their verbatim capture; numeric modes don't apply.
                        <Td key={q.code} className="min-w-[16rem] max-w-sm text-ink">
                          {m.get(q.code)?.value_raw ? (
                            <>&ldquo;{m.get(q.code)!.value_raw}&rdquo;</>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </Td>
                      ) : (
                        <Td key={q.code} className="whitespace-nowrap text-center tabular-nums">
                          {cellValue(m.get(q.code), mode)}
                        </Td>
                      )
                    )}
                    <Td className="max-w-md text-ink">&ldquo;{r.q10_text}&rdquo;</Td>
                    <Td>
                      <SentimentTag sentiment={r.q10_sentiment} />
                    </Td>
                  </tr>
                );
              })}
              {!loading && slice.length === 0 && (
                <tr>
                  <td colSpan={columns.length + envCols} className="p-8 text-center text-sm text-muted">
                    No {channel} responses match.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={columns.length + envCols} className="p-8 text-center text-sm text-muted">
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
        Scale answers show raw Likert 1–5 / numeric / 0–100 via the toggle;
        categorical, yes/no and multi-select answers show their captured value_raw
        (numeric mapping to come).
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
