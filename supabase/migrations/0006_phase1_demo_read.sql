-- =============================================================================
-- 0006_phase1_demo_read.sql
--
-- ⚠️  DEMO ONLY (Phase 1). The dashboard runs UNAUTHENTICATED (anon role) against
-- mock data, so we grant the anon role READ access to the tenant-scoped tables.
--
-- REMOVE THIS MIGRATION when Phase 2/3 introduces real logins. From that point
-- Stream A isolation relies solely on the authenticated member policies in
-- 0002_rls_stream_a.sql and 0005_kpi_engine.sql. These permissive policies would
-- otherwise expose all tenants' mock data to anyone holding the public anon key.
-- =============================================================================

create policy demo_anon_tenants
  on public.tenants for select to anon using (true);

create policy demo_anon_projects
  on public.projects for select to anon using (true);

create policy demo_anon_responses
  on public.survey_responses for select to anon using (true);

-- KPI global config (tenant_id IS NULL) is already anon-readable via 0005;
-- results/logs aren't queried by the Phase-1 frontend (it computes in-app), but
-- expose them too so the data is inspectable during the demo.
create policy demo_anon_kpi_result
  on public.kpi_result for select to anon using (true);

create policy demo_anon_kpi_runlog
  on public.kpi_runlog for select to anon using (true);
