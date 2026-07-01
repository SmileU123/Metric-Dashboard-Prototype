-- =============================================================================
-- 0008_kpi_unit.sql
-- Add a configurable display UNIT to each KPI (e.g. 'pts', '%', 'score').
-- Idempotent: safe on both a fresh DB (0005 already adds the column) and an
-- existing DB created before the column existed.
-- =============================================================================

alter table public.kpi_definition
  add column if not exists unit text not null default 'pts';

-- Backfill the six standardized KPIs (no-op if already set).
update public.kpi_definition set unit = 'pts'
where tenant_id is null
  and kpi_code in (
    'LOCAL_ENV_QUALITY','PR_SAFETY_ACCESS','SUS_MOBILITY',
    'SUSTAINABILITY','COMMUNITY_WELLBEING','HOUSING_AFFORDABILITY'
  );
