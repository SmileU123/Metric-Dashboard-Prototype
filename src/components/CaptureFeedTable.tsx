// Category-Level Data Abstraction (Pages 2-4).
//
// Renders granular records with column headers labelled by BROAD THEMATIC
// CATEGORY (e.g. "Spatial Transit Sentiment (Q4)") rather than the literal
// survey question. Header text comes from the Defensive Design config, so survey
// wording can change post-pitch without touching this table.

import { Card } from "./ui";
import { ScoreBadge, SentimentTag } from "./ScoreBadge";
import {
  IMPACT_THEMES,
  impactHeader,
  impactValue,
  type ImpactColumn,
} from "@/config/defensiveDesign";
import type { SurveyResponse } from "@/data/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}

export function CaptureFeedTable({
  rows,
  columns,
  limit = 40,
}: {
  rows: SurveyResponse[];
  columns: ImpactColumn[]; // which Q4-Q9 themes this screen surfaces
  limit?: number;
}) {
  const themes = IMPACT_THEMES.filter((t) => columns.includes(t.column));
  const shown = rows.slice(0, limit);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/60 text-left">
              <Th>Captured</Th>
              <Th>Asset Class (Q2)</Th>
              <Th>Tenure (Q3)</Th>
              {themes.map((t) => (
                <Th key={t.column} className="whitespace-nowrap">
                  {impactHeader(t)}
                </Th>
              ))}
              <Th>Sentiment (Q10)</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.id}
                className="border-b border-line/60 last:border-0 hover:bg-canvas/50"
              >
                <Td className="whitespace-nowrap text-muted">
                  {fmtDate(r.submitted_at)}
                </Td>
                <Td>{r.q2_asset_class}</Td>
                <Td className="text-muted">{r.q3_tenure}</Td>
                {themes.map((t) => (
                  <Td key={t.column}>
                    <ScoreBadge value={impactValue(r, t.column)} />
                  </Td>
                ))}
                <Td>
                  <SentimentTag sentiment={r.q10_sentiment} />
                </Td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td
                  colSpan={themes.length + 4}
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
