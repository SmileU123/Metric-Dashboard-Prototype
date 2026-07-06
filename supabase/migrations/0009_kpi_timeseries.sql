-- =============================================================================
-- 0009_kpi_timeseries.sql
-- Execution-history layer: persisted QUARTERLY KPI snapshots (audit item #5) plus
-- a period-over-period drift view (item #7).
--
-- Surveys run on a quarterly/biannual cadence, so history is bucketed by quarter
-- (period = 'YYYY-Qn'). kpi_result holds the latest snapshot; kpi_timeseries
-- holds the quarterly history that trend lines and drift metrics read from in a
-- production/scheduled setup. (The Phase-1 UI computes filtered quarterly trends
-- live for interactivity; this is the stored history.)
-- =============================================================================

create table public.kpi_timeseries (
  id               uuid primary key default gen_random_uuid(),
  kpi_id           uuid not null references public.kpi_definition(id) on delete cascade,
  tenant_id        text not null references public.tenants(id) on delete cascade,
  project_id       uuid references public.projects(id) on delete cascade,
  period           text not null,                 -- 'YYYY-Qn'
  value            numeric not null,
  compliance_state text not null check (compliance_state in ('green','amber','red')),
  created_at       timestamptz not null default now(),
  unique (kpi_id, tenant_id, period)
);
create index kpi_timeseries_lookup on public.kpi_timeseries (tenant_id, kpi_id, period);

-- Populate the last N months of snapshots for a tenant (same math as
-- recompute_kpis, windowed per calendar month).
create or replace function public.recompute_kpi_timeseries(
  p_tenant   text,
  p_quarters integer default 6
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d       record;
  s       record;
  th      record;
  i       integer;
  qstart  date;
  qend    date;
  v_period text;
  weights numeric[];
  means   numeric[];
  sval    numeric;
  kval    numeric;
  nlo     numeric;
  nhi     numeric;
  st      text;
begin
  for i in 0 .. (p_quarters - 1) loop
    qstart := (date_trunc('quarter', now()) - make_interval(months => (p_quarters - 1 - i) * 3))::date;
    qend   := (qstart + interval '3 months')::date;
    v_period := to_char(qstart, 'YYYY') || '-Q' || extract(quarter from qstart)::int;

    for d in
      select * from kpi_definition
      where is_active and (tenant_id is null or tenant_id = p_tenant)
    loop
      weights := '{}';
      means   := '{}';

      -- Dynamic source read (see 0005): survey_answers by question code; the
      -- mapping layer (0011) owns normalization.
      for s in select * from kpi_sources where kpi_id = d.id and is_active loop
        if d.calculation_type = 'direct_tenure_split' then
          -- 50/50 by tenure: average of the per-tenure means for the quarter.
          select avg(g.tenure_mean) into sval
          from (
            select avg(a.value_normalized) as tenure_mean
            from survey_answers a
            join survey_responses r on r.id = a.response_id
            where a.question_code = upper(s.source_key)
              and a.value_normalized is not null
              and r.tenant_id = p_tenant
              and r.submitted_at >= qstart
              and r.submitted_at <  qend
              and r.tenure is not null
            group by r.tenure
          ) g;
        else
          select avg(a.value_normalized) into sval
          from survey_answers a
          join survey_responses r on r.id = a.response_id
          where a.question_code = upper(s.source_key)
            and a.value_normalized is not null
            and r.tenant_id = p_tenant
            and r.submitted_at >= qstart
            and r.submitted_at <  qend;
        end if;

        if sval is not null then
          weights := weights || s.weight;
          means   := means || sval;
        end if;
      end loop;

      if coalesce(array_length(means, 1), 0) = 0 then
        continue;  -- no data this quarter; skip the row
      end if;

      case d.calculation_type
        when 'ratio' then
          kval := case when array_length(means,1) >= 2 and means[2] <> 0
                       then 100 * means[1] / means[2] else means[1] end;
        when 'weighted_sum' then
          select sum(w * m) into kval from unnest(weights, means) as x(w, m);
        when 'direct' then
          kval := means[1];
        when 'direct_tenure_split' then
          kval := means[1];  -- already tenure-balanced above
        else
          select sum(w * m) / nullif(sum(w), 0) into kval
          from unnest(weights, means) as x(w, m);
      end case;

      select coalesce(normalization_min, 0), coalesce(normalization_max, 100)
        into nlo, nhi from kpi_formula where kpi_id = d.id limit 1;
      nlo := coalesce(nlo, 0);
      nhi := coalesce(nhi, 100);
      kval := greatest(nlo, least(nhi, coalesce(kval, 0)));

      select * into th from kpi_thresholds where kpi_id = d.id limit 1;
      if not found then st := 'green';
      elsif kval >= th.green_min then st := 'green';
      elsif kval >= th.amber_min then st := 'amber';
      else st := 'red';
      end if;

      insert into kpi_timeseries (kpi_id, tenant_id, period, value, compliance_state)
      values (d.id, p_tenant, v_period, round(kval, 1), st)
      on conflict (kpi_id, tenant_id, period)
      do update set value = excluded.value,
                    compliance_state = excluded.compliance_state,
                    created_at = now();
    end loop;
  end loop;
end $$;

-- Period-over-period drift (item #7). security_invoker so it honors the
-- caller's RLS on kpi_timeseries (no cross-tenant leak).
create view public.kpi_drift
with (security_invoker = on) as
select
  kpi_id,
  tenant_id,
  period,
  value,
  compliance_state,
  value - lag(value) over (
    partition by kpi_id, tenant_id order by period
  ) as delta_vs_prev
from public.kpi_timeseries;

-- RLS: tenant-scoped (Stream A), plus Phase-1 demo anon read.
alter table public.kpi_timeseries enable row level security;
create policy kpi_ts_member_read on public.kpi_timeseries
  for select using (tenant_id in (select public.current_tenant_ids()));
create policy demo_anon_kpi_ts on public.kpi_timeseries
  for select to anon using (true);

-- Materialize history for the demo tenants.
select public.recompute_kpi_timeseries('cln-0010', 6);
