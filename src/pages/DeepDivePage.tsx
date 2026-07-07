// Pages 2-4 — typology deep-dive capture feeds. Each screen is the SAME
// component, parameterised by a DeepDivePage config entry that names a
// respondent COHORT (construction-adjacent, or completed-building BTR/BTS
// residents). Responses are filtered to that cohort; the thematic impact columns
// (Q4-Q9) use abstracted headers. Adding a screen = adding a config entry.

import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { PageHeader, Card } from "@/components/ui";
import { CaptureFeedTable } from "@/components/CaptureFeedTable";
import { WhatPeopleWant } from "@/components/WhatPeopleWant";
import { scoreState } from "@/components/ScoreBadge";
import { Ring } from "@/components/charts";
import { useApp } from "@/state/AppContext";
import {
  DEEP_DIVE_PAGES,
  IMPACT_THEMES,
  impactHeader,
  matchesCohort,
  type ImpactColumn,
} from "@/config/defensiveDesign";
import type { SurveyResponse } from "@/data/types";

function themeAverage(rows: SurveyResponse[], col: ImpactColumn): number {
  if (rows.length === 0) return 0;
  return rows.reduce((a, r) => a + Number(r[col] ?? 0), 0) / rows.length;
}

export function DeepDivePage() {
  const { slug } = useParams();
  const { responses } = useApp();
  const page =
    DEEP_DIVE_PAGES.find((p) => p.slug === slug) ?? DEEP_DIVE_PAGES[0];

  // Filter the (already Q1-Q3 filtered) responses down to this cohort.
  const cohort = useMemo(
    () => responses.filter((r) => matchesCohort(r, page)),
    [responses, page]
  );

  const themes = IMPACT_THEMES.filter((t) => page.columns.includes(t.column));

  return (
    <div>
      <PageHeader
        title={page.title}
        subtitle={`${page.description} · ${cohort.length.toLocaleString()} records`}
      />

      {/* "This is what people want" — desired interventions for this cohort.
          Bound to question codes, so a changed prompt reuses the same slot. */}
      {page.wantSlot && (
        <div className="mb-6">
          <WhatPeopleWant rows={cohort} slot={page.wantSlot} />
        </div>
      )}

      {/* Per-theme averages — abstracted headers, never literal question text. */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((t) => {
          const avg = themeAverage(cohort, t.column);
          return (
            <Card key={t.column} className="flex items-center gap-4 p-5">
              <Ring value={avg} max={100} state={scoreState(avg)} size={72} />
              <div>
                <p className="text-sm font-medium text-ink">{impactHeader(t)}</p>
                <p className="mt-1 text-xs text-muted">Cohort mean (0–100)</p>
              </div>
            </Card>
          );
        })}
      </div>

      <CaptureFeedTable rows={cohort} page={page} />

      <p className="mt-3 text-xs text-muted">
        Column headers are bound to broad thematic categories, decoupled from the
        underlying survey question text.
      </p>
    </div>
  );
}
