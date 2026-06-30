// Pages 2-4 — typology deep-dive capture feeds. Each screen is the SAME
// component, parameterised by a DeepDivePage config entry that names which
// thematic impact columns (Q4-Q9) to surface. Adding a screen = adding a config
// entry, not a new page.

import { useParams } from "react-router-dom";
import { PageHeader, Card } from "@/components/ui";
import { CaptureFeedTable } from "@/components/CaptureFeedTable";
import { ScoreBadge } from "@/components/ScoreBadge";
import { useApp } from "@/state/AppContext";
import {
  DEEP_DIVE_PAGES,
  IMPACT_THEMES,
  impactHeader,
  type ImpactColumn,
} from "@/config/defensiveDesign";

function themeAverage(
  rows: { [k: string]: unknown }[],
  col: ImpactColumn
): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((a, r) => a + Number(r[col] ?? 0), 0);
  return sum / rows.length;
}

export function DeepDivePage() {
  const { slug } = useParams();
  const { responses } = useApp();
  const page =
    DEEP_DIVE_PAGES.find((p) => p.slug === slug) ?? DEEP_DIVE_PAGES[0];

  const themes = IMPACT_THEMES.filter((t) => page.columns.includes(t.column));

  return (
    <div>
      <PageHeader title={page.title} subtitle={page.description} />

      {/* Per-theme averages — abstracted headers, never literal question text. */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {themes.map((t) => (
          <Card key={t.column} className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm font-medium text-muted">
                {impactHeader(t)}
              </p>
              <p className="mt-1 text-xs text-muted/70">
                Mean across {responses.length.toLocaleString()} records
              </p>
            </div>
            <ScoreBadge
              value={themeAverage(
                responses as unknown as { [k: string]: unknown }[],
                t.column
              )}
            />
          </Card>
        ))}
      </div>

      <CaptureFeedTable rows={responses} columns={page.columns} />

      <p className="mt-3 text-xs text-muted">
        Column headers are bound to broad thematic categories (
        {themes.map(impactHeader).join(", ")}), decoupled from the underlying
        survey question text.
      </p>
    </div>
  );
}
