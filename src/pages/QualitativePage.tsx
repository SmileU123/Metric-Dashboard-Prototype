// Q10 / Page 4 — Qualitative Feedback: a MULTI-STREAM text intake ledger.
//
// One entry per qualitative text ANSWER (not per response), aggregating every
// text stream — Field Q7 street-level remedies, Online Q3B cost & affordability
// drivers, Online Q10 estate improvements — so no stream is a data blackout.
// Controls: sentiment toggle, channel filter, QUESTION FILTER (isolate a
// stream), text search, clickable theme clusters, 30/page pagination.

import { useMemo, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { SentimentSummary } from "@/components/SentimentFeed";
import { SentimentTag } from "@/components/ScoreBadge";
import { useApp } from "@/state/AppContext";
import { extractThemes, responseMatchesTheme } from "@/config/textThemes";
import { TEXT_STREAMS, textStreamLabel } from "@/config/defensiveDesign";
import { cn } from "@/lib/cn";
import type {
  ResponseSource,
  Sentiment,
  SurveyResponse,
  TextAnswer,
} from "@/data/types";

const PAGE_SIZE = 30;

// A ledger entry: the parent response's envelope with the entry's own text and
// sentiment substituted, so theme matching and the sentiment summary work
// unchanged on entries.
type QualEntry = SurveyResponse & { entry_key: string; entry_question: string };

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
  // textAnswers comes from shared app state — the SAME source Page 1's Sentiment
  // Distribution card reads, so the two views are guaranteed to agree.
  const { responses, textAnswers } = useApp();

  const [sentiment, setSentiment] = useState<"all" | Sentiment>("all");
  const [channel, setChannel] = useState<"all" | ResponseSource>("all");
  const [question, setQuestion] = useState<"all" | string>("all");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Unified Sentiment Distribution: every qualitative text answer (incl. Online
  // Q3B), independent of the ledger filters — matches Page 1 exactly.
  const sentimentRows = useMemo(
    () =>
      textAnswers
        .filter((a) => a.sentiment)
        .map((a) => ({ q10_sentiment: a.sentiment as Sentiment })),
    [textAnswers]
  );

  // Multi-stream entries: join text answers onto the (globally Q1–Q3-filtered)
  // responses — one ledger entry per text answer.
  const entries = useMemo<QualEntry[]>(() => {
    const byResponse = new Map<string, TextAnswer[]>();
    for (const a of textAnswers) {
      const list = byResponse.get(a.response_id) ?? [];
      list.push(a);
      byResponse.set(a.response_id, list);
    }
    const out: QualEntry[] = [];
    for (const r of responses) {
      for (const a of byResponse.get(r.id) ?? []) {
        out.push({
          ...r,
          q10_text: a.text,
          q10_sentiment: a.sentiment ?? r.q10_sentiment,
          entry_key: `${r.id}:${a.question_code}`,
          entry_question: a.question_code,
        });
      }
    }
    return out;
  }, [responses, textAnswers]);

  // Cohort scope (sentiment + channel + question) — themes summarise this set.
  const cohort = useMemo(
    () =>
      entries.filter(
        (e) =>
          e.q10_text &&
          (sentiment === "all" || e.q10_sentiment === sentiment) &&
          (channel === "all" || e.source === channel) &&
          (question === "all" || e.entry_question === question)
      ),
    [entries, sentiment, channel, question]
  );

  const themes = useMemo(() => extractThemes(cohort, 8), [cohort]);

  // Ledger = cohort narrowed by the free-text search and the active theme.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cohort.filter(
      (e) =>
        (q === "" || e.q10_text.toLowerCase().includes(q)) &&
        (!theme || responseMatchesTheme(e, theme))
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
        subtitle="Cross-portfolio open-ended responses from both field and online surveys"
      />

      <div className="mb-6">
        <SentimentSummary rows={sentimentRows} />
      </div>

      {/* Thematic clustering — click a theme to filter the ledger below */}
      {themes.length > 0 && (
        <Card className="mb-4 p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-muted">
              Feedback Themes
            </p>
            <p className="text-xs text-muted">Click theme to filter...</p>
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
                  {/* Gauge = the dominant sentiment's share of this theme's
                      mentions (50% negative → half-filled red bar). */}
                  <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-line/60">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${th.pct}%`,
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

        {/* Question filter — isolate a qualitative stream */}
        <select
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            resetPage();
          }}
          className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          <option value="all">All questions</option>
          {TEXT_STREAMS.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
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
                <Th>Feedback</Th>
                <Th>Question</Th>
                <Th>Channel</Th>
                <Th>Cohort</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {slice.map((e) => (
                <tr
                  key={e.entry_key}
                  className="border-b border-line/60 align-top last:border-0 hover:bg-canvas/50"
                >
                  <Td>
                    <SentimentTag sentiment={e.q10_sentiment} />
                  </Td>
                  <Td className="max-w-xl text-ink">
                    &ldquo;{e.q10_text}&rdquo;
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {textStreamLabel(e.entry_question)}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {CHANNEL_LABEL[e.source]}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {e.q2_asset_class} · {e.q3_tenure}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {fmtDate(e.submitted_at)}
                  </Td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-muted">
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
              ? "0 entries"
              : `Showing ${current * PAGE_SIZE + 1}–${
                  current * PAGE_SIZE + slice.length
                } of ${filtered.length.toLocaleString()} entries across ${
                  question === "all" ? TEXT_STREAMS.length : 1
                } stream${question === "all" && TEXT_STREAMS.length > 1 ? "s" : ""}`}
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
