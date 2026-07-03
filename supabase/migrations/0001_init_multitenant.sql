-- =============================================================================
-- 0001_init_multitenant.sql
-- Core multi-tenant schema for the Data Monitoring Platform (Phase 1).
--
-- Domain: property-development impact surveys. Tenants are developer clients;
-- each has one or more development PROJECTS; each project collects survey
-- responses from distinct respondent TYPOLOGIES (construction-adjacent residents
-- vs. residents of completed Build-to-Rent / Build-to-Sell buildings).
--
-- Design notes:
--  * Survey questions Q1-Q10 are STRUCTURALLY FIXED columns (per the brief's
--    "Core Architectural Pillars"). Their *presentation* (titles, theme labels,
--    metric bindings) lives in config tables / the frontend, NOT in column names,
--    so survey wording can change post-pitch without a migration.
--  * Q1-Q3  -> contextual filters (demographic / asset class / tenure)
--  * Q4-Q9  -> generalized impact variables (0-100 thematic scores)
--  * Q10    -> qualitative free text (<=280 chars) + sentiment tag
--  * housing_cost_to_income -> quantitative %, feeds the "lower-is-better" KPI.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tenants (white-label developer clients)
-- -----------------------------------------------------------------------------
create table public.tenants (
  id          text primary key,                 -- slug, e.g. 'northgate'
  name        text not null,
  -- Branding tokens consumed by the white-label theme layer (see config/theme.ts)
  branding    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Projects (developments) — a tenant owns many. Retention is tracked here:
-- access is intended during report creation and for 6 months after completion,
-- after which the tenant's granular data should be exported + purged (Phase 3).
-- -----------------------------------------------------------------------------
create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        text not null references public.tenants(id) on delete cascade,
  name             text not null,
  status           text not null default 'active'
                     check (status in ('active','in_report','completed','archived')),
  completion_date        date,   -- when the development/report completes
  retention_expires_at   date,   -- typically completion_date + 6 months
  created_at       timestamptz not null default now()
);

create index projects_tenant_idx on public.projects (tenant_id);

