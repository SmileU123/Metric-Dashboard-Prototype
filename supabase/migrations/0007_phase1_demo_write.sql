-- =============================================================================
-- 0007_phase1_demo_write.sql
--
-- ⚠️  DEMO ONLY (Phase 1). Lets the unauthenticated anon role EDIT the KPI engine
-- config from the KPI Engine page (add / edit / delete KPIs, tune weights and
-- thresholds) so the "configurable engine" is demonstrable without auth.
--
-- REMOVE when Phase 2/3 introduces logins — config writes should then be limited
-- to authenticated owners/analysts (see kpi_*_write patterns to add later).
-- =============================================================================

create policy demo_anon_kpi_def_write
  on public.kpi_definition for all to anon using (true) with check (true);

create policy demo_anon_kpi_src_write
  on public.kpi_sources for all to anon using (true) with check (true);

create policy demo_anon_kpi_formula_write
  on public.kpi_formula for all to anon using (true) with check (true);

create policy demo_anon_kpi_thr_write
  on public.kpi_thresholds for all to anon using (true) with check (true);
