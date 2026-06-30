// Q10 — Qualitative NLP engine screen. Open feedback (<=280 chars) with
// color-coded sentiment tags, plus the distribution summary.

import { PageHeader } from "@/components/ui";
import { SentimentFeed, SentimentSummary } from "@/components/SentimentFeed";
import { useApp } from "@/state/AppContext";

export function QualitativePage() {
  const { responses } = useApp();
  return (
    <div>
      <PageHeader
        title="Open Feedback (Q10)"
        subtitle="Hard-capped 280-character responses with backend sentiment tagging."
      />
      <div className="mb-6">
        <SentimentSummary rows={responses} />
      </div>
      <SentimentFeed rows={responses} />
    </div>
  );
}
