// Traffic-light compliance indicator. One of the three variables every Page 1
// metric slot binds to (metric_title, metric_value, compliance_state).

import { cn } from "@/lib/cn";
import type { ComplianceState } from "@/data/types";

const STYLES: Record<ComplianceState, { dot: string; label: string }> = {
  green: { dot: "bg-green", label: "On track" },
  amber: { dot: "bg-amber", label: "Watch" },
  red: { dot: "bg-red", label: "At risk" },
};

export function TrafficLight({
  state,
  showLabel = false,
  className,
}: {
  state: ComplianceState;
  showLabel?: boolean;
  className?: string;
}) {
  const s = STYLES[state];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn("h-2.5 w-2.5 rounded-full ring-2 ring-white/0", s.dot)}
        aria-hidden
      />
      {showLabel && (
        <span className="text-xs font-medium text-muted">{s.label}</span>
      )}
      <span className="sr-only">{`Compliance state: ${s.label}`}</span>
    </span>
  );
}
