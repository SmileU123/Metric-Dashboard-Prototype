// Q10 / Page 4 — Qualitative open-feedback ledger.
//
// Built for asset-manager investigation at volume (~350 responses across 6
// sites + online): a high-level numeric sentiment summary, three controls above
// the table (sentiment toggle, channel filter, text search), and a paginated
// data table capped at 30 records per page.

import { useMemo, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { SentimentSummary } from "@/components/SentimentFeed";
import { SentimentTag } from "@/components/ScoreBadge";
import { useApp } from "@/state/AppContext";
import { extractThemes, responseMatchesTheme } from "@/config/textThemes";
import { cn } from "@/lib/cn";
import type { ResponseSource, Sentiment, SurveyResponse } from "@/data/types";

const PAGE_SIZE = 30;

const CHANNEL_LABEL: Record<ResponseSource, string> = {
  field_pwa: "Field Intercept",
  digital_public: "Online",
};

const SENTIMENTS: ("all" | Sentiment)[] = ["all", "positive", "neutral", "negative"];

const SENT_STATE: Record<Sentiment, "green" | "amber" | "red"> = {
  positive: "green",
  neutral: "amber",
  negative: "red",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}

export function QualitativePage() {
  const { responses } = useApp();

  const [sentiment, setSentiment] = useState<"all" | Sentiment>("all");
  const [channel, setChannel] = useState<"all" | ResponseSource>("all");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Cohort scope (sentiment + channel) — the theme chart summarises this set.
  const cohort = useMemo(
    () =>
      responses.filter(
        (r) =>
          r.q10_text &&
          (sentiment === "all" || r.q10_sentiment === sentiment) &&
          (channel === "all" || r.source === channel)
      ),
    [responses, sentiment, channel]
  );

  const themes = useMemo(() => extractThemes(cohort, 8), [cohort]);
  const maxCount = themes[0]?.count ?? 1;

  // Ledger = cohort narrowed by the free-text search and the active theme.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cohort.filter(
      (r) =>
        (q === "" || r.q10_text.toLowerCase().includes(q)) &&
        (!theme || responseMatchesTheme(r, theme))
    );
  }, [cohort, search, theme]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const slice = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const resetPage = () => setPage(0);
  const toggleTheme = (label: string) => {
    setTheme((t) => (t === label ? null : label));
    resetPage();
  };

  return (
    <div>
      <PageHeader
        title="Qualitative Feedback"
        subtitle="Open feedback (Q10) — hard-capped 280-character responses with backend sentiment tagging."
      />

      <div className="mb-6">
        <SentimentSummary rows={filtered} />
      </div>

      {/* Thematic clustering — click a theme to filter the ledger below */}
      {themes.length > 0 && (
        <Card className="mb-4 p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-muted">
              Recurring themes in open feedback
            </p>
            <p className="text-xs text-muted">click a theme to filter the ledger</p>
          </div>
          <div className="mt-4 space-y-2">
            {themes.map((th) => {
              const active = th.label === theme;
              const state = SENT_STATE[th.sentiment];
              return (
                <button
                  key={th.label}
                  onClick={() => toggleTheme(th.label)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-canvas",
                    active && "bg-canvas ring-1 ring-brand/50"
                  )}
                >
                  <span className="w-52 shrink-0 truncate text-sm font-semibold text-ink">
                    {th.label}
                  </span>
                  <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-line/60">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${(th.count / maxCount) * 100}%`,
                        backgroundColor: `rgb(var(--state-${state}))`,
                      }}
                    />
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted">
                    ({th.count} mentions)
                  </span>
                  <span className="flex w-28 shrink-0 items-center gap-1.5 text-xs">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: `rgb(var(--state-${state}))` }}
                    />
                    <span className="font-medium capitalize text-ink">
                      {th.pct}% {th.sentiment}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Investigative controls */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {/* Sentiment toggle */}
        <div className="inline-flex overflow-hidden rounded-md border border-line">
          {SENTIMENTS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSentiment(s);
                resetPage();
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium capitalize",
                sentiment === s
                  ? "bg-brand text-brand-fg"
                  : "bg-surface text-muted hover:bg-canvas"
              )}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>

        {/* Channel filter */}
        <select
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as "all" | ResponseSource);
            resetPage();
          }}
          className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          <option value="all">All channels</option>
          <option value="field_pwa">Field Intercept</option>
          <option value="digital_public">Online</option>
        </select>

        {/* Text search */}
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          placeholder="Search open-text feedback…"
          className="h-9 min-w-[12rem] flex-1 rounded-md border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
        />

        {/* Active theme filter */}
        {theme && (
          <button
            onClick={() => {
              setTheme(null);
              resetPage();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand/10 px-3 text-sm font-medium text-brand hover:bg-brand/20"
          >
            theme: {theme} <span className="text-brand/70">✕</span>
          </button>
        )}
      </div>

      {/* Ledger */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-left">
                <Th>Sentiment</Th>
                <Th>Open Feedback (Q10)</Th>
                <Th>Channel</Th>
                <Th>Cohort</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r: SurveyResponse) => (
                <tr
                  key={r.id}
                  className="border-b border-line/60 align-top last:border-0 hover:bg-canvas/50"
                >
                  <Td>
                    <SentimentTag sentiment={r.q10_sentiment} />
                  </Td>
                  <Td className="max-w-xl text-ink">
                    &ldquo;{r.q10_text}&rdquo;
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {CHANNEL_LABEL[r.source]}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {r.q2_asset_class} · {r.q3_tenure}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {fmtDate(r.submitted_at)}
                  </Td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-muted">
                    No feedback matches the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-xs text-muted">
          <span>
            {filtered.length === 0
              ? "0 records"
              : `Showing ${current * PAGE_SIZE + 1}–${
                  current * PAGE_SIZE + slice.length
                } of ${filtered.length.toLocaleString()} records`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              className="rounded border border-line px-2 py-1 disabled:opacity-40 enabled:hover:bg-canvas"
            >
              ← Prev
            </button>
            <span>
              Page {current + 1} of {pageCount}
            </span>
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
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-2.5 ${className ?? ""}`}>{children}</td>;
}
