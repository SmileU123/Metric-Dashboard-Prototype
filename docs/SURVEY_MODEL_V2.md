# Survey Data Model v2 — Proposal

Upgrades the survey schema from the generic `q1…q10` columns to a **channel-aware,
catalogued model** that mirrors the DRAFT question architecture in
`Resources/Mock Data_Field Survey - Online Survey.xlsx` and keeps KPI↔question
tagging fully flexible.

Status: **APPROVED & IMPLEMENTED** (migrations 0001–0010). Decisions taken:
catalog + EAV; Private Ownership stubbed (inactive catalog entries); Housing
Affordability kept as a placeholder (synthesized cost-to-income, `invert`
transform); data = real open-text payloads + synthesized to ~350 rows. Requires
one live bundle run (`supabase/_run_in_sql_editor.sql`) to migrate the database.

---

## 1. Why change

Today `survey_responses` has fixed columns `q1_demographic … q9_score`,
`housing_cost_to_income`, `q10_*`. The real architecture is:

- **Two (soon three) channels with *different* question sets** — Field intercepts
  ask Q1–Q7; Online/QR asks a different battery; a *Private Ownership* sheet is
  coming. A single fixed column set can't represent this without either nulls
  everywhere or per-channel column sprawl.
- **KPI tagging must be re-pointable** ("which questions link to a KPI may
  change"). That's clean only if a KPI source references a *question*, not a
  hard column.
- **Open text needs thematic clustering** (Page 4 keyword bars) — easier from a
  first-class answers table.

## 2. Shape: envelope + question catalog + answers (EAV)

```
survey_questions  (catalog: one row per question, per channel)
        ▲ code
        │
survey_answers  (one row per answered question)  ── response_id ──►  survey_responses
   value_num / value_text / value_code / sentiment                    (the submission envelope)

kpi_sources.source_key  ──►  survey_questions.code      (KPI = weighted set of questions)
```

- **`survey_responses`** becomes the **envelope** (who/where/when + contextual
  filters), one row per submission.
- **`survey_answers`** holds the per-question values (EAV) — so any channel's
  questions fit, and new questions are data, not migrations.
- **`survey_questions`** is the catalog the UI and KPI engine read labels/themes
  from.

## 3. Tables

### 3.1 `survey_questions` — catalog
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text unique | `FS_Q4_PUBLIC_SPACE`, `OL_GREEN_INFRA`, … |
| `channel` | text | `field` \| `online` \| `private_ownership` \| `shared` |
| `seq` | int | display order within channel |
| `short_label` | text | e.g. "Public Space Sentiment" |
| `question_text` | text | full wording |
| `theme` | text | `public_realm` \| `mobility` \| `sustainability` \| `wellbeing` \| `grievance` \| `safety` \| `housing` \| `demographic` \| `proximity` \| `offering` \| `open_text` |
| `response_type` | text | `scale_1_5` \| `single_choice` \| `multi_choice` \| `yes_no` \| `numeric` \| `open_text` |
| `gresb_ref` | text null | e.g. "GRESB TC 6.1" |
| `options` | jsonb | choice codes → labels (for choice types) |
| `is_active` | boolean | |

### 3.2 `survey_responses` — envelope (redesigned)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | text → tenants | the `client_id` (CLN-xxxx) |
| `project_id` | uuid → projects | the `asset_id` (AST-xxxx) |
| `channel` | text | `field` \| `online` \| `private_ownership` |
| `asset_class_state` | text | `in_construction` \| `completed` |
| `tenure` | text null | `btr` \| `private_sale` \| `private_ownership` |
| `temporal_cohort` | text | `Q3-2026` (as captured) |
| `period_year` | int | derived (2026) |
| `period_quarter` | int | derived (3) — drives quarterly trends |
| `age` | numeric null | field captures raw age |
| `age_bracket` | text | `18-24`…`65+` (bucketed for both channels) |
| `occupancy_status` | text null | online: full_time_resident / part_time_commuter / local_business_employee / visitor_community |
| `accessibility_cohort` | smallint null | field Q2: 0–3 |
| `proximity` | text null | field Q3: DCW / LR / Occ_Ten / FTV_Passerby |
| `submitted_at` | timestamptz | |

> `respondent_typology` (construction_adjacent / resident_completed) is derived
> from `asset_class_state`; kept as a generated column or view for the Pages 2–4
> cohort screens so nothing downstream breaks.

### 3.3 `survey_answers` — per-question values (EAV)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `response_id` | uuid → survey_responses (cascade) | |
| `question_code` | text → survey_questions.code | |
| `value_num` | numeric null | scales / numeric |
| `value_text` | text null | open-text payloads |
| `value_code` | text null | chosen option code |
| `sentiment` | text null | for open_text: positive / neutral / negative |

Indexes on `(response_id)` and `(question_code)`.

## 4. Question mapping (from the mock workbook)

**Field Survey** → `channel = field`
| code | theme | type | maps to |
|---|---|---|---|
| `FS_AGE` | demographic | numeric | Q1 age |
| `FS_ACCESS_COHORT` | mobility | single_choice | Q2 accessibility (0–3) |
| `FS_PROXIMITY` | proximity | single_choice | Q3 (DCW/LR/Occ_Ten/FTV) |
| `FS_PUBLIC_SPACE` | public_realm | scale_1_5 | Q4 (GRESB TC 6.1) |
| `FS_GRIEVANCE` | grievance | scale_1_5 | Q5 (GRESB TC 6.1 / TISFD) |
| `FS_WELLBEING_AWARE` | wellbeing | single_choice | Q6 (Yes_POS/YES_NEG/NO_NEG) |
| `FS_OFFERING` | offering | single_choice | Q6-B chip |
| `FS_OPEN` | open_text | open_text | Q7 (280-char) |

**Online / QR** → `channel = online`
| code | theme | type | maps to |
|---|---|---|---|
| `OL_GREEN_INFRA` | sustainability | scale_1_5 | green infra & efficiency |
| `OL_ENERGY_KNOW` | sustainability | yes_no | knows energy settings |
| `OL_ACTIVE_TRAVEL` | mobility | scale_1_5 | recycling / active travel |
| `OL_SECURITY` | safety | scale_1_5 | off-peak security |
| `OL_PUBLIC_REALM` | public_realm | scale_1_5 | physical/social contribution |
| `OL_GRIEVANCE` | grievance | scale_1_5 | management listens/resolves |
| `OL_WELLBEING_AWARE` | wellbeing | scale_1_5 | aware of events/green space |
| `OL_OFFERING_1/2` | offering | multi_choice | top-2 chips |
| `OL_OPEN` | open_text | open_text | Q10 Part B |

## 5. KPI re-tag (source_key → question codes)

Sources become question codes; scales normalize 1–5 → 0–100 via the engine's
`normalize_1_5_to_0_100` transform.

| KPI | Proposed sources (weight) |
|---|---|
| Local Health & Environmental Quality | `OL_GREEN_INFRA` (0.6), `OL_WELLBEING_AWARE` (0.4) |
| Public Realm Safety & Accessibility | `FS_PUBLIC_SPACE` (0.4), `OL_PUBLIC_REALM` (0.35), `OL_SECURITY` (0.25) |
| Sustainable Mobility Integration | `OL_ACTIVE_TRAVEL` (1.0) |
| Sustainability Performance | `OL_GREEN_INFRA` (0.7), `OL_ENERGY_KNOW` (0.3, yes→100/no→0) |
| Community Wellbeing & Belonging | `OL_WELLBEING_AWARE` (0.5), `FS_WELLBEING_AWARE` (0.5, POS→100/NEG→0) |
| **Housing Affordability** | ⚠️ **no survey question exists** — needs a `source_type = 'external'` housing-data feed, or drop/replace this KPI |

> The engine already supports `source_type = 'external'` and choice→score
> transforms, so cross-channel + non-survey inputs fit without new engine concepts.

## 6. Migration & app impact (once approved)

1. New migration: `survey_questions`, redesigned `survey_responses`, `survey_answers`
   (+ RLS, + demo anon read). Keep a `v_survey_responses_flat` view (envelope ⋈
   pivoted answers) so existing queries/UI keep working during transition.
2. Engine (`recompute_kpis` + `runKpiEngine`): aggregate `survey_answers.value_num`
   by `question_code`; re-tag `kpi_sources`.
3. Seed: import the real 36 mock rows → envelope + answers, and synthesize up to
   ~350 for volume; keep quarterly `temporal_cohort` spread.
4. Frontend: deep-dive tables + Page-4 ledger read from the flat view; add the
   channel/theme columns.

## 7. Open decisions (need your call)

1. **Approach** — this catalog+EAV model (recommended) vs. per-channel wide tables
   vs. extending the current single table.
2. **Private Ownership** — model the third channel now (enum + questions
   stubbed) or defer until Josh sends the sheet.
3. **Housing Affordability KPI** — external data feed, or replace it with a
   survey-backed KPI (e.g. a "Grievance & Communication Confidence" index from
   `FS_GRIEVANCE` + `OL_GRIEVANCE`)?
4. **Data** — import the real mock rows (+ synthesize to ~350) or keep synthetic
   data shaped to the new model?
