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

-- Row-level anonymized pool. No tenant_id / project_id, no free text, month bucket.
create view public.macro_pool as
select
  date_trunc('month', submitted_at)::date as period_month,
  source,
  respondent_typology,
  delivery_model,
  q1_demographic,
  q2_asset_class,
  q3_tenure,
  q4_score, q5_score, q6_score, q7_score, q8_score, q9_score,
  housing_cost_to_income,
  q10_sentiment
from public.survey_responses;

comment on view public.macro_pool is
  'Stream B: de-identified, cross-tenant analytical pool. No tenant/project key, no free text.';

-- Pre-aggregated thematic sentiment by month and typology.
create view public.macro_theme_monthly as
select
  period_month,
  respondent_typology,
  delivery_model,
  count(*)                              as response_count,
  round(avg(q4_score)::numeric, 1)      as q4_avg,
  round(avg(q5_score)::numeric, 1)      as q5_avg,
  round(avg(q6_score)::numeric, 1)      as q6_avg,
  round(avg(q7_score)::numeric, 1)      as q7_avg,
  round(avg(q8_score)::numeric, 1)      as q8_avg,
  round(avg(q9_score)::numeric, 1)      as q9_avg,
  round(avg(housing_cost_to_income)::numeric, 1) as cost_to_income_avg,
  round(100.0 * sum((q10_sentiment = 'positive')::int) / nullif(count(*),0), 1) as pct_positive
from public.macro_pool
group by period_month, respondent_typology, delivery_model;

comment on view public.macro_theme_monthly is
  'Stream B: pre-aggregated macro trends by month and respondent typology.';

-- Stream B is the shared analytical surface; expose it to read-only roles.
grant select on public.macro_pool          to anon, authenticated;
grant select on public.macro_theme_monthly to anon, authenticated;
