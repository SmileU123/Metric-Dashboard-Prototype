# Data Monitoring Platform

A multi-tenant, white-label **data monitoring platform** built around a *Defensive
Design* strategy: every label, metric binding, and theme token is driven by
config or data, so a client can reassign metrics and re-skin tenants **without
code changes**.

This repository currently delivers **Phase 1 — Modular Dashboard Configuration &
Data Target Mapping**, plus the backend schema foundations (multi-tenant tables,
Row-Level Security, and the anonymized macro pool) that Phases 2–3 build on.

> The brief references Base44 "or a similar full-stack AI engine." This build
> uses a conventional, fully-owned stack (React + Supabase/Postgres) so the
> dual-stream isolation (Phase 3) can use **genuine database Row-Level
> Security** rather than a no-code approximation.

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vite + React 18 + TypeScript | Fast dev loop, type-safe data contracts |
| Styling | Tailwind CSS (CSS-variable tokens) | Runtime white-label re-theming |
| Routing | react-router-dom | Multi-page dashboard |
| Backend | Supabase (Postgres) | Native Row-Level Security + auth + multi-tenant |
| Data access | `@supabase/supabase-js` | Typed client, RLS-aware queries |

**The app runs with or without a backend.** If `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` are unset, it serves a deterministic built-in seed
dataset (`src/data/seed.ts`) so the dashboard is always demoable. A badge in the
header shows **Live** vs **Seed data**.

---

## 2. Quick start

```bash
npm install
npm run dev            # http://localhost:5173  (runs on seed data out of the box)
```

### Go live against Supabase (optional)

```bash
npx supabase init          # creates supabase/config.toml (won't touch migrations)
npx supabase start         # local Postgres + APIs via Docker
npx supabase db reset      # applies supabase/migrations/* incl. seed data
```

Then copy `.env.example` to `.env` and fill in the local URL + anon key printed
by `supabase start`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from `supabase start`>
```

> Note: with Supabase connected, Stream A tables are **RLS-protected**, so reads
> require an authenticated user who is a member of the tenant (see §5). The
> anonymized **Stream B** views are readable without membership by design.

### Scripts

| Script | Action |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type-check + production build |
| `npm run db:reset` | Reapply migrations + seed (local Supabase) |
| `npm run db:types` | Regenerate `src/data/database.types.ts` from the live schema |

---

## 3. Architecture layout

```
src/
├─ config/
│  ├─ defensiveDesign.ts   # ★ single source of truth for all Q1–Q10 labels & bindings
│  └─ theme.ts             # white-label token application
├─ data/
│  ├─ types.ts             # domain contracts (mirror the SQL schema)
│  ├─ seed.ts              # deterministic offline dataset (mirrors 0004/0005 seed)
│  ├─ kpiEngine.ts         # ★ in-app KPI engine (mirror of recompute_kpis())
│  └─ repository.ts        # ★ the ONLY data seam: Supabase OR seed, + Q1–Q3 filtering
├─ lib/
│  └─ supabaseClient.ts    # client + isSupabaseConfigured switch
├─ state/
│  └─ AppContext.tsx       # active tenant, filters, loaded data; re-themes on switch
├─ components/             # MetricCard, charts, TrafficLight, FilterBar, CaptureFeedTable, …
├─ pages/
│  ├─ OverviewPage.tsx     # Page 1 — six KPI slots (varied charts) + engine audit
│  ├─ DeepDivePage.tsx     # Pages 2–4 — cohort capture feeds (config-parameterised)
│  ├─ QualitativePage.tsx  # Q10 — open feedback + sentiment
│  └─ KpiEnginePage.tsx    # KPI engine config + formula + thresholds + run log
└─ App.tsx                 # routes + shell

