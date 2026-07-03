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

-- ---- Survey question catalog (DRAFT architecture from the mock workbook) -----
insert into public.survey_questions (code, channel, seq, short_label, theme, response_type, gresb_ref) values
  ('FS_AGE','field',1,'Age','demographic','numeric',null),
  ('FS_ACCESS_COHORT','field',2,'Accessibility & Mobility Cohort','mobility','single_choice',null),
  ('FS_PROXIMITY','field',3,'Local Proximity','proximity','single_choice',null),
  ('FS_PUBLIC_SPACE','field',4,'Public Space Sentiment','public_realm','scale_1_5','GRESB TC 6.1'),
  ('FS_GRIEVANCE','field',5,'Grievance & Communication Confidence','grievance','scale_1_5','GRESB TC 6.1 / TISFD'),
  ('FS_WELLBEING_AWARE','field',6,'Wellbeing/Offerings Awareness','wellbeing','single_choice','GRESB TC 6.1'),
  ('FS_OPEN','field',7,'Constructive Suggestion (voice-to-text)','open_text','open_text',null),
  ('OL_COST_MANAGEABLE','online',1,'Cost Manageability (Q3): living costs manageable & sustainable','housing','scale_1_5',null),
  ('OL_COST_FOLLOWUP','online',2,'Cost Follow-up (Q3B): why costs feel unmanageable','housing','open_text',null),
  ('OL_ENERGY_KNOW','online',3,'Knows How to Optimize Energy Settings (Q4)','sustainability','yes_no',null),
  ('OL_ACTIVE_TRAVEL','online',4,'Recycling & Active Travel (Q5)','mobility','scale_1_5',null),
  ('OL_SECURITY','online',5,'Off-Peak Security (Q6)','safety','scale_1_5',null),
  ('OL_PUBLIC_REALM','online',6,'Public Realm Contribution (Q7)','public_realm','scale_1_5',null),
  ('OL_GRIEVANCE','online',7,'Management Responsiveness (Q8)','grievance','scale_1_5',null),
  ('OL_WELLBEING_AWARE','online',8,'Community & Wellbeing Awareness (Q9)','wellbeing','scale_1_5',null),
  ('OL_OFFERING_1','online',9,'Top Offering Choice 1 (Q10)','offering','single_choice',null),
  ('OL_OFFERING_2','online',10,'Top Offering Choice 2 (Q10)','offering','single_choice',null),
  ('OL_OPEN','online',11,'Constructive Suggestion (Q10B)','open_text','open_text',null),
  -- Retired in the updated survey architecture (kept for history):
  ('OL_GREEN_INFRA','online',99,'Green Infrastructure & Efficiency (retired)','sustainability','scale_1_5',null),
  ('PO_PLACEHOLDER','private_ownership',1,'Private Ownership (awaiting sheet)','general','scale_1_5',null)
on conflict (code) do nothing;
update public.survey_questions set is_active = false
where channel = 'private_ownership' or code = 'OL_GREEN_INFRA';

