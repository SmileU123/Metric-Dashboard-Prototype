-- =============================================================================
-- 0012_chat_temp.sql  —  TEMPORARY in-platform chat (Phase-1 coordination).
--
-- A lightweight shared message table so the developer and the client can talk
-- directly inside the dashboard while signal / scheduling is unreliable. Demo
-- policies: anyone (anon) can read and post — there is no auth in Phase 1.
-- Intended to be dropped in Phase 2. Safe to run more than once (idempotent).
-- =============================================================================
create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  text,
  sender     text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_tenant_time_idx
  on public.chat_messages (tenant_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages
  for select using (true);

drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert on public.chat_messages
  for insert with check (true);
