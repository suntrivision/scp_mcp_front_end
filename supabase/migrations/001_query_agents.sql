-- Query agents for Y3 front end (Reporting / Exception prompts)
-- Run in Supabase SQL Editor or via supabase db push

create table if not exists public.query_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  context text not null check (context in ('reporting', 'exception')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists query_agents_context_updated_idx
  on public.query_agents (context, updated_at desc);

alter table public.query_agents enable row level security;

-- Open policies for anon key (tighten with auth.uid() for production)
create policy "query_agents_select_anon"
  on public.query_agents for select
  to anon, authenticated
  using (true);

create policy "query_agents_insert_anon"
  on public.query_agents for insert
  to anon, authenticated
  with check (true);

create policy "query_agents_update_anon"
  on public.query_agents for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "query_agents_delete_anon"
  on public.query_agents for delete
  to anon, authenticated
  using (true);
