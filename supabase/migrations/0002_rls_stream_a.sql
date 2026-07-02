-- =============================================================================
-- 0002_rls_stream_a.sql
-- Stream A: granular, per-tenant data isolation via Row-Level Security.
--
-- A signed-in user may only read/write rows belonging to a tenant they are a
-- member of. There is NO cross-tenant leakage at the database boundary — even a
-- bug in the frontend cannot widen access beyond a user's memberships.
--
-- (Phase 1 uses a dummy/anon demo, so the app also has a seed fallback. These
--  policies are the real access model that Phase 2/3 logins switch on.)
-- =============================================================================

-- Helper: the set of tenant ids the current auth user belongs to.
create or replace function public.current_tenant_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.tenant_members
  where user_id = auth.uid();
$$;

-- Enable RLS on every tenant-scoped table.
-- (KPI engine tables enable their own RLS in 0005_kpi_engine.sql.)
alter table public.tenants          enable row level security;
alter table public.projects         enable row level security;
alter table public.tenant_members   enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_answers   enable row level security;

-- ---- tenants ----------------------------------------------------------------
create policy tenants_member_read on public.tenants
  for select using ( id in (select public.current_tenant_ids()) );

-- ---- projects ---------------------------------------------------------------
create policy projects_member_read on public.projects
  for select using ( tenant_id in (select public.current_tenant_ids()) );

create policy projects_owner_write on public.projects
  for all using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = auth.uid() and role in ('owner','analyst')
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = auth.uid() and role in ('owner','analyst')
    )
  );

-- ---- tenant_members ---------------------------------------------------------
create policy members_self_read on public.tenant_members
  for select using ( user_id = auth.uid() );

-- ---- survey_responses (Stream A) --------------------------------------------
create policy responses_member_read on public.survey_responses
  for select using ( tenant_id in (select public.current_tenant_ids()) );

create policy responses_member_insert on public.survey_responses
  for insert with check ( tenant_id in (select public.current_tenant_ids()) );

create policy responses_member_update on public.survey_responses
  for update using ( tenant_id in (select public.current_tenant_ids()) )
  with check ( tenant_id in (select public.current_tenant_ids()) );

-- ---- survey_questions (global catalog — readable to everyone) ---------------
create policy questions_read on public.survey_questions
  for select using ( true );

-- ---- survey_answers (inherit visibility from their response) -----------------
create policy answers_member_read on public.survey_answers
  for select using ( response_id in (select id from public.survey_responses) );
