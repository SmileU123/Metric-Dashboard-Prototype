# KPI Engine — Model Schema

Configurable, multi-tenant KPI calculation engine. Every KPI is **data, not code**:
its inputs, weights, formula and thresholds live in config tables, so KPIs are
added or retuned with `INSERT`/`UPDATE` (or from the in-app **KPI Engine** page) —
never a code change.

Implemented in [`supabase/migrations/0005_kpi_engine.sql`](../supabase/migrations/0005_kpi_engine.sql)
(+ `unit` in `0008_kpi_unit.sql`), mirrored in the browser by
[`src/data/kpiEngine.ts`](../src/data/kpiEngine.ts).

---

## 1. Data flow

```
 Survey Data (Q1–Q10, survey_responses)
        │
        ▼
 KPI_Sources      what feeds each KPI  →  source_key + weight + transformation
        │
        ▼
 KPI_Formula      how sources combine  →  weighted_average / ratio / index
        │
        ▼
 KPI_Thresholds   compliance bands     →  green_min / amber_min / red_min
        │
        ▼
 KPI_Result       runtime output       →  value + compliance_state + period   (Page 1 reads this)
        │
        ▼
 KPI_RunLog       audit / debug        →  records_in, exec_ms, version, status
```

## 2. Entity relationships

```
tenants ──1:N── projects
   │                │
   │ (tenant_id,    │ (project_id, nullable)
   │  nullable =    │
   │  global KPI)   │
   ▼                ▼
kpi_definition ─1:N─ kpi_sources        (what feeds the KPI)
      │        ─1:1─ kpi_formula         (how they combine)
      │        ─1:1─ kpi_thresholds      (compliance bands)
      │        ─1:N─ kpi_result          (computed outputs over time)
      └─────────1:N─ kpi_runlog          (audit of each engine run)

survey_responses ──(read by the engine)──▶ kpi_result
```

`kpi_sources`, `kpi_formula`, `kpi_thresholds`, `kpi_result` all reference
`kpi_definition(id)` with **`ON DELETE CASCADE`** — deleting a KPI removes its
whole config and results. `kpi_runlog.kpi_id` is `ON DELETE SET NULL` (audit rows
survive KPI deletion).

---

## 3. Tables

### 3.1 `kpi_definition` — master config

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `tenant_id` | text → `tenants.id`, nullable | **NULL = global/standardized KPI** applied to all tenants; set = tenant-specific override |
| `project_id` | uuid → `projects.id`, nullable | NULL = all projects |
| `kpi_code` | text | machine code, e.g. `PR_SAFETY_ACCESS` |
| `kpi_name` | text | display name |
| `description` | text | |
| `category` | text | e.g. `public_realm`, `mobility`, `housing` |
| `unit` | text, default `'pts'` | display suffix — `pts`, `%`, `score`, … |
| `unit_type` | text, default `'points'` | semantic kind — `score` \| `percentage` \| `ratio` \| `points` |
| `display_format` | text, default `'fixed_1dp'` | rendering — `raw` \| `percent` \| `fixed_1dp` |
| `calculation_type` | text | `weighted_average` \| `weighted_sum` \| `ratio` \| `index` \| `direct` — **executed distinctly by the engine** (see §4) |
| `is_composite` | boolean | true if it aggregates multiple sources |
| `is_active` | boolean | inactive KPIs are excluded from computation |
| `display_order` | smallint | slot order on Page 1 |
| `created_at` | timestamptz | |

Unique: one global KPI per `kpi_code`, and at most one per `(tenant_id, kpi_code)`.

### 3.2 `kpi_sources` — what feeds the KPI

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `kpi_id` | uuid → `kpi_definition.id` (cascade) | |
| `source_type` | text | `survey` \| `external` \| `computed` |
| `source_key` | text | survey column, e.g. `q4_score`, `housing_cost_to_income` |
| `weight` | numeric, default 1 | relative weight in the formula |
| `transformation` | text, default `passthrough` | see §5 |
| `is_active` | boolean | |

### 3.3 `kpi_formula` — how sources combine

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `kpi_id` | uuid → `kpi_definition.id` (cascade) | |
| `formula_type` | text | `weighted_sum` \| `weighted_average` \| `ratio` \| `index` \| `direct` |
| `expression` | text | human-readable, e.g. `Q4*0.6 + Q9*0.4` (**descriptive** — see note) |
| `normalization_min` | numeric, default 0 | output clamp |
| `normalization_max` | numeric, default 100 | output clamp |

> **Note:** the current engine computes a **weighted average of the (transformed)
> sources** — the `expression` string and `formula_type` are metadata for display
> and future formula-parsing. Retuning a KPI is done via `kpi_sources.weight`, not
> by editing the expression text.

