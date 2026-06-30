-- =============================================================================
-- 0001_init_multitenant.sql
-- Core multi-tenant schema for the Data Monitoring Platform (Phase 1).
--
-- Design notes:
--  * Survey questions Q1-Q10 are STRUCTURALLY FIXED columns (per the brief's
--    "Core Architectural Pillars"). Their *presentation* (titles, theme labels,
--    metric bindings) lives in config tables / the frontend, NOT in column names,
--    so survey wording can change post-pitch without a migration.
--  * Q1-Q3  -> contextual filters (demographic / asset class / tenure)
--  * Q4-Q9  -> generalized impact variables (0-100 sentiment scores)
--  * Q10    -> qualitative free text (<=280 chars) + sentiment tag
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tenants (white-label clients)
-- -----------------------------------------------------------------------------
create table public.tenants (
  id          text primary key,                 -- slug, e.g. 'northgate'
  name        text not null,
  -- Branding tokens consumed by the white-label theme layer (see config/theme.ts)
  branding    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

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

  -- Q4-Q9 : generalized impact variables (0-100). Thematic, not literal text. ----
  q4_score  smallint check (q4_score between 0 and 100),
  q5_score  smallint check (q5_score between 0 and 100),
  q6_score  smallint check (q6_score between 0 and 100),
  q7_score  smallint check (q7_score between 0 and 100),
  q8_score  smallint check (q8_score between 0 and 100),
  q9_score  smallint check (q9_score between 0 and 100),

  -- Q10 : qualitative NLP engine -------------------------------------------------
  q10_text         text check (char_length(q10_text) <= 280),
  q10_sentiment    text check (q10_sentiment in ('positive','neutral','negative')),
  q10_sentiment_score real check (q10_sentiment_score between -1 and 1)
);

create index survey_responses_tenant_idx       on public.survey_responses (tenant_id);
create index survey_responses_submitted_idx     on public.survey_responses (submitted_at desc);
create index survey_responses_asset_class_idx   on public.survey_responses (q2_asset_class);

-- -----------------------------------------------------------------------------
-- Metric definitions — drives the six Page 1 KPI slots.
-- "Defensive Design": a metric is a row here, so swapping the data vector behind
-- a headline card is a config change (UPDATE), never a code change.
-- -----------------------------------------------------------------------------
create table public.metric_definitions (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      text not null references public.tenants(id) on delete cascade,
  slot_index     smallint not null check (slot_index between 1 and 6),
  metric_title   text not null,
  -- Which response column to aggregate and how.
  source_column  text not null,                 -- e.g. 'q4_score'
  aggregation    text not null default 'avg'
                   check (aggregation in ('avg','count','pct_positive','pct_compliant')),
  unit           text not null default '',      -- e.g. '%', 'pts'
  -- Traffic-light thresholds: value >= green_at -> green; >= amber_at -> amber; else red.
  green_at       real not null default 75,
  amber_at       real not null default 50,
  is_active      boolean not null default true,
  unique (tenant_id, slot_index)
);

-- Convenience: keep updated rows honest.
comment on table public.survey_responses is
  'Canonical capture table. Q1-Q10 columns are structurally fixed; presentation is decoupled.';
comment on table public.metric_definitions is
  'Config-driven bindings for the six Page 1 headline metric slots (zero-code reassignment).';
