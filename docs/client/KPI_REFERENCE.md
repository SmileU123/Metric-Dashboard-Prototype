# KPI Reference (Revised)

*Data Monitoring Platform — the client-revised six KPIs: definitions, sources,
formulas and thresholds.*

Reflects the **revised KPI set** and the updated three-sheet survey (Field
intercepts, Online BTR, Online Private Sale). All weights and thresholds remain
configurable **live** in the KPI Engine screen.

*(A formatted Word version is at `docs/client/KPI_Reference.docx`.)*

---

## 1. How every KPI is calculated

1. Scale questions are answered **1–5** and normalized to 0–100 via `(raw − 1) ÷ 4 × 100`.
2. **Scored categoricals** map to fixed values: Energy settings **Yes=100 / No=0**; Field wellbeing awareness **Yes_POS=100 / YES_NEG=50 / NO_NEG=0**.
3. Single-input KPIs take the source's mean directly; composites combine source means by weight.
4. **"50/50 by tenure"** KPIs average the metric separately for **BTR** and **Private Sale** residents, then take the midpoint — each tenure counts equally regardless of response volume.
5. The 0–100 result is coloured by the KPI's thresholds.

**Compliance bands:** score ≥ Green → **GREEN (On track)** · ≥ **40** → **AMBER (Watch)** · below 40 → **RED (At risk)**.

---

## 2. The six KPIs at a glance

| # | KPI | Method | Inputs (weight) | Green | Amber |
|---|---|---|---|---|---|
| 1 | Environmental Quality | Direct | Field Q4 (1.0) | ≥ 75 | ≥ 40 |
| 2 | Public Realm Safety & Accessibility | Weighted average | Online Q7 Public Realm (0.4), Online Q6 Security (0.35), Field Q4 (0.25) | ≥ 70 | ≥ 40 |
| 3 | Circularity & Mobility Integration | Direct | Online Q5 Recycling & Active Travel (1.0) | ≥ 70 | ≥ 40 |
| 4 | Sustainability Performance | Direct, **50/50 by tenure** | Online Q4 Energy-settings Yes/No (1.0) | ≥ 70 | ≥ 40 |
| 5 | Community Wellbeing & Belonging | Weighted average | Field Q6 awareness (0.5), Online Q9 awareness (0.5) | ≥ 65 | ≥ 40 |
| 6 | Operational Housing Affordability | Direct, **50/50 by tenure** | Online Q3 Cost Manageability (1.0) | ≥ 65 | ≥ 40 |

---

## 3. KPI definitions in detail

### 1. Environmental Quality — *Environmental · pts*
Dust, noise, air and mobility impact of the site, and mitigation efforts (plants, murals, etc.).
**Source:** Field Q4 — local environmental quality & physical impact (1–5).
**Formula:** `FS_Q4 (normalized)` · **Thresholds:** Green ≥ 75 · Amber ≥ 40

### 2. Public Realm Safety & Accessibility — *Public Realm · pts*
Perceived safety, security and quality of the shared public realm.
**Sources:** Online Q7 Public Realm Contribution (0.40) · Online Q6 Off-Peak Security (0.35) · Field Q4 Public Space Sentiment (0.25).
**Formula:** `0.40·PublicRealm + 0.35·Security + 0.25·PublicSpace` · **Thresholds:** Green ≥ 70 · Amber ≥ 40

### 3. Circularity & Mobility Integration — *Mobility · pts*
Intuitiveness and uptake of onsite recycling and active-travel infrastructure.
**Source:** Online Q5 — Recycling & Active Travel (1–5).
**Formula:** `OL_Q5 (normalized)` · **Thresholds:** Green ≥ 70 · Amber ≥ 40

### 4. Sustainability Performance — *Sustainability · pts · 50/50 by tenure*
Understanding of how to use the development's sustainability features.
**Source:** Online Q4 — "Do you know how to optimize your apartment's energy settings?" (**Yes=100 / No=0**).
**Formula:** `mean per tenure (BTR, Private Sale) → 50/50 average` · **Thresholds:** Green ≥ 70 · Amber ≥ 40

### 5. Community Wellbeing & Belonging — *Community · pts*
Awareness of community events, green space access and wellness initiatives (field + online).
**Sources:** Field Q6 Wellbeing/Offerings Awareness (**Yes_POS=100 / YES_NEG=50 / NO_NEG=0**) (0.5) · Online Q9 Community & Wellbeing Awareness (0.5).
**Formula:** `0.5·FieldAwareness + 0.5·OnlineAwareness` · **Thresholds:** Green ≥ 65 · Amber ≥ 40

### 6. Operational Housing Affordability — *Housing · pts · 50/50 by tenure*
Agreement with: *"I believe that the costs associated with living in this development are manageable and sustainable."* Scores 1–3 trigger the **Q3B open-text follow-up**.
**Source:** Online Q3 — Cost Manageability (agreement 1–5).
**Formula:** `mean per tenure (BTR, Private Sale) → 50/50 average` · **Thresholds:** Green ≥ 65 · Amber ≥ 40

---

## 4. Survey questions used

| Question code | Question | Channel | Scale / scoring | GRESB ref |
|---|---|---|---|---|
| FS_PUBLIC_SPACE | Field Q4 — environmental quality / public space | Field | 1–5 | GRESB TC 6.1 |
| FS_WELLBEING_AWARE | Field Q6 — wellbeing/offerings awareness | Field | Yes_POS/YES_NEG/NO_NEG → 100/50/0 | GRESB TC 6.1 |
| OL_COST_MANAGEABLE | Online Q3 — living costs manageable & sustainable | Online (BTR + Private Sale) | 1–5 | — |
| OL_COST_FOLLOWUP | Online Q3B — open-text follow-up when Q3 ≤ 3 | Online | text | — |
| OL_ENERGY_KNOW | Online Q4 — knows how to optimize energy settings | Online | Yes/No → 100/0 | — |
| OL_ACTIVE_TRAVEL | Online Q5 — recycling & active travel | Online | 1–5 | — |
| OL_SECURITY | Online Q6 — off-peak security | Online | 1–5 | — |
| OL_PUBLIC_REALM | Online Q7 — public realm contribution | Online | 1–5 | — |
| OL_WELLBEING_AWARE | Online Q9 — community & wellbeing awareness | Online | 1–5 | — |

---

## 5. Notes

- Thresholds are the **revised** set: green varies per KPI; amber is a uniform **40** floor.
- **Housing Affordability is now survey-backed** (Online Q3) — the earlier cost-to-income placeholder is retired.
- The Online survey runs identically for **BTR** and **Private Sale** residents (two sheets / QR codes); "by tenure" KPIs weight the two cohorts 50/50.
- The previous **Green Infrastructure & Efficiency** question was removed from the survey and is retired from the catalogue.
- **Field Q4 feeds two KPIs**: directly as Environmental Quality, and at 0.25 weight inside Public Realm Safety & Accessibility.
- All weights and thresholds remain editable live in the KPI Engine screen.
