// "This is what people want" — a reusable intervention/preferences panel.
//
// Aggregates a cohort's chosen desired-offering answers (Field Q6B, or the
// Online Q10A/Q10B top-two split) into a ranked, at-a-glance list. Bound to
// question CODES via the WantSlot config, so if the underlying prompt changes
// the same slot keeps working with zero code changes.

import { Card } from "./ui";
import { tallyWants, type WantSlot } from "@/config/defensiveDesign";
import type { SurveyResponse } from "@/data/types";

export function WhatPeopleWant({
  rows,
  slot,
}: {
  rows: SurveyResponse[];
  slot: WantSlot;
}) {
  const wants = tallyWants(rows, slot);
  const total = wants.reduce((a, w) => a + w.count, 0);
  const max = wants.length ? wants[0].count : 1;

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{slot.title}</p>
          <p className="mt-0.5 text-xs text-muted">{slot.note}</p>
        </div>
        <p className="shrink-0 text-xs text-muted">
          {total.toLocaleString()} selections
        </p>
      </div>

      {wants.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          No intervention preferences captured for this cohort yet.
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {wants.map((w, i) => (
            <div key={w.label} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-muted">
                {i + 1}
              </span>
              <span className="w-60 shrink-0 truncate text-sm text-ink" title={w.label}>
                {w.label}
              </span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-line/60">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-brand"
                  style={{ width: `${(100 * w.count) / max}%` }}
                />
              </span>
              <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted">
                <span className="font-semibold text-ink">
                  {Math.round((100 * w.count) / (total || 1))}%
                </span>{" "}
                · {w.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
