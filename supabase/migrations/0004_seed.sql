-- =============================================================================
-- 0004_seed.sql
-- Demo seed data. Property-development impact surveys with generic placeholder
-- content (real KPI doc + sample rows arrive from the client). Safe to re-run
-- after `supabase db reset`.
-- =============================================================================

-- ---- Tenants (white-label developer clients) --------------------------------
insert into public.tenants (id, name, branding) values
  ('northgate', 'Northgate Developments', '{"brand":"37 99 235","logoText":"Northgate"}'),
  ('meridian',  'Meridian Urban',          '{"brand":"13 148 136","logoText":"Meridian"}')
on conflict (id) do nothing;

-- ---- Projects (developments) ------------------------------------------------
insert into public.projects (tenant_id, name, status, completion_date, retention_expires_at) values
  ('northgate', 'Canalside Quarter',  'in_report', date '2026-05-01', date '2026-11-01'),
  ('northgate', 'Elm Street Regen',   'active',    null,             null),
  ('meridian',  'Harbour View Phase 1','completed', date '2026-03-15', date '2026-09-15'),
  ('meridian',  'Parkgate Mews',      'active',    null,             null);

-- (The six standardized KPIs are seeded by the KPI engine in 0005_kpi_engine.sql.)

-- ---- Synthetic survey responses ---------------------------------------------
-- ~160 rows per tenant across the last 6 months, spread over respondent
-- typologies (construction-adjacent vs completed-building BTR/BTS residents),
-- with correlated, slightly noisy scores for a believable spread of states.
do $$
declare
  demos       text[] := array['18-29','30-44','45-59','60+'];
  assets      text[] := array['Residential','Commercial','Mixed-Use','Industrial'];
  tenures     text[] := array['<1yr','1-3yr','3-5yr','5yr+'];
  blurbs_pos  text[] := array[
    'Really happy with how responsive the on-site team has been lately.',
    'Transit access and cycle storage have improved a lot this quarter.',
    'Great communication and the public spaces feel safe and well kept.'];
  blurbs_neu  text[] := array[
    'Things are fine, nothing major to report this period.',
    'No strong feelings either way, broadly as expected.',
    'Average experience overall, some ups and some downs.'];
  blurbs_neg  text[] := array[
    'Construction noise and dust have gotten worse recently.',
    'Lighting around the open spaces feels poor after dark.',
    'Communication about works has been unclear this month.'];
  t           text;
  i           int;
  base        real;
  sent        text;
  sscore      real;
  typ         text;
  deliv       text;
  proj        uuid;
begin
  foreach t in array array['northgate','meridian'] loop
    for i in 1..160 loop
      base := 45 + random() * 45;                       -- baseline 45-90
      sscore := round(((base - 60) / 30.0)::numeric, 2);
      sscore := greatest(-1, least(1, sscore + (random() - 0.5) * 0.4));
      sent := case
                when sscore > 0.2 then 'positive'
                when sscore < -0.15 then 'negative'
                else 'neutral'
              end;

      -- Respondent typology: ~40% construction-adjacent, ~60% completed residents.
      if random() < 0.4 then
        typ := 'construction_adjacent';
        deliv := null;
      else
        typ := 'resident_completed';
        deliv := case when random() < 0.5 then 'build_to_rent' else 'build_to_sell' end;
      end if;

      -- Pick a random project for this tenant.
      select id into proj from public.projects
        where tenant_id = t order by random() limit 1;

      insert into public.survey_responses (
        tenant_id, project_id, respondent_typology, delivery_model,
        source, submitted_at,
        q1_demographic, q2_asset_class, q3_tenure,
        q4_score, q5_score, q6_score, q7_score, q8_score, q9_score,
        housing_cost_to_income,
        q10_text, q10_sentiment, q10_sentiment_score
      ) values (
        t, proj, typ, deliv,
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
        -- Cost-to-income: ~28-52%, loosely inverse to wellbeing (lower is better).
        round((52 - (base - 45) * 0.25 + (random()-0.5)*8)::numeric, 1),
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