-- ---- Survey responses (envelope) + answers (EAV) ----------------------------
-- ~175 rows/tenant across ~5 quarters. Field intercepts (in-construction) answer
-- FS_* questions; Online/QR residents (completed, BTR/private-sale) answer OL_*.
-- Open-text payloads include real strings from the mock workbook.
do $$
declare
  ages   text[] := array['18-24','25-34','35-49','50-64','65+'];
  f_pos  text[] := array[
    'More construction site jobs please.',
    'Advance notice on loud drilling schedules would help those of us working from home.',
    'The new hoarding artwork really brightened up the walk to the station.'];
  f_neu  text[] := array[
    'Things are broadly as expected for a live construction site.',
    'No strong view either way this quarter.',
    'Some dust and noise but generally manageable.'];
  f_neg  text[] := array[
    'Please invest in high-quality dust screens and daily street sweeping; air quality has been tough.',
    'Construction noise and grime have gotten worse recently.',
    'Communication about road closures and works has been unclear.'];
  o_pos  text[] := array[
    'We need a secure delivery room with refrigerated lockers for online grocery orders.',
    'A community repair workshop with shared tools would save us buying rarely-used drills.',
    'Great secure cycle storage and the courtyard genuinely feels safe at night.'];
  o_neu  text[] := array[
    'Facilities are fine overall, nothing urgent to flag.',
    'Average experience; some ups and some downs.',
    'No strong feelings this period.'];
  o_neg  text[] := array[
    'Off-peak lighting near the car park feels unsafe.',
    'The recycling area is often overflowing and hard to access.',
    'Management is slow to respond to estate grievances.'];
  field_codes  text[] := array['FS_PUBLIC_SPACE','FS_GRIEVANCE'];
  online_codes text[] := array['OL_COST_MANAGEABLE','OL_ACTIVE_TRAVEL','OL_SECURITY','OL_PUBLIC_REALM','OL_GRIEVANCE','OL_WELLBEING_AWARE'];
  proximities  text[] := array['DCW','LR','Occ_Ten','FTV_Passerby'];
  well_opts    text[] := array['Yes_POS','YES_NEG','NO_NEG'];
  well_norms   numeric[] := array[100, 50, 0];   -- scored: aware+positive / aware+negative / unaware
  cost_blurbs  text[] := array[
    'Service charges doubled with zero breakdown. Feels like we are billed blindly.',
    'Uncapped community energy network bills - we have no choice in provider.',
    'Car parking space rent went up by 75 a month out of nowhere.',
    'The shared hallway electricity bill tripled and management will not explain why.'];
  well_i       int;
  cost_raw     numeric;
  offerings    text[] := array['Expanded Green Space / Shading','Community Workshops & Social Events','Secure Bicycle & EV Infrastructure','Improved Lighting & Public Safety Measures','Local Business/Independent Retail Pop-ups'];
  age_years    int; off1 int; off2 int;
  t text; i int; base real; sscore real; sent text;
  submitted timestamptz; yr int; qtr int; cohort text; age text;
  is_field boolean; tenure_v text; deliv text; typ text; chan text; src text; q2 text; q3 text;
  proj uuid; resp_id uuid; blurb text;
  codes text[]; qc text; raw_scale numeric; norm numeric;
begin
  foreach t in array array['northgate','meridian'] loop
    for i in 1..175 loop
      base := 45 + random() * 45;
      sscore := greatest(-1, least(1, round(((base - 60) / 30.0)::numeric, 2) + (random() - 0.5) * 0.4));
      sent := case when sscore > 0.2 then 'positive' when sscore < -0.15 then 'negative' else 'neutral' end;
      submitted := now() - (random() * interval '450 days');
      yr  := extract(year from submitted)::int;
      qtr := extract(quarter from submitted)::int;
      cohort := 'Q' || qtr || '-' || yr;
      age := ages[1 + floor(random() * 5)::int];
      is_field := random() < 0.4;
      select id into proj from public.projects where tenant_id = t order by random() limit 1;

      if is_field then
        chan := 'field'; src := 'field_pwa'; typ := 'construction_adjacent';
        deliv := null; tenure_v := null; q2 := 'In-Construction'; q3 := '—';
        blurb := (case sent when 'positive' then f_pos[1+floor(random()*3)::int]
                            when 'negative' then f_neg[1+floor(random()*3)::int]
                            else f_neu[1+floor(random()*3)::int] end);
      else
        chan := 'online'; src := 'digital_public'; typ := 'resident_completed'; q2 := 'Completed';
        if random() < 0.55 then tenure_v := 'btr'; deliv := 'build_to_rent'; q3 := 'BTR';
        else tenure_v := 'private_sale'; deliv := 'build_to_sell'; q3 := 'Private Sale'; end if;
        blurb := (case sent when 'positive' then o_pos[1+floor(random()*3)::int]
                            when 'negative' then o_neg[1+floor(random()*3)::int]
                            else o_neu[1+floor(random()*3)::int] end);
      end if;

      insert into public.survey_responses (
        tenant_id, project_id, channel, source, asset_class_state, tenure,
        respondent_typology, delivery_model, temporal_cohort, period_year, period_quarter,
        submitted_at, q1_demographic, q2_asset_class, q3_tenure,
        housing_cost_to_income, q10_text, q10_sentiment, q10_sentiment_score
      ) values (
        t, proj, chan, src, case when is_field then 'in_construction' else 'completed' end, tenure_v,
        typ, deliv, cohort, yr, qtr,
        submitted, age, q2, q3,
        round((52 - (base - 45) * 0.25 + (random() - 0.5) * 8)::numeric, 1),
        blurb, sent, sscore
      ) returning id into resp_id;

      -- Scale answers: keep RAW Likert 1-5 + numeric + 0-100 normalized.
      cost_raw := null;
      codes := case when is_field then field_codes else online_codes end;
      foreach qc in array codes loop
        raw_scale := greatest(1, least(5,
          round((1 + (base + (random()-0.5)*22 - 45) / 11.25)::numeric, 0)));
        norm := (raw_scale - 1) / 4.0 * 100;
        if qc = 'OL_COST_MANAGEABLE' then cost_raw := raw_scale; end if;
        insert into public.survey_answers
          (response_id, question_code, value_raw, value_raw_type, value_numeric, value_normalized)
        values (resp_id, qc, raw_scale::text, 'numeric', raw_scale, norm);
      end loop;

      -- Categorical / choice / yes-no answers. Scored ones carry value_normalized.
      if is_field then
        age_years := 18 + floor(random() * 57)::int;
        insert into public.survey_answers (response_id, question_code, value_raw, value_raw_type, value_numeric) values
          (resp_id, 'FS_AGE', age_years::text, 'numeric', age_years);
        well_i := 1 + floor(random()*3)::int;
        insert into public.survey_answers (response_id, question_code, value_raw, value_raw_type, value_normalized) values
          (resp_id, 'FS_WELLBEING_AWARE', well_opts[well_i], 'categorical', well_norms[well_i]);
        insert into public.survey_answers (response_id, question_code, value_raw, value_raw_type) values
          (resp_id, 'FS_ACCESS_COHORT', floor(random()*4)::text, 'categorical'),
          (resp_id, 'FS_PROXIMITY', proximities[1 + floor(random()*4)::int], 'categorical');
      else
        -- Energy Yes/No is a scored input (Yes=100 / No=0), skewed by the row baseline.
        if random() < (base / 90.0) then
          insert into public.survey_answers (response_id, question_code, value_raw, value_raw_type, value_normalized)
          values (resp_id, 'OL_ENERGY_KNOW', 'Yes', 'categorical', 100);
        else
          insert into public.survey_answers (response_id, question_code, value_raw, value_raw_type, value_normalized)
          values (resp_id, 'OL_ENERGY_KNOW', 'No', 'categorical', 0);
        end if;

        off1 := 1 + floor(random()*5)::int;
        off2 := 1 + ((off1 + floor(random()*4)::int) % 5);  -- distinct 2nd choice
        insert into public.survey_answers (response_id, question_code, value_raw, value_raw_type) values
          (resp_id, 'OL_OFFERING_1', offerings[off1], 'multi'),
          (resp_id, 'OL_OFFERING_2', offerings[off2], 'multi');

        -- Q3B dynamic follow-up: only when cost manageability scored 1-3.
        if cost_raw is not null and cost_raw <= 3 then
          insert into public.survey_answers (response_id, question_code, value_raw, value_raw_type, sentiment)
          values (resp_id, 'OL_COST_FOLLOWUP', cost_blurbs[1 + floor(random()*4)::int], 'text', 'negative');
        end if;
      end if;

      -- Open text: raw string + sentiment (no numeric).
      insert into public.survey_answers
        (response_id, question_code, value_raw, value_raw_type, sentiment)
      values (resp_id, case when is_field then 'FS_OPEN' else 'OL_OPEN' end, blurb, 'text', sent);
    end loop;
  end loop;
end $$;