### 3.4 `kpi_thresholds` — compliance engine

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `kpi_id` | uuid → `kpi_definition.id` (cascade) | |
| `condition_type` | text | `absolute` \| `percentage` \| `score_range` |
| `green_min` | numeric | value ≥ green_min → **green** |
| `amber_min` | numeric | value ≥ amber_min → **amber**, else **red** |
| `red_min` | numeric, default 0 | floor |
| `is_global` | boolean | |

Evaluation (higher-is-better): `value ≥ green_min ? green : value ≥ amber_min ? amber : red`.
Lower-is-better metrics (e.g. cost-to-income) are normalized to higher-is-better via a
source `transformation`, so this one rule covers every KPI.

### 3.5 `kpi_result` — runtime output (Page 1 reads this)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `kpi_id` | uuid → `kpi_definition.id` (cascade) | |
| `tenant_id` | text → `tenants.id` | |
| `project_id` | uuid → `projects.id`, nullable | |
| `value` | numeric | computed KPI value |
| `compliance_state` | text | `green` \| `amber` \| `red` |
| `data_period` | text, default `'live'` | e.g. `2026-Q2` for a snapshot |
| `calculated_at` | timestamptz | |

### 3.6 `kpi_runlog` — audit / debug

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `kpi_id` | uuid → `kpi_definition.id`, `ON DELETE SET NULL` | |
| `tenant_id` | text → `tenants.id`, nullable | |
| `input_records_count` | integer | rows fed into the run |
| `calculation_version` | text, default `'v1'` | |
| `execution_time_ms` | numeric | |
| `status` | text | `success` \| `failed` |
| `error_message` | text, nullable | |
| `created_at` | timestamptz | |

### 3.7 `kpi_timeseries` — execution history (quarterly snapshots)

Persisted **quarterly** history (`period = 'YYYY-Qn'`) that trend lines and drift
metrics read from in a scheduled/production setup — surveys run on a
quarterly/biannual cadence. Populated by `recompute_kpi_timeseries(tenant, quarters)`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `kpi_id` | uuid → `kpi_definition.id` (cascade) | |
| `tenant_id` | text → `tenants.id` | |
| `project_id` | uuid → `projects.id`, nullable | |
| `period` | text | `YYYY-Qn` (quarterly) |
| `value` | numeric | KPI value for that quarter |
| `compliance_state` | text | `green` \| `amber` \| `red` |
| `created_at` | timestamptz | |
| — unique — | `(kpi_id, tenant_id, period)` | one row per KPI/tenant/quarter |

**`kpi_drift`** (view, `security_invoker`) adds period-over-period change:
`value − lag(value) over (partition by kpi_id, tenant_id order by period)` as
`delta_vs_prev`.

> The Phase-1 UI computes **filtered** trends live from `survey_responses` (so
> Q1–Q3 filters stay interactive); `kpi_timeseries` is the **stored, unfiltered**
> history for reporting and the Phase-3 scheduled engine.

---

## 4. The engine

`recompute_kpis(tenant, project, period)` (PL/pgSQL) and `runKpiEngine()` (TypeScript)
apply the same algorithm, **branching on `calculation_type`**:

```
for each active KPI definition (global + tenant):
    for each active source:
        s_mean = avg( transform(source_key, transformation) )  over the in-scope survey rows
    value = combine(calculation_type):
        weighted_average / index → Σ(w·s_mean) / Σ(w)
        weighted_sum            → Σ(w·s_mean)
        direct                  → first source's mean
        ratio                   → 100 · mean₁ / mean₂
    value = clamp(value, normalization_min, normalization_max)
    state = green_min/amber_min evaluation
    write KPI_Result(value, state, period)      + KPI_RunLog(records_in, exec_ms, version, status)
```

- **Server path** (`recompute_kpis`): the Phase-3 scheduled/batch job that writes
  `kpi_result` snapshots per `data_period`.
- **Client path** (`runKpiEngine`): recomputes live in the browser over the
  **Q1–Q3-filtered** rows, so Page 1 stays interactive. Same logic, same numbers.

## 5. Transformations (`kpi_sources.transformation`)

| Value | Formula | Use |
|---|---|---|
| `passthrough` | `v` | 0–100 survey scores (Q4–Q9) |
| `normalize_1_5_to_0_100` | `(v − 1) / 4 · 100` | 1–5 Likert inputs → 0–100 |
| `invert_cost_to_income` | `clamp(100 − (v − 25)·3, 0, 100)` | turns a % cost-to-income ratio (lower better) into a 0–100 affordability score (higher better) |

New transformations are added in one place (engine `transform()` + the SQL `CASE`).

---

## 6. Seeded standardized KPIs (global, `tenant_id = NULL`)

