-- =============================================================================
-- 0005_kpi_engine.sql
-- Configurable KPI ENGINE (client's final design).
--
--   Survey Data (Q1–Q10)
--         ↓  KPI_Sources    (what feeds each KPI + weight + transformation)
--         ↓  KPI_Formula    (how the sources combine: weighted_sum / ratio / index)
--         ↓  KPI_Thresholds (compliance evaluation → green / amber / red)
--         ↓  KPI_Result     (runtime output table Page 1 reads)
--         ↓  KPI_RunLog     (audit / debug layer)
--
-- Everything about a KPI — its inputs, weights, formula, thresholds — is DATA,
-- so KPIs are added/retuned with INSERT/UPDATE, never code. Global KPIs use
-- tenant_id IS NULL; a tenant may define its own.
-- =============================================================================

-- 1. KPI_Definition — master config -------------------------------------------
create table public.kpi_definition (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        text references public.tenants(id) on delete cascade, -- NULL = global
  project_id       uuid references public.projects(id) on delete cascade, -- NULL = all projects
  kpi_code         text not null,
  kpi_name         text not null,
  description      text not null default '',
  category         text not null default 'general',
  unit             text not null default 'pts',        -- display suffix, e.g. 'pts', '%'
  unit_type        text not null default 'points'
                     check (unit_type in ('score','percentage','ratio','points')),
  display_format   text not null default 'fixed_1dp'
                     check (display_format in ('raw','percent','fixed_1dp')),
  calculation_type text not null default 'weighted_average'
                     check (calculation_type in ('weighted_average','weighted_sum','ratio','index','direct')),
  is_composite     boolean not null default false,
  is_active        boolean not null default true,
  display_order    smallint not null default 0,
  created_at       timestamptz not null default now()
);
-- Unique KPI code within a scope (global vs a specific tenant).
create unique index kpi_definition_code_uidx
  on public.kpi_definition (coalesce(tenant_id, '~global'), kpi_code);

-- 2. KPI_Sources — what feeds the KPI -----------------------------------------
create table public.kpi_sources (
  id             uuid primary key default gen_random_uuid(),
  kpi_id         uuid not null references public.kpi_definition(id) on delete cascade,
  source_type    text not null default 'survey'
                   check (source_type in ('survey','external','computed')),
  source_key     text not null,               -- e.g. 'q4_score', 'housing_cost_to_income'
  weight         numeric not null default 1,
  transformation text not null default 'passthrough'
                   check (transformation in
                     ('passthrough','normalize_1_5_to_0_100','invert_cost_to_income')),
  is_active      boolean not null default true
);
create index kpi_sources_kpi_idx on public.kpi_sources (kpi_id);

-- 3. KPI_Formula — optional rule engine ---------------------------------------
create table public.kpi_formula (
  id                uuid primary key default gen_random_uuid(),
  kpi_id            uuid not null references public.kpi_definition(id) on delete cascade,
  formula_type      text not null default 'weighted_sum'
                      check (formula_type in ('weighted_sum','weighted_average','ratio','index','direct')),
  expression        text not null default '',
  normalization_min numeric not null default 0,
  normalization_max numeric not null default 100
);
create index kpi_formula_kpi_idx on public.kpi_formula (kpi_id);

-- 4. KPI_Thresholds — compliance engine ---------------------------------------
create table public.kpi_thresholds (
  id             uuid primary key default gen_random_uuid(),
  kpi_id         uuid not null references public.kpi_definition(id) on delete cascade,
  condition_type text not null default 'score_range'
                   check (condition_type in ('absolute','percentage','score_range')),
  green_min      numeric not null default 75,
  amber_min      numeric not null default 50,
  red_min        numeric not null default 0,
  is_global      boolean not null default true
);
create index kpi_thresholds_kpi_idx on public.kpi_thresholds (kpi_id);

-- 5. KPI_Result — runtime output (Page 1 reads this) --------------------------
create table public.kpi_result (
  id               uuid primary key default gen_random_uuid(),
  kpi_id           uuid not null references public.kpi_definition(id) on delete cascade,
  tenant_id        text not null references public.tenants(id) on delete cascade,
  project_id       uuid references public.projects(id) on delete cascade,
  value            numeric not null,
  compliance_state text not null check (compliance_state in ('green','amber','red')),
  data_period      text not null default 'live',
  calculated_at    timestamptz not null default now()
);
create index kpi_result_lookup_idx on public.kpi_result (tenant_id, kpi_id, calculated_at desc);

-- 6. KPI_RunLog — audit / debug -----------------------------------------------
create table public.kpi_runlog (
  id                  uuid primary key default gen_random_uuid(),
  kpi_id              uuid references public.kpi_definition(id) on delete set null,
  tenant_id           text references public.tenants(id) on delete cascade,
  input_records_count integer not null default 0,
  calculation_version text not null default 'v1',
  execution_time_ms   numeric not null default 0,
  status              text not null default 'success' check (status in ('success','failed')),
  error_message       text,
  created_at          timestamptz not null default now()
);
create index kpi_runlog_tenant_idx on public.kpi_runlog (tenant_id, created_at desc);

-- -----------------------------------------------------------------------------
-- The ENGINE: read survey data → apply sources/weights/transform → threshold →
-- write KPI_Result + KPI_RunLog. This is the server-side batch path (Phase 3
-- runs it on a schedule / event). The frontend mirrors it in TypeScript so the
-- Phase 1 prototype stays interactive under Q1–Q3 filters.
-- -----------------------------------------------------------------------------
create or replace function public.recompute_kpis(
  p_tenant  text,
  p_project uuid default null,
  p_period  text default 'live'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d       record;
  s       record;
  th      record;
  t0      timestamptz;
  nrec    integer;
  weights numeric[];
  means   numeric[];
  sval    numeric;
  kval    numeric;
  nlo     numeric;
  nhi     numeric;
  st      text;
begin
  for d in
    select * from kpi_definition
    where is_active and (tenant_id is null or tenant_id = p_tenant)
    order by display_order
  loop
    t0 := clock_timestamp();
    weights := '{}';
    means   := '{}';

    select count(*) into nrec
    from survey_responses r
    where r.tenant_id = p_tenant
      and (p_project is null or r.project_id = p_project);

    -- per-source transformed mean
    for s in select * from kpi_sources where kpi_id = d.id and is_active loop
      select avg(
               case s.transformation
                 when 'invert_cost_to_income'
                   then greatest(0, least(100, 100 - (col.v - 25) * 3))
                 when 'normalize_1_5_to_0_100'
                   then (col.v - 1) / 4.0 * 100
                 else col.v
               end)
      into sval
      from survey_responses r
      cross join lateral (
        select case s.source_key
                 when 'q4_score' then r.q4_score
                 when 'q5_score' then r.q5_score
                 when 'q6_score' then r.q6_score
                 when 'q7_score' then r.q7_score
                 when 'q8_score' then r.q8_score
                 when 'q9_score' then r.q9_score
                 when 'housing_cost_to_income' then r.housing_cost_to_income
                 else null
               end::numeric as v
      ) col
      where r.tenant_id = p_tenant
        and (p_project is null or r.project_id = p_project);

      if sval is not null then
        weights := weights || s.weight;
        means   := means || sval;
      end if;
    end loop;

    -- combine per calculation_type
    if coalesce(array_length(means, 1), 0) = 0 then
      kval := 0;
    else
      case d.calculation_type
        when 'ratio' then
          kval := case when array_length(means,1) >= 2 and means[2] <> 0
                       then 100 * means[1] / means[2] else means[1] end;
        when 'weighted_sum' then
          select sum(w * m) into kval from unnest(weights, means) as x(w, m);
        when 'direct' then
          kval := means[1];
        else -- weighted_average, index
          select sum(w * m) / nullif(sum(w), 0) into kval
          from unnest(weights, means) as x(w, m);
      end case;
    end if;

    -- normalization clamp
    select coalesce(normalization_min, 0), coalesce(normalization_max, 100)
      into nlo, nhi from kpi_formula where kpi_id = d.id limit 1;
    nlo := coalesce(nlo, 0);
    nhi := coalesce(nhi, 100);
    kval := greatest(nlo, least(nhi, coalesce(kval, 0)));

    -- threshold evaluation
    select * into th from kpi_thresholds where kpi_id = d.id limit 1;
    if not found then st := 'green';
    elsif kval >= th.green_min then st := 'green';
    elsif kval >= th.amber_min then st := 'amber';
    else st := 'red';
    end if;

    insert into kpi_result
      (kpi_id, tenant_id, project_id, value, compliance_state, data_period, calculated_at)
    values (d.id, p_tenant, p_project, round(kval, 1), st, p_period, now());

    insert into kpi_runlog
      (kpi_id, tenant_id, input_records_count, calculation_version, execution_time_ms, status)
    values (d.id, p_tenant, nrec, 'v1',
            round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 2), 'success');
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Row-Level Security
-- -----------------------------------------------------------------------------
alter table public.kpi_definition enable row level security;
alter table public.kpi_sources    enable row level security;
alter table public.kpi_formula    enable row level security;
alter table public.kpi_thresholds enable row level security;
alter table public.kpi_result     enable row level security;
alter table public.kpi_runlog     enable row level security;

-- Definitions: global (NULL) or own-tenant readable.
create policy kpi_def_read on public.kpi_definition
  for select using (tenant_id is null or tenant_id in (select public.current_tenant_ids()));

-- Child config tables inherit visibility from their KPI definition.
create policy kpi_src_read on public.kpi_sources
  for select using (kpi_id in (select id from public.kpi_definition));
create policy kpi_formula_read on public.kpi_formula
  for select using (kpi_id in (select id from public.kpi_definition));
create policy kpi_thr_read on public.kpi_thresholds
  for select using (kpi_id in (select id from public.kpi_definition));

-- Results + logs are tenant-scoped (Stream A).
create policy kpi_result_read on public.kpi_result
  for select using (tenant_id in (select public.current_tenant_ids()));
create policy kpi_runlog_read on public.kpi_runlog
  for select using (tenant_id in (select public.current_tenant_ids()));

-- =============================================================================
-- SEED: six standardized (global) KPIs with sources, formula, thresholds.
-- =============================================================================
insert into public.kpi_definition
  (tenant_id, kpi_code, kpi_name, description, category, unit, unit_type, display_format, calculation_type, is_composite, display_order)
values
  (null,'LOCAL_ENV_QUALITY','Local Health & Environmental Quality','Composite of environmental/health quality and wellbeing signal.','environmental','pts','points','fixed_1dp','weighted_average',true,1),
  (null,'PR_SAFETY_ACCESS','Public Realm Safety & Accessibility','Perception of safety, lighting, inclusivity and access of open spaces.','public_realm','pts','points','fixed_1dp','weighted_average',true,2),
  (null,'SUS_MOBILITY','Sustainable Mobility Integration','Satisfaction with low-carbon transit, cycle storage and access.','mobility','pts','points','fixed_1dp','direct',false,3),
  (null,'SUSTAINABILITY','Sustainability Performance','Composite sustainability and environmental-quality signal.','sustainability','pts','points','fixed_1dp','weighted_average',true,4),
  (null,'COMMUNITY_WELLBEING','Community Wellbeing & Belonging','Belonging, community and overall wellbeing themes.','community','pts','points','fixed_1dp','weighted_average',true,5),
  (null,'HOUSING_AFFORDABILITY','Housing Affordability','Cost-to-income ratio inverted to a 0–100 affordability score (higher = more affordable).','housing','pts','points','fixed_1dp','direct',false,6);

-- Sources (source_key = survey column; weight; transformation)
insert into public.kpi_sources (kpi_id, source_type, source_key, weight, transformation)
select id, 'survey', k, w, tr from (values
  ('LOCAL_ENV_QUALITY','q4_score',0.6,'passthrough'),
  ('LOCAL_ENV_QUALITY','q9_score',0.4,'passthrough'),
  ('PR_SAFETY_ACCESS','q5_score',0.7,'passthrough'),
  ('PR_SAFETY_ACCESS','q8_score',0.3,'passthrough'),
  ('SUS_MOBILITY','q6_score',1.0,'passthrough'),
  ('SUSTAINABILITY','q7_score',0.7,'passthrough'),
  ('SUSTAINABILITY','q4_score',0.3,'passthrough'),
  ('COMMUNITY_WELLBEING','q8_score',0.5,'passthrough'),
  ('COMMUNITY_WELLBEING','q9_score',0.5,'passthrough'),
  ('HOUSING_AFFORDABILITY','housing_cost_to_income',1.0,'invert_cost_to_income')
) as v(code,k,w,tr)
join public.kpi_definition d on d.kpi_code = v.code and d.tenant_id is null;

-- Formula
insert into public.kpi_formula (kpi_id, formula_type, expression)
select id, ft, expr from (values
  ('LOCAL_ENV_QUALITY','weighted_average','Q4*0.6 + Q9*0.4'),
  ('PR_SAFETY_ACCESS','weighted_average','Q5*0.7 + Q8*0.3'),
  ('SUS_MOBILITY','direct','Q6'),
  ('SUSTAINABILITY','weighted_average','Q7*0.7 + Q4*0.3'),
  ('COMMUNITY_WELLBEING','weighted_average','Q8*0.5 + Q9*0.5'),
  ('HOUSING_AFFORDABILITY','index','100 - normalize(cost_to_income)')
) as v(code,ft,expr)
join public.kpi_definition d on d.kpi_code = v.code and d.tenant_id is null;

-- Thresholds
insert into public.kpi_thresholds (kpi_id, condition_type, green_min, amber_min, red_min)
select id, 'score_range', g, a, 0 from (values
  ('LOCAL_ENV_QUALITY',75,50),
  ('PR_SAFETY_ACCESS',70,45),
  ('SUS_MOBILITY',70,45),
  ('SUSTAINABILITY',72,48),
  ('COMMUNITY_WELLBEING',68,45),
  ('HOUSING_AFFORDABILITY',65,45)
) as v(code,g,a)
join public.kpi_definition d on d.kpi_code = v.code and d.tenant_id is null;

-- Materialize an initial period snapshot + run log for each tenant.
select public.recompute_kpis('northgate', null, '2026-Q2');
select public.recompute_kpis('meridian',  null, '2026-Q2');
