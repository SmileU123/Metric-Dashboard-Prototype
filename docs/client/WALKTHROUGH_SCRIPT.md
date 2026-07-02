# Walkthrough script (Loom / live demo) — ~3–4 minutes

> Goal: let Josh *see* the working platform so decisions get easy. Keep it tight,
> lead with the KPIs, end by pointing at the decisions email. Talk to outcomes,
> not tech.

**Before recording:** `npm run dev`, open the app, pick a tenant (e.g. Northgate),
have the decisions email open to reference at the end.

---

**0:00 — Intro (15s)**
"Hi Josh — quick tour of the Phase‑1 platform. This is running live against the
database, with your mock survey data flowing all the way through to the KPIs."

**0:15 — Page 1: Portfolio Metrics (45s)**
- "Six standardized headline KPIs, each as a dial with a traffic‑light state and a
  quarter‑on‑quarter trend."
- Point to the summary strip: responses, positive sentiment, KPIs on track / at risk.
- Point to the cohort‑mix and sentiment‑distribution cards.
- Switch tenant in the top bar: "It's white‑label — same layout, re‑skins per client."

**1:00 — Filters + deep dives (40s)**
- Change an Age / Asset‑State / Tenure filter: "Filtering runs on the backend and
  updates every screen."
- Open a deep‑dive (Construction‑Adjacent, then Build‑to‑Rent): "Pages 2–4 are the
  respondent cohorts — each shows that channel's questions and the granular records."

**1:40 — Open Feedback / Page 4 (45s)**
- "The qualitative ledger — paginated at 30, with sentiment, channel and search filters."
- Point to the theme chart: "Recurring themes with mention counts and dominant
  sentiment." Click a red theme: "Click any theme to filter the table to those
  responses — investigative power for the asset managers."

**2:25 — Raw Survey Data (30s)**
- "Every captured question, field and online." Toggle Field ↔ Online.
- Toggle Raw → Numeric → 0–100: "We keep the raw capture *and* the normalized value —
  nothing's overwritten."

**2:55 — KPI Engine (45s)**
- "This is the configurable engine. Each KPI is data, not code."
- Edit a weight or threshold: "Change it here and Page 1 recomputes instantly."
- Point to the run‑log line: records in, execution time — "full audit trail."
- "Adding or retiring a KPI is a form, not a rebuild."

**3:40 — Close (20s)**
"That's the Phase‑1 loop end‑to‑end. I've sent a short email with a few decisions —
mostly with a suggested default, so a quick yes keeps us moving into Phase 2.
Thanks Josh."
