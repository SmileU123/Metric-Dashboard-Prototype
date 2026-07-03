-- =============================================================================
-- 0003_stream_b_macro_pool.sql
-- Stream B: the anonymized macro analytical pool.
--
-- Stream B is deliberately CROSS-TENANT but DE-IDENTIFIED. It exposes generalized
-- analytical signal (impact scores, sentiment, typology, coarse demographics,
-- month bucket) with NO join key back to a tenant or project, and NO free-text
-- that could re-identify a respondent. The qualitative Q10 string is dropped;
-- only its sentiment label survives.
--
-- NOTE: client-facing BENCHMARKING is explicitly OUT OF SCOPE for Phase 1 (no
-- comparative data yet). These views are the structural foundation only; nothing
-- in the current dashboard UI reads them.
--
-- Phase 3 hardens this into an irreversible one-way write path (hash-on-commit
-- into a physically separate table).
-- =============================================================================

-- Row-level anonymized pool. No tenant_id / project_id, no free text; quarter bucket.
create view public.macro_pool as
select
  temporal_cohort,
  period_year,
  period_quarter,
  channel,
  respondent_typology,
  delivery_model,
  q1_demographic,
  q2_asset_class,
  q3_tenure,
  fs_public_space, fs_grievance, fs_wellbeing_aware,
  ol_cost_manageable, ol_energy_know, ol_active_travel, ol_security,
  ol_public_realm, ol_grievance, ol_wellbeing_aware,
  q10_sentiment
from public.v_survey_flat;

comment on view public.macro_pool is
  'Stream B: de-identified, cross-tenant analytical pool. No tenant/project key, no free text.';

-- Pre-aggregated thematic sentiment by quarter and typology.
create view public.macro_theme_quarterly as
select
  period_year,
  period_quarter,
  respondent_typology,
  delivery_model,
  count(*)                                     as response_count,
  round(avg(ol_cost_manageable)::numeric, 1)   as cost_manageable_avg,
  round(avg(ol_energy_know)::numeric, 1)       as energy_know_avg,
  round(avg(ol_active_travel)::numeric, 1)     as active_travel_avg,
  round(avg(ol_security)::numeric, 1)          as security_avg,
  round(avg(ol_public_realm)::numeric, 1)      as public_realm_avg,
  round(avg(ol_wellbeing_aware)::numeric, 1)   as wellbeing_avg,
  round(avg(fs_public_space)::numeric, 1)      as field_public_space_avg,
  round(100.0 * sum((q10_sentiment = 'positive')::int) / nullif(count(*),0), 1) as pct_positive
from public.macro_pool
group by period_year, period_quarter, respondent_typology, delivery_model;

comment on view public.macro_theme_quarterly is
  'Stream B: pre-aggregated macro trends by quarter and respondent typology.';

-- Stream B is the shared analytical surface; expose it to read-only roles.
grant select on public.macro_pool            to anon, authenticated;
grant select on public.macro_theme_quarterly to anon, authenticated;
