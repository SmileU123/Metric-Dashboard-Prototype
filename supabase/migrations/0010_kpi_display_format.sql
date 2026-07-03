-- =============================================================================
-- 0010_kpi_display_format.sql
-- Formalize how a KPI value is rendered (audit item #3).
--   unit_type      — semantic kind: score | percentage | ratio | points
--   display_format — rendering rule: raw | percent | fixed_1dp
-- Idempotent: safe on both a fresh DB (0005 already adds these) and an existing
-- DB created before the columns existed.
-- =============================================================================

alter table public.kpi_definition
  add column if not exists unit_type text not null default 'points';

alter table public.kpi_definition
  add column if not exists display_format text not null default 'fixed_1dp';

-- Backfill the standardized KPIs (no-op if already set).
update public.kpi_definition
set unit_type = 'points', display_format = 'fixed_1dp'
where tenant_id is null
  and kpi_code in (
    'ENV_QUALITY','PR_SAFETY_ACCESS','CIRC_MOBILITY',
    'SUSTAINABILITY','COMMUNITY_WELLBEING','HOUSING_AFFORDABILITY'
  );