| # | `kpi_code` | Sources (weight) | Formula | Green ≥ / Amber ≥ | Unit |
|---|---|---|---|---|---|
| 1 | `LOCAL_ENV_QUALITY` | Q4 (0.6), Q9 (0.4) | weighted_average | 75 / 50 | pts |
| 2 | `PR_SAFETY_ACCESS` | Q5 (0.7), Q8 (0.3) | weighted_average | 70 / 45 | pts |
| 3 | `SUS_MOBILITY` | Q6 (1.0) | direct | 70 / 45 | pts |
| 4 | `SUSTAINABILITY` | Q7 (0.7), Q4 (0.3) | weighted_average | 72 / 48 | pts |
| 5 | `COMMUNITY_WELLBEING` | Q8 (0.5), Q9 (0.5) | weighted_average | 68 / 45 | pts |
| 6 | `HOUSING_AFFORDABILITY` | housing_cost_to_income (1.0, `invert_cost_to_income`) | index | 65 / 45 | pts |

*(KPI list + thresholds are provisional per the client.)*

Survey impact columns feeding the sources (thematic, decoupled from question text):
`q4_score` Environmental & Health Quality · `q5_score` Public Realm Safety & Access ·
`q6_score` Sustainable Mobility · `q7_score` Sustainability & Energy ·
`q8_score` Community & Belonging · `q9_score` Wellbeing & Amenity ·
`housing_cost_to_income` (%).

---

## 7. Adding / editing a KPI

**Via SQL** — insert one `kpi_definition` row + its `kpi_sources` / `kpi_formula` /
`kpi_thresholds` rows. **Via the app** — the **KPI Engine** page (`/engine`) edits
weights, thresholds, unit, active state; adds and deletes KPIs; changes recompute
Page 1 instantly and persist to the database.

Example — a new tenant-specific composite:

```sql
insert into kpi_definition (tenant_id, kpi_code, kpi_name, category, unit, calculation_type, is_composite, display_order)
values ('northgate','NOISE_AIR','Noise & Air Quality','environmental','pts','weighted_average',true,7)
returning id;  -- use the returned id below

insert into kpi_sources (kpi_id, source_key, weight, transformation) values
  ('<id>','q4_score',0.5,'passthrough'),
  ('<id>','q7_score',0.5,'passthrough');
insert into kpi_formula (kpi_id, formula_type, expression) values
  ('<id>','weighted_average','Q4*0.5 + Q7*0.5');
insert into kpi_thresholds (kpi_id, green_min, amber_min) values
  ('<id>', 70, 45);
```

---

## 8. Security (Row-Level Security)

- **Config** (`kpi_definition` + children): global rows (`tenant_id IS NULL`) are
  readable by everyone; tenant rows only by that tenant's members.
- **Outputs** (`kpi_result`, `kpi_runlog`): tenant-scoped (Stream A isolation).
- **Phase 1 demo:** temporary `anon` read/write policies make the unauthenticated
  prototype editable; these are replaced by owner/analyst-restricted policies when
  Phase 2/3 auth lands.

---

## 9. Base44 mapping (if built there instead)

The model translates 1:1 to Base44 entities — each table below is one Base44
data entity, relationships are Base44 reference fields:

| This schema | Base44 entity | Key fields |
|---|---|---|
| `kpi_definition` | `KPI` | code, name, category, unit, calc type, is_active, order, `tenant` ref |
| `kpi_sources` | `KPI_Source` | `kpi` ref, source_key, weight, transformation |
| `kpi_formula` | `KPI_Formula` | `kpi` ref, formula_type, expression, norm min/max |
| `kpi_thresholds` | `KPI_Threshold` | `kpi` ref, green_min, amber_min |
| `kpi_result` | `KPI_Result` | `kpi` ref, `tenant` ref, value, state, period |
| `kpi_runlog` | `KPI_RunLog` | `kpi` ref, records_in, exec_ms, status |

The engine (`recompute_kpis`) becomes a Base44 automation/function; the traffic-light
and weighted-average logic port directly.

---

## 10. Notes on common review questions

- **Thresholds are per-KPI, not a global default.** Each KPI has its own
  `kpi_thresholds` row (e.g. 75/50, 70/45, 72/48). `is_global` means "applies to
  all *tenants*," not "same for all KPIs."
- **Respondent typology *is* a modeled analytics dimension**, via
  `survey_responses.respondent_typology` (`construction_adjacent` |
  `resident_completed`) + `delivery_model` (`build_to_rent` | `build_to_sell`).
  It drives the Pages 2–4 cohorts, the cohort-mix chart, and the
  `macro_theme_monthly` aggregate view.
- **Compliance is three states** (`green` / `amber` / `red`). "On track / Watch /
  At risk" are the display labels for those three — not a separate fourth state.
- **Server-side aggregation exists** in `macro_pool` / `macro_theme_monthly`
  (anonymized cross-tenant) and now `kpi_timeseries` / `kpi_drift` (per-tenant
  history + period-over-period change).
