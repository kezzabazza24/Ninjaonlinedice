create table public.rolls (
  id bigint generated always as identity primary key,
  code text unique not null,
  colours text[] not null,
  created_at timestamptz not null default now()
);
alter table public.rolls enable row level security;
create policy "public read rolls" on public.rolls for select using (true);
create policy "public insert rolls" on public.rolls for insert with check (true);
alter publication supabase_realtime add table public.rolls;