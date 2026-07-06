-- =============================================================================
-- 0011_value_maps.sql
-- Flexible mapping / normalization layer.
--
-- Converts RAW answers (Likert scales, categoricals, booleans, multi-selects)
-- into value_numeric + value_normalized — as DATA, not code:
--
--   survey_value_maps      one row per rule (scale params or per-option scores)
--   map_answer_values()    resolves (question_code, value_raw) -> numeric/normalized
--   trigger                normalizes every new/updated answer automatically
--   apply_value_maps()     batch re-derivation after a mapping is retuned
--
-- Evolving KPIs need NO schema changes: add a survey_questions row, add its
-- survey_value_maps rows, point a kpi_sources row at the question code — done.
-- (Open-text answers stay unmapped by design; sentiment covers them.)
-- =============================================================================

create table public.survey_value_maps (
  id               uuid primary key default gen_random_uuid(),
  question_code    text not null,
  map_type         text not null
                     check (map_type in ('scale_linear','categorical','boolean','multi')),
  -- Option to match (categorical/boolean/multi). NULL for scale_linear rules.
  match_value      text,
  -- Meaning of the matched option:
  value_numeric    numeric,
  value_normalized numeric,
  -- scale_linear parameters: normalized = (raw - min) / (max - min) * 100
  scale_min        numeric,
  scale_max        numeric,
  is_active        boolean not null default true,
  notes            text not null default ''
);
create unique index survey_value_maps_uidx
  on public.survey_value_maps (question_code, coalesce(match_value, '~scale'));

alter table public.survey_value_maps enable row level security;
create policy value_maps_read on public.survey_value_maps
  for select using ( true );

-- -----------------------------------------------------------------------------
-- Resolver: (question_code, value_raw) -> (found, value_numeric, value_normalized)
-- multi: value_raw may hold several options split by '|'; results are averaged.
-- -----------------------------------------------------------------------------
-- NOTE: the result column is named `matched` (NOT `found`) deliberately —
-- `FOUND` is PL/pgSQL's automatic status variable and shadows a same-named
-- output column, silently swallowing assignments.
create or replace function public.map_answer_values(p_code text, p_raw text)
returns table (matched boolean, v_numeric numeric, v_normalized numeric)
language plpgsql
stable
as $$
declare
  m      record;
  n      numeric;
  agg_n  numeric := 0;
  agg_z  numeric := 0;
  hits   integer := 0;
  part   text;
begin
  matched := false; v_numeric := null; v_normalized := null;

  if p_raw is null then return next; return; end if;

  -- 1) linear scale rule for this question?
  select * into m from public.survey_value_maps
  where question_code = p_code and map_type = 'scale_linear' and is_active
  limit 1;
  if m.id is not null then
    if p_raw ~ '^-?\d+(\.\d+)?$' then
      n := p_raw::numeric;
      matched := true;
      v_numeric := n;
      if m.scale_max is not null and m.scale_min is not null and m.scale_max <> m.scale_min then
        v_normalized := greatest(0, least(100, (n - m.scale_min) / (m.scale_max - m.scale_min) * 100));
      end if;
    end if;
    return next; return;
  end if;

  -- 2) multi rule: split on '|', average the matched options.
  if exists (select 1 from public.survey_value_maps
             where question_code = p_code and map_type = 'multi' and is_active) then
    for part in select trim(x) from regexp_split_to_table(p_raw, '\|') as x loop
      select * into m from public.survey_value_maps
      where question_code = p_code and map_type = 'multi' and is_active
        and lower(match_value) = lower(part)
      limit 1;
      if m.id is not null then
        hits := hits + 1;
        agg_n := agg_n + coalesce(m.value_numeric, 0);
        agg_z := agg_z + coalesce(m.value_normalized, 0);
      end if;
    end loop;
    if hits > 0 then
      matched := true;
      v_numeric := round(agg_n / hits, 2);
      v_normalized := round(agg_z / hits, 2);
    end if;
    return next; return;
  end if;

  -- 3) categorical / boolean: exact (case-insensitive) option match.
  select * into m from public.survey_value_maps
  where question_code = p_code and map_type in ('categorical','boolean') and is_active
    and lower(match_value) = lower(trim(p_raw))
  limit 1;
  if m.id is not null then
    matched := true;
    v_numeric := m.value_numeric;
    v_normalized := m.value_normalized;
  end if;
  return next;
end $$;

-- -----------------------------------------------------------------------------
-- Ingest-time normalization: every inserted/updated answer is mapped
-- automatically (Phase-2 capture channels inherit this for free).
-- -----------------------------------------------------------------------------
create or replace function public.survey_answers_normalize()
returns trigger
language plpgsql
as $$
declare m record;
begin
  select * into m from public.map_answer_values(new.question_code, new.value_raw);
  if m.matched then
    new.value_numeric := m.v_numeric;
    new.value_normalized := m.v_normalized;
  end if;
  return new;
end $$;

create trigger survey_answers_normalize_trg
  before insert or update of value_raw, question_code on public.survey_answers
  for each row execute function public.survey_answers_normalize();

-- -----------------------------------------------------------------------------
-- Batch re-derivation: run after retuning a mapping to re-normalize history.
-- Returns the number of answers updated.
-- -----------------------------------------------------------------------------
create or replace function public.apply_value_maps()
returns integer
language plpgsql
as $$
declare
  rec record;
  m   record;
  n   integer := 0;
begin
  for rec in select id, question_code, value_raw from public.survey_answers loop
    select * into m from public.map_answer_values(rec.question_code, rec.value_raw);
    if m.matched then
      update public.survey_answers
      set value_numeric = m.v_numeric,
          value_normalized = m.v_normalized
      where id = rec.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- =============================================================================
-- SEED MAPPINGS (defaults; retune with UPDATE + select apply_value_maps())
-- =============================================================================

-- 1-5 Likert scales -> 0-100
insert into public.survey_value_maps (question_code, map_type, scale_min, scale_max, notes)
select code, 'scale_linear', 1, 5, '1-5 Likert -> 0-100'
from (values ('FS_PUBLIC_SPACE'),('FS_GRIEVANCE'),('OL_COST_MANAGEABLE'),
             ('OL_ACTIVE_TRAVEL'),('OL_SECURITY'),('OL_PUBLIC_REALM'),
             ('OL_GRIEVANCE'),('OL_WELLBEING_AWARE'),('OL_GREEN_INFRA')) as v(code);

-- Age: numeric passthrough; normalized = position on an 18-80 band (placeholder).
insert into public.survey_value_maps (question_code, map_type, scale_min, scale_max, notes) values
  ('FS_AGE','scale_linear',18,80,'age; normalized is a mechanical 18-80 position (placeholder)');

-- Boolean: energy-settings awareness.
insert into public.survey_value_maps (question_code, map_type, match_value, value_numeric, value_normalized, notes) values
  ('OL_ENERGY_KNOW','boolean','Yes',1,100,''),
  ('OL_ENERGY_KNOW','boolean','No',0,0,'');

-- Field wellbeing awareness (client to confirm the 100/50/0 scoring).
insert into public.survey_value_maps (question_code, map_type, match_value, value_numeric, value_normalized, notes) values
  ('FS_WELLBEING_AWARE','categorical','Yes_POS',2,100,'aware, positive'),
  ('FS_WELLBEING_AWARE','categorical','YES_NEG',1,50,'aware, negative'),
  ('FS_WELLBEING_AWARE','categorical','NO_NEG',0,0,'unaware');

-- Proximity: engagement-intensity scoring (provisional).
insert into public.survey_value_maps (question_code, map_type, match_value, value_numeric, value_normalized, notes) values
  ('FS_PROXIMITY','categorical','DCW',4,100,'daily commuter/worker'),
  ('FS_PROXIMITY','categorical','LR',3,75,'local resident'),
  ('FS_PROXIMITY','categorical','Occ_Ten',2,50,'occasional tenant'),
  ('FS_PROXIMITY','categorical','FTV_Passerby',1,25,'first-time visitor / passerby');

-- Accessibility cohort: normalized = "standard access" share (0 = no constraints).
insert into public.survey_value_maps (question_code, map_type, match_value, value_numeric, value_normalized, notes) values
  ('FS_ACCESS_COHORT','categorical','0',0,100,'standard access'),
  ('FS_ACCESS_COHORT','categorical','1',1,0,'access constraint reported'),
  ('FS_ACCESS_COHORT','categorical','2',2,0,'access constraint reported'),
  ('FS_ACCESS_COHORT','categorical','3',3,0,'access constraint reported'),
  ('FS_ACCESS_COHORT','categorical','4',4,0,'access constraint reported');

-- Occupancy: residency-intensity scoring (provisional).
insert into public.survey_value_maps (question_code, map_type, match_value, value_numeric, value_normalized, notes) values
  ('OL_OCCUPANCY','categorical','Full-time Resident',3,100,''),
  ('OL_OCCUPANCY','categorical','Part-time/Commuter',2,67,''),
  ('OL_OCCUPANCY','categorical','Local Business Employee',1,33,''),
  ('OL_OCCUPANCY','categorical','Visitor/Community Member',0,0,'');

-- Offering chips: NOMINAL preferences. numeric = option code; normalized is a
-- mechanical spread (placeholder) — retune before any KPI references these.
insert into public.survey_value_maps (question_code, map_type, match_value, value_numeric, value_normalized, notes) values
  ('FS_OFFERING','categorical','HEALTH_Fit',1,0,'nominal placeholder'),
  ('FS_OFFERING','categorical','Green_Pock',2,20,'nominal placeholder'),
  ('FS_OFFERING','categorical','YPPL_Activity',3,40,'nominal placeholder'),
  ('FS_OFFERING','categorical','MWL_Events',4,60,'nominal placeholder'),
  ('FS_OFFERING','categorical','NEG_Need',5,80,'nominal placeholder'),
  ('FS_OFFERING','categorical','STREET_Safe',6,100,'nominal placeholder');

insert into public.survey_value_maps (question_code, map_type, match_value, value_numeric, value_normalized, notes)
select q, 'multi', v, n, z, 'nominal placeholder; multi supports piped values (A | B)'
from (values
  ('Expanded Green Space / Shading',1,0),
  ('Community Workshops & Social Events',2,25),
  ('Secure Bicycle & EV Infrastructure',3,50),
  ('Improved Lighting & Public Safety Measures',4,75),
  ('Local Business/Independent Retail Pop-ups',5,100)
) as o(v,n,z)
cross join (values ('OL_OFFERING_1'),('OL_OFFERING_2')) as c(q);

-- Backfill every existing answer through the mapping layer.
select public.apply_value_maps();
