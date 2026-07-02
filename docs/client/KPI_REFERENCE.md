# KPI Reference

*Data Monitoring Platform — how each headline KPI is defined and calculated.*

This reference describes the six standardized Page-1 KPIs, the survey questions
each draws on, the calculation method, and the traffic-light compliance
thresholds. The KPI list, weights and thresholds are configurable **live** in the
KPI Engine screen and are **provisional** pending final sign-off.

*(A formatted Word version is at `docs/client/KPI_Reference.docx`.)*

---

## 1. How every KPI is calculated

All KPIs use the same method so they're directly comparable on a 0–100 scale:

1. Each contributing survey question is answered on a **1–5 scale**.
2. Each answer is **normalized to 0–100** via `(raw − 1) ÷ 4 × 100` → 1=0, 2=25, 3=50, 4=75, 5=100.
3. For each KPI, every source question is **averaged** across the responses in view, then the source averages are **combined by their weights** (weighted average) — or taken directly for single-input KPIs.
4. The result is a 0–100 score; its colour is set by the KPI's thresholds.

**Compliance bands:** score ≥ Green → **GREEN (On track)** · ≥ Amber → **AMBER (Watch)** · otherwise → **RED (At risk)**.

> **Worked example — Public Realm Safety & Accessibility.** If the average
> normalized scores are Public Realm 70, Off-Peak Security 60, Public Space 65,
> the KPI = `0.40×70 + 0.35×60 + 0.25×65 = 65.3` → **Amber (Watch)** (45 ≤ 65.3 < 70).

---

## 2. The six KPIs at a glance

| # | KPI | Method | Inputs (weight) | Green | Amber |
|---|---|---|---|---|---|
| 1 | Local Health & Environmental Quality | Weighted average | Green Infra (0.6), Wellbeing Awareness (0.4) | ≥ 75 | ≥ 50 |
| 2 | Public Realm Safety & Accessibility | Weighted average | Public Realm (0.4), Off-Peak Security (0.35), Public Space (0.25) | ≥ 70 | ≥ 45 |
| 3 | Sustainable Mobility Integration | Direct | Recycling & Active Travel (1.0) | ≥ 70 | ≥ 45 |
| 4 | Sustainability Performance | Weighted average | Green Infra (0.7), Public Realm (0.3) | ≥ 72 | ≥ 48 |
| 5 | Community Wellbeing & Belonging | Weighted average | Wellbeing Awareness (0.5), Management Responsiveness (0.5) | ≥ 68 | ≥ 45 |
| 6 | Housing Affordability | Direct (placeholder) | Housing cost-to-income *(external, placeholder)* | ≥ 65 | ≥ 45 |

---

## 3. KPI definitions in detail

### 1. Local Health & Environmental Quality — *Environmental · pts*
Overall environmental and health quality of the development and its surroundings.

| Input question | Channel | Weight |
|---|---|---|
| Green Infrastructure & Efficiency | Online | 0.6 |
| Community & Wellbeing Awareness | Online | 0.4 |

**Formula:** `0.6·GreenInfra + 0.4·WellbeingAware` · **Thresholds:** Green ≥ 75 · Amber ≥ 50 · Red < 50

### 2. Public Realm Safety & Accessibility — *Public Realm · pts*
Perceived safety, security and quality of the shared public spaces around the development.

| Input question | Channel | Weight |
|---|---|---|
| Public Realm Contribution | Online | 0.40 |
| Off-Peak Security | Online | 0.35 |
| Public Space Sentiment | Field | 0.25 |

**Formula:** `0.40·PublicRealm + 0.35·Security + 0.25·PublicSpace` · **Thresholds:** Green ≥ 70 · Amber ≥ 45 · Red < 45

### 3. Sustainable Mobility Integration — *Mobility · pts*
Ease and uptake of low-carbon travel — recycling and active-travel infrastructure.

| Input question | Channel | Weight |
|---|---|---|
| Recycling & Active Travel | Online | 1.0 |

**Formula:** `ActiveTravel` · **Thresholds:** Green ≥ 70 · Amber ≥ 45 · Red < 45

### 4. Sustainability Performance — *Sustainability · pts*
Environmental efficiency and the development's contribution to a sustainable public realm.

| Input question | Channel | Weight |
|---|---|---|
| Green Infrastructure & Efficiency | Online | 0.7 |
| Public Realm Contribution | Online | 0.3 |

**Formula:** `0.7·GreenInfra + 0.3·PublicRealm` · **Thresholds:** Green ≥ 72 · Amber ≥ 48 · Red < 48

### 5. Community Wellbeing & Belonging — *Community · pts*
Sense of community and wellbeing, and confidence that management responds to residents.

| Input question | Channel | Weight |
|---|---|---|
| Community & Wellbeing Awareness | Online | 0.5 |
| Management Responsiveness | Online | 0.5 |

**Formula:** `0.5·WellbeingAware + 0.5·ManagementResponsiveness` · **Thresholds:** Green ≥ 68 · Amber ≥ 45 · Red < 45

### 6. Housing Affordability — *Housing · pts (placeholder)*
Housing cost-to-income affordability. **No survey question captures this yet** — currently a placeholder pending an external housing-data feed.

| Input | Channel | Weight |
|---|---|---|
| Housing cost-to-income *(external, placeholder)* | — | 1.0 |

**Formula:** `100 − normalize(cost-to-income ratio)` · **Thresholds:** Green ≥ 65 · Amber ≥ 45 · Red < 45

---

## 4. Survey questions used

| Question code | Question | Channel | Scale | GRESB ref |
|---|---|---|---|---|
| FS_PUBLIC_SPACE | Public Space Sentiment | Field | 1–5 | GRESB TC 6.1 |
| OL_GREEN_INFRA | Green Infrastructure & Efficiency | Online | 1–5 | — |
| OL_ACTIVE_TRAVEL | Recycling & Active Travel | Online | 1–5 | — |
| OL_SECURITY | Off-Peak Security | Online | 1–5 | — |
| OL_PUBLIC_REALM | Public Realm Contribution | Online | 1–5 | — |
| OL_GRIEVANCE | Management Responsiveness | Online | 1–5 | — |
| OL_WELLBEING_AWARE | Community & Wellbeing Awareness | Online | 1–5 | — |
| housing_cost_to_income | Housing cost-to-income *(external, placeholder)* | — | % | — |

---

## 5. Notes

- KPI list, source weights and thresholds are provisional and changeable **live** in the KPI Engine screen (no code changes).
- **Housing Affordability is a placeholder** — no survey question captures cost-to-income; it runs on synthesized data pending an external housing-data feed.
- **Categorical questions** (accessibility cohort, local proximity, top-2 offerings, energy awareness) are captured and stored but are currently **descriptive-only** and do not feed the KPI scores.
- Surveys run on a **quarterly cadence**; trends and history are bucketed by quarter (Q1–Q4).
