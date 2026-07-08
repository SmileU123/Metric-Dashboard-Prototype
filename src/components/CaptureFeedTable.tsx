// Category-Level Data Abstraction (Pages 2-4).
//
// Renders granular records for one deep-dive cohort. Columns are driven by the
// page config: verbatim categorical captures (proximity, offering chips, cohort
// id) + thematic impact scores + qualitative sentiment. Question references are
// F-/O- prefixed per channel; the redundant Asset Class column is dropped (the
// cohort is already fixed by the page you're on).

import { Card } from "./ui";
import { ScoreBadge, SentimentTag } from "./ScoreBadge";
import {
  IMPACT_THEMES,
  impactHeader,
  impactValue,
  prettyOffering,
  rawValue,
  type DeepDivePage,
  type RawColumn,
} from "@/config/defensiveDesign";
import type { SurveyResponse } from "@/data/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}

const formatRaw = (code: string, val: string) =>
  code.toUpperCase().includes("OFFERING") ? prettyOffering(val) : val;

// One verbatim/normalized capture cell (proximity, offering, cohort score, text).
function RawCell({ col, r }: { col: RawColumn; r: SurveyResponse }) {
  if (col.normalized) {
    const score = r.scores?.[col.code.toLowerCase()];
    return (
      <Td>
        {score == null ? (
          <span className="text-muted">—</span>
        ) : (
          <ScoreBadge value={Number(score)} />
        )}
      </Td>
    );
  }
  const val = rawValue(r, col.code);
  const empty = <span className="text-muted">—</span>;
  if (col.wide) {
    return (
      <Td className="min-w-[15rem] max-w-sm text-ink">
        {val ? <>&ldquo;{formatRaw(col.code, val)}&rdquo;</> : empty}
      </Td>
    );
  }
  return (
    <Td className="whitespace-nowrap text-ink">
      {val ? formatRaw(col.code, val) : empty}
    </Td>
  );
}

export function CaptureFeedTable({
  rows,
  page,
  limit = 40,
}: {
  rows: SurveyResponse[];
  page: DeepDivePage;
  limit?: number;
}) {
  const themes = IMPACT_THEMES.filter((t) => page.columns.includes(t.column));
  const rawCols = page.rawColumns ?? [];
  const beforeCols = rawCols.filter((c) => (c.place ?? "before") === "before");
  const afterCols = rawCols.filter((c) => c.place === "after");
  const showTenure = page.showTenure ?? page.channel === "online";
  const shown = rows.slice(0, limit);
  const colCount = 1 + (showTenure ? 1 : 0) + rawCols.length + themes.length + 1;

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/60 text-left">
              <Th>Captured</Th>
              {showTenure && <Th>Tenure</Th>}
              {beforeCols.map((c) => (
                <Th key={c.code} className="whitespace-nowrap">
                  {c.header}
                </Th>
              ))}
              {themes.map((t) => (
                <Th key={t.column} className="whitespace-nowrap">
                  {impactHeader(t)}
                </Th>
              ))}
              {afterCols.map((c) => (
                <Th key={c.code} className="whitespace-nowrap">
                  {c.header}
                </Th>
              ))}
              <Th>Qualitative Feedback</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.id}
                className="border-b border-line/60 align-top last:border-0 hover:bg-canvas/50"
              >
                <Td className="whitespace-nowrap text-muted">
                  {fmtDate(r.submitted_at)}
                </Td>
                {showTenure && <Td className="text-muted">{r.q3_tenure}</Td>}
                {beforeCols.map((c) => (
                  <RawCell key={c.code} col={c} r={r} />
                ))}
                {themes.map((t) => (
                  <Td key={t.column}>
                    <ScoreBadge value={impactValue(r, t.column)} />
                  </Td>
                ))}
                {afterCols.map((c) => (
                  <RawCell key={c.code} col={c} r={r} />
                ))}
                <Td>
                  <SentimentTag sentiment={r.q10_sentiment} />
                </Td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td
                  colSpan={colCount}
                  className="p-8 text-center text-sm text-muted"
                >
                  No records match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="border-t border-line px-4 py-2 text-xs text-muted">
          Showing {limit} of {rows.length.toLocaleString()} records.
        </div>
      )}
    </Card>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted ${className ?? ""}`}
    >
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
