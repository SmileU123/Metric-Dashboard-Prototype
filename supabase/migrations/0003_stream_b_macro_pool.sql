-- =============================================================================
-- 0003_stream_b_macro_pool.sql
-- Stream B: the anonymized macro analytical pool.
--
-- Stream B is deliberately CROSS-TENANT but DE-IDENTIFIED. It exposes generalized
-- analytical signal (impact scores, sentiment, coarse demographics, month bucket)
-- with NO join key back to a tenant and NO free-text that could re-identify a
-- respondent. The qualitative Q10 string is dropped; only its sentiment label
-- survives.
--
-- These views are plain (owner-privileged) views, so they intentionally read
-- across the RLS boundary to build the shared pool — but only the de-identified
-- projection below is ever returned. Phase 3 hardens this into an irreversible
-- one-way write path (hash-on-commit into a physically separate table).
-- =============================================================================

-- Row-level anonymized pool. No tenant_id, no free text, timestamp -> month.
create view public.macro_pool as
select
  date_trunc('month', submitted_at)::date as period_month,
  source,
  q1_demographic,
  q2_asset_class,
  q3_tenure,
  q4_score, q5_score, q6_score, q7_score, q8_score, q9_score,
  q10_sentiment
from public.survey_responses;

comment on view public.macro_pool is
  'Stream B: de-identified, cross-tenant analytical pool. No tenant key, no free text.';

-- Pre-aggregated thematic sentiment by month (handy for macro trend charts).
create view public.macro_theme_monthly as
select
  period_month,
  q2_asset_class,
  count(*)                              as response_count,
  round(avg(q4_score)::numeric, 1)      as q4_avg,
  round(avg(q5_score)::numeric, 1)      as q5_avg,
  round(avg(q6_score)::numeric, 1)      as q6_avg,
  round(avg(q7_score)::numeric, 1)      as q7_avg,
  round(avg(q8_score)::numeric, 1)      as q8_avg,
  round(avg(q9_score)::numeric, 1)      as q9_avg,
  round(100.0 * sum((q10_sentiment = 'positive')::int) / nullif(count(*),0), 1) as pct_positive
from public.macro_pool
group by period_month, q2_asset_class;

comment on view public.macro_theme_monthly is
  'Stream B: pre-aggregated macro trends by month and asset class.';

-- Stream B is the shared analytical surface; expose it to read-only roles.
grant select on public.macro_pool          to anon, authenticated;
grant select on public.macro_theme_monthly to anon, authenticated;