supabase/migrations/
├─ 0001_init_multitenant.sql   # tenants, projects, members, survey_responses (Q1–Q10)
├─ 0002_rls_stream_a.sql       # Row-Level Security policies (per-tenant isolation)
├─ 0003_stream_b_macro_pool.sql# anonymized cross-tenant analytical views
├─ 0004_seed.sql               # demo tenants / projects / survey responses
└─ 0005_kpi_engine.sql         # ★ KPI engine: 6 config tables + recompute_kpis()
```

### The "Defensive Design" mapping (why this is resilient)

| Brief requirement | Where it lives | Change without touching code? |
|---|---|---|
| **6 Page-1 KPIs** bound to `metric_title` / `metric_value` / `compliance_state` | KPI engine tables → `runKpiEngine()` → `MetricCard` | ✅ `INSERT/UPDATE` KPI config |
| **KPI inputs, weights, formula, thresholds** | `kpi_sources` / `kpi_formula` / `kpi_thresholds` | ✅ config rows (no code) |
| **Per-KPI chart type** | `KPI_VIZ` in `defensiveDesign.ts` | ✅ one map entry |
| **Q4–Q9 thematic column headers** (e.g. "Public Realm Safety & Access (Q5)") | `IMPACT_THEMES` in `defensiveDesign.ts` | ✅ edit one array entry |
| **Pages 2–4 respondent cohorts** | `DEEP_DIVE_PAGES` in `defensiveDesign.ts` | ✅ edit one array entry |
| **Q1–Q3 contextual filters** | `FILTER_DEFS` in `defensiveDesign.ts` | ✅ edit one array entry |
| **Q10 280-char + sentiment tag** | `survey_responses.q10_*` + `SentimentFeed` | ✅ hard cap enforced in DB + config |
| **White-label theming** | `branding` JSON per tenant → CSS variables | ✅ data change |

The survey columns `q1…q10` are **structurally fixed** (per the brief's "Core
Architectural Pillars"); only their *presentation* is decoupled. So survey
wording can change post-pitch with zero migration.

---

## 4. Data model & API connections

### Core tables (`0001_init_multitenant.sql`)

- **`tenants`** — white-label developer clients (`id` slug, `name`, `branding`).
- **`projects`** — developments per tenant. Carries `completion_date` +
  `retention_expires_at` for the **6-month post-completion purge policy**
  (access granted during report creation, revoked 6 months after completion).
- **`tenant_members`** — `(tenant_id, user_id, role)`; backbone of RLS.
- **`survey_responses`** — canonical capture table. `Q1–Q3` contextual columns,
  `Q4–Q9` impact scores (0–100), `housing_cost_to_income` (%), `Q10` text (≤280,
  DB-enforced) + sentiment. Also carries **`respondent_typology`**
  (`construction_adjacent` | `resident_completed`) and **`delivery_model`**
  (`build_to_rent` | `build_to_sell`) — these drive the Pages 2–4 cohort
  screens — plus `source` and `utm` for the Phase 2 channels.
The Page-1 KPIs are driven by the **KPI engine** (see below), not a flat metrics
table.

### KPI Engine (`0005_kpi_engine.sql`)

A configurable calculation pipeline — every KPI is *data*, retuned with
`INSERT`/`UPDATE`, never code:

```
survey rows → KPI_Sources (weight + transform) → KPI_Formula → KPI_Thresholds
            → KPI_Result (Page 1 reads) → KPI_RunLog (audit)
