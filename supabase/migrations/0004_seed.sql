-- =============================================================================
-- 0004_seed.sql
-- Demo seed data. Generic, domain-agnostic placeholder content (per Phase 1
-- decision). Safe to re-run after `supabase db reset`.
-- =============================================================================

-- ---- Tenants (white-label clients) ------------------------------------------
insert into public.tenants (id, name, branding) values
  ('northgate', 'Northgate Holdings', '{"brand":"37 99 235","logoText":"Northgate"}'),
  ('meridian',  'Meridian Group',     '{"brand":"13 148 136","logoText":"Meridian"}')
on conflict (id) do nothing;

-- ---- Six headline metric slots per tenant -----------------------------------
insert into public.metric_definitions
  (tenant_id, slot_index, metric_title, source_column, aggregation, unit, green_at, amber_at)
values
  ('northgate', 1, 'Overall Compliance Index', 'q4_score', 'avg',          'pts', 75, 50),
  ('northgate', 2, 'Spatial Transit Sentiment','q5_score', 'avg',          'pts', 70, 45),
  ('northgate', 3, 'Service Responsiveness',   'q6_score', 'avg',          'pts', 72, 48),
  ('northgate', 4, 'Positive Sentiment Rate',  'q10',      'pct_positive', '%',  60, 40),
  ('northgate', 5, 'Total Responses',          'id',       'count',        '',    1,  1),
  ('northgate', 6, 'Wellbeing Score',          'q9_score', 'avg',          'pts', 68, 45),
  ('meridian',  1, 'Overall Compliance Index', 'q4_score', 'avg',          'pts', 75, 50),
  ('meridian',  2, 'Spatial Transit Sentiment','q5_score', 'avg',          'pts', 70, 45),
  ('meridian',  3, 'Service Responsiveness',   'q6_score', 'avg',          'pts', 72, 48),
  ('meridian',  4, 'Positive Sentiment Rate',  'q10',      'pct_positive', '%',  60, 40),
  ('meridian',  5, 'Total Responses',          'id',       'count',        '',    1,  1),
  ('meridian',  6, 'Wellbeing Score',          'q9_score', 'avg',          'pts', 68, 45)
on conflict (tenant_id, slot_index) do nothing;

-- ---- Synthetic survey responses ---------------------------------------------
-- ~160 rows per tenant over the last 6 months with correlated, slightly noisy
-- scores so the dashboard shows a believable spread of traffic-light states.
do $$
declare
  demos       text[] := array['18-29','30-44','45-59','60+'];
  assets      text[] := array['Residential','Commercial','Mixed-Use','Industrial'];
  tenures     text[] := array['<1yr','1-3yr','3-5yr','5yr+'];
  blurbs_pos  text[] := array[
    'Really happy with how responsive the team has been lately.',
    'Transit access has improved a lot this quarter.',
    'Great communication and the facilities feel well maintained.'];
  blurbs_neu  text[] := array[
    'Things are fine, nothing major to report this period.',
    'No strong feelings either way, broadly as expected.',
    'Average experience overall, some ups and some downs.'];
  blurbs_neg  text[] := array[
    'Maintenance requests are taking far too long to resolve.',
    'Noise and access issues have gotten worse recently.',
    'Communication has been poor and unclear this month.'];
  t           text;
  i           int;
  base        real;
  sent        text;
  sscore      real;
begin
  foreach t in array array['northgate','meridian'] loop
    for i in 1..160 loop
      base := 45 + random() * 45;                       -- tenant/row baseline 45-90
      sscore := round((base - 60) / 30.0::numeric, 2);  -- map score band -> [-0.5..1]
      sscore := greatest(-1, least(1, sscore + (random() - 0.5) * 0.4));
      sent := case
                when sscore > 0.2 then 'positive'
                when sscore < -0.15 then 'negative'
                else 'neutral'
              end;

      insert into public.survey_responses (
        tenant_id, source, submitted_at,
        q1_demographic, q2_asset_class, q3_tenure,
        q4_score, q5_score, q6_score, q7_score, q8_score, q9_score,
        q10_text, q10_sentiment, q10_sentiment_score
      ) values (
        t,
        case when random() < 0.65 then 'field_pwa' else 'digital_public' end,
        now() - (random() * interval '180 days'),
        demos[1 + floor(random()*4)::int],
        assets[1 + floor(random()*4)::int],
        tenures[1 + floor(random()*4)::int],
        greatest(0, least(100, round(base + (random()-0.5)*20)))::smallint,
        greatest(0, least(100, round(base + (random()-0.5)*24)))::smallint,
        greatest(0, least(100, round(base + (random()-0.5)*22)))::smallint,
        greatest(0, least(100, round(base + (random()-0.5)*26)))::smallint,
        greatest(0, least(100, round(base + (random()-0.5)*20)))::smallint,
        greatest(0, least(100, round(base + (random()-0.5)*18)))::smallint,
        case sent
          when 'positive' then blurbs_pos[1 + floor(random()*3)::int]
          when 'negative' then blurbs_neg[1 + floor(random()*3)::int]
          else blurbs_neu[1 + floor(random()*3)::int]
        end,
        sent,
        sscore
      );
    end loop;
  end loop;
end $$;