-- -----------------------------------------------------------------------------
-- Tenant membership — maps Supabase auth users to the tenants they may read.
-- This table is the backbone of Stream A Row-Level Security.
-- -----------------------------------------------------------------------------
create table public.tenant_members (
  tenant_id  text not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'viewer' check (role in ('owner','analyst','viewer')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- -----------------------------------------------------------------------------
-- SURVEY MODEL v2 (see docs/SURVEY_MODEL_V2.md): question catalog + submission
-- envelope + per-question answers (EAV). Impact answers live in survey_answers;
-- the v_survey_flat view projects everything back to a wide row the app and KPI
-- engine read. Two channels (field, online) + a stubbed private_ownership.
-- -----------------------------------------------------------------------------

-- Question catalog
create table public.survey_questions (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  channel       text not null check (channel in ('field','online','private_ownership','shared')),
  seq           smallint not null default 0,
  short_label   text not null,
  question_text text not null default '',
  theme         text not null default 'general',
  response_type text not null default 'scale_1_5'
                  check (response_type in ('scale_1_5','single_choice','multi_choice','yes_no','numeric','open_text')),
  gresb_ref     text,
  options       jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true
);

-- Submission envelope (one row per response)
create table public.survey_responses (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text not null references public.tenants(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete cascade,

  channel       text not null default 'online'
                  check (channel in ('field','online','private_ownership')),
  source        text not null default 'digital_public'   -- legacy alias for the channel filter
                  check (source in ('field_pwa','digital_public')),
  asset_class_state text not null default 'completed'
                  check (asset_class_state in ('in_construction','completed')),
  tenure        text check (tenure in ('btr','private_sale','private_ownership')),

  -- Cohort dimensions (set on ingest; drive the Pages 2-4 deep-dives)
  respondent_typology text not null default 'resident_completed'
                  check (respondent_typology in ('construction_adjacent','resident_completed')),
  delivery_model text check (delivery_model in ('build_to_rent','build_to_sell')),

  temporal_cohort text not null default 'Q1-2026',        -- e.g. 'Q3-2026'
  period_year    smallint not null default 2026,
  period_quarter smallint not null default 1 check (period_quarter between 1 and 4),
  submitted_at   timestamptz not null default now(),

  -- Contextual filters (envelope dimensions)
  q1_demographic text,   -- age bracket
  q2_asset_class text,   -- asset state label
  q3_tenure      text,   -- tenure label

  -- Placeholder KPI input (no survey question exists — external in production)
  housing_cost_to_income real check (housing_cost_to_income between 0 and 100),

  -- Open text (Field Q7 / Online Q10) + sentiment
  q10_text         text check (char_length(q10_text) <= 280),
  q10_sentiment    text check (q10_sentiment in ('positive','neutral','negative')),
  q10_sentiment_score real check (q10_sentiment_score between -1 and 1)
);
create index survey_responses_tenant_idx    on public.survey_responses (tenant_id);
create index survey_responses_project_idx    on public.survey_responses (project_id);
create index survey_responses_typology_idx   on public.survey_responses (respondent_typology, delivery_model);
create index survey_responses_submitted_idx   on public.survey_responses (submitted_at desc);
create index survey_responses_cohort_idx      on public.survey_responses (period_year, period_quarter);

-- Per-question answers (EAV). Preserves the RAW captured value alongside its
-- numeric + normalized derivations, so nothing is overwritten:
--   value_raw        verbatim ('3', 'DCW', 'Yes_POS', open text, 'A | B')
--   value_raw_type   how to read value_raw (numeric / categorical / text / multi)
--   value_numeric    numeric interpretation in raw units (Likert 1-5, age years)
--   value_normalized 0-100 for cross-question KPI aggregation
create table public.survey_answers (
  id               uuid primary key default gen_random_uuid(),
  response_id      uuid not null references public.survey_responses(id) on delete cascade,
  question_code    text not null,
  value_raw        text,
  value_raw_type   text not null default 'text'
                     check (value_raw_type in ('numeric','categorical','text','multi')),
  value_numeric    numeric,
  value_normalized numeric,
  sentiment        text check (sentiment in ('positive','neutral','negative'))
);
create index survey_answers_response_idx on public.survey_answers (response_id);
create index survey_answers_qcode_idx    on public.survey_answers (question_code);

-- Flat projection the app + KPI engine read. security_invoker => honors RLS.
create view public.v_survey_flat with (security_invoker = on) as
select
  r.*,
  (select a.value_normalized from public.survey_answers a where a.response_id = r.id and a.question_code = 'FS_PUBLIC_SPACE')    as fs_public_space,
  (select a.value_normalized from public.survey_answers a where a.response_id = r.id and a.question_code = 'FS_GRIEVANCE')       as fs_grievance,
  (select a.value_normalized from public.survey_answers a where a.response_id = r.id and a.question_code = 'FS_WELLBEING_AWARE') as fs_wellbeing_aware,
  (select a.value_normalized from public.survey_answers a where a.response_id = r.id and a.question_code = 'OL_COST_MANAGEABLE') as ol_cost_manageable,
  (select a.value_normalized from public.survey_answers a where a.response_id = r.id and a.question_code = 'OL_ENERGY_KNOW')     as ol_energy_know,
  (select a.value_normalized from public.survey_answers a where a.response_id = r.id and a.question_code = 'OL_ACTIVE_TRAVEL')   as ol_active_travel,
  (select a.value_normalized from public.survey_answers a where a.response_id = r.id and a.question_code = 'OL_SECURITY')        as ol_security,
  (select a.value_normalized from public.survey_answers a where a.response_id = r.id and a.question_code = 'OL_PUBLIC_REALM')    as ol_public_realm,
  (select a.value_normalized from public.survey_answers a where a.response_id = r.id and a.question_code = 'OL_GRIEVANCE')       as ol_grievance,
  (select a.value_normalized from public.survey_answers a where a.response_id = r.id and a.question_code = 'OL_WELLBEING_AWARE') as ol_wellbeing_aware
from public.survey_responses r;

comment on table public.survey_responses is
  'Survey Model v2 envelope. Impact answers live in survey_answers; read via v_survey_flat.';
comment on table public.projects is
  'Developments per tenant; carries completion + retention dates for the 6-month purge policy.';