```

| Table | Role |
|---|---|
| `kpi_definition` | master config (name, code, category, calc type, composite, `display_order`); global when `tenant_id IS NULL` |
| `kpi_sources` | what feeds a KPI: `source_key` (survey column) + `weight` + `transformation` |
| `kpi_formula` | how sources combine (`weighted_average` / `ratio` / `index`) + normalization |
| `kpi_thresholds` | compliance bands: `green_min` / `amber_min` / `red_min` |
| `kpi_result` | runtime output Page 1 reads (`value`, `compliance_state`, `data_period`) |
| `kpi_runlog` | audit: `input_records_count`, `execution_time_ms`, `status`, version |

`recompute_kpis(tenant, project, period)` is the server-side engine (the Phase-3
scheduled/batch path). The app ships a **TypeScript mirror**
(`src/data/kpiEngine.ts`, `runKpiEngine()`) so Page 1 recomputes **interactively
under the Q1–Q3 filters** and works with zero backend. Both produce identical
results; the run-log is surfaced on Page 1 and the **KPI Engine** screen.

The six seeded KPIs (composite weighted averages of Q4–Q9, plus a Housing
Affordability index that *inverts* cost-to-income via a source `transformation`)
are **standardized/global**; a tenant may add its own. *Provisional — client is
refining the KPI list.*

### Cohorts (client-confirmed)

- **Pages 2–4 — respondent cohorts**: Construction-Adjacent · Completed Build-to-Rent
  · Completed Build-to-Sell (via `respondent_typology` + `delivery_model`).
- **Benchmarking is out of scope** for now (no cross-portfolio data yet); clients
  see only their own project data. Stream B remains a Phase-3 foundation.

### Client → backend calls (`src/data/repository.ts`)

| Function | Supabase call | Seed fallback |
|---|---|---|
| `fetchTenants()` | `from('tenants').select(...)` | `SEED_TENANTS` |
| `fetchKpiConfig(tenantId)` | `kpi_definition` (global + tenant) + its `kpi_sources`/`kpi_formula`/`kpi_thresholds` | `SEED_KPI_CONFIG` |
| `fetchResponses(tenantId, filters)` | `from('survey_responses')…eq(...).eq(Q1–Q3)` | filtered `SEED_RESPONSES` |

The KPI engine (`runKpiEngine`) runs identically over both sources, and cohort
segmentation for Pages 2–4 is applied in the page via `matchesCohort()`.

### External channels (Phase 2 — scaffolded, not yet wired)

- **Digital public channel (MailChimp / Typeform):** inbound responses land in
  `survey_responses` with `source='digital_public'` and `utm` populated from
  outbound URL parameters (`?utm_source=…&utm_campaign=…`).
- **Offline-first field channel:** a zero-keyboard PWA caches submissions in
  **IndexedDB** and syncs to `survey_responses` with `source='field_pwa'` when
  connectivity returns.

---

## 5. Dual-stream synchronization rules

This is the heart of Phase 3; the schema foundations are already in place.

### Stream A — granular, tenant-isolated (`0002_rls_stream_a.sql`)

- Every tenant-scoped table has **Row-Level Security ENABLED**.
- A signed-in user can only read/write rows for tenants listed in
  `tenant_members` for their `auth.uid()` (enforced via
  `current_tenant_ids()`).
- There is **no cross-tenant read path** in Stream A — a frontend bug cannot
  widen access beyond a user's memberships.

### Stream B — anonymized macro pool (`0003_stream_b_macro_pool.sql`)

- `macro_pool` is a **deliberately cross-tenant, de-identified** view: it drops
  `tenant_id`, drops the Q10 free text (keeping only the sentiment label), and
  generalizes the timestamp to a **month bucket**. There is **no join key back
  to a tenant**.
- `macro_theme_monthly` pre-aggregates thematic sentiment by month / asset
  class for macro trend analysis.
- Both Stream B views are granted to read-only roles, because anonymized
  aggregate signal is the shared analytical surface.

### Synchronization rule (one write → two destinations)

```
            ┌─────────────────────────── Stream A (Row-Level Security)
            │   survey_responses          → per-tenant, identified, full Q1–Q10
capture ────┤
            │   macro_pool / *_monthly    → cross-tenant, de-identified projection
            └─────────────────────────── Stream B (anonymized macro pool)
```

- **Phase 1 (now):** Stream B is a *view* over the same rows — a single source of
  truth with two projections. This proves the contract: identified data stays
  behind RLS, the macro surface exposes only de-identified columns.
- **Phase 3 (planned):** replace the views with an **event-driven split
  controller** that, on each insert, writes the identified row to Stream A and
  an **irreversibly anonymized** copy (one-way hash / k-anonymized buckets, free
  text stripped) into a *physically separate* Stream B table — so the macro pool
  has no recoverable link to a tenant or respondent even at the storage layer.

---

## 6. Roadmap

- **Phase 1 (this repo):** modular dashboard, defensive bindings, multi-tenant
  schema, RLS + anonymized views, seed data. ✅
- **Phase 2:** zero-keyboard PWA capture (IndexedDB offline cache) + MailChimp/
  Typeform URL-parameter attribution.
- **Phase 3:** event-driven split controller; irreversible Stream B
  anonymization; production auth + tenant onboarding.

---

## 7. Notes for the next developer

- All Q1–Q10 presentation lives in `src/config/defensiveDesign.ts`. Start there.
- The UI imports data **only** through `src/data/repository.ts`. Keep that seam.
- Run `npm run build` before committing — it type-checks the whole app.
