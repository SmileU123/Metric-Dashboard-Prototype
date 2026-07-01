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
-- Survey responses — the single capture table feeding every dashboard screen.
-- -----------------------------------------------------------------------------
create table public.survey_responses (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text not null references public.tenants(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete cascade,

  -- Respondent typology — drives the Pages 2-4 deep-dive segmentation.
  respondent_typology text not null default 'resident_completed'
    check (respondent_typology in ('construction_adjacent','resident_completed')),
  -- Delivery model applies to completed-building residents (else null).
  delivery_model text
    check (delivery_model in ('build_to_rent','build_to_sell')),

  -- Provenance: which channel produced the row (Phase 2 wires these for real).
  source        text not null default 'field_pwa'
                  check (source in ('field_pwa','digital_public')),
  -- Outbound digital-survey attribution (Phase 2 URL parameter tracking).
  utm           jsonb not null default '{}'::jsonb,

  submitted_at  timestamptz not null default now(),

  -- Q1-Q3 : contextual filters --------------------------------------------------
  q1_demographic  text,    -- demographic bracket
  q2_asset_class  text,    -- asset class selector
  q3_tenure       text,    -- tenure matrix bucket

  -- Q4-Q9 : generalized impact variables (0-100 thematic scores) ----------------
  q4_score  smallint check (q4_score between 0 and 100),
  q5_score  smallint check (q5_score between 0 and 100),
  q6_score  smallint check (q6_score between 0 and 100),
  q7_score  smallint check (q7_score between 0 and 100),
  q8_score  smallint check (q8_score between 0 and 100),
  q9_score  smallint check (q9_score between 0 and 100),

  -- Quantitative: housing cost-to-income ratio (%). Lower is better.
  housing_cost_to_income real check (housing_cost_to_income between 0 and 100),

  -- Q10 : qualitative NLP engine -------------------------------------------------
  q10_text         text check (char_length(q10_text) <= 280),
  q10_sentiment    text check (q10_sentiment in ('positive','neutral','negative')),
  q10_sentiment_score real check (q10_sentiment_score between -1 and 1)
);

create index survey_responses_tenant_idx     on public.survey_responses (tenant_id);
create index survey_responses_project_idx     on public.survey_responses (project_id);
create index survey_responses_typology_idx    on public.survey_responses (respondent_typology, delivery_model);
create index survey_responses_submitted_idx    on public.survey_responses (submitted_at desc);
create index survey_responses_asset_class_idx  on public.survey_responses (q2_asset_class);

-- NOTE: The Page 1 KPIs are driven by the configurable KPI ENGINE defined in
-- 0005_kpi_engine.sql (KPI_Definition / KPI_Sources / KPI_Formula /
-- KPI_Thresholds / KPI_Result / KPI_RunLog). This file only owns the raw survey
-- capture surface that the engine reads from.

comment on table public.survey_responses is
  'Canonical capture table. Q1-Q10 columns are structurally fixed; presentation is decoupled.';
comment on table public.projects is
  'Developments per tenant; carries completion + retention dates for the 6-month purge policy.';
