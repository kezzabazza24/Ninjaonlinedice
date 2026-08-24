-- Ninja Online Dice: VIP members and personalised VIP pages
-- Run this after supabase-secure-admin.sql.

create table if not exists public.vip_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  page_slug text not null unique,
  created_at timestamptz not null default now()
);

alter table public.vip_members enable row level security;

drop policy if exists "vip members read own profile" on public.vip_members;
create policy "vip members read own profile"
on public.vip_members for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "admins manage vip members" on public.vip_members;
create policy "admins manage vip members"
on public.vip_members for all
using (public.is_admin())
with check (public.is_admin());

-- Example: after creating a VIP user in Supabase Authentication,
-- copy their UUID and add them from the VIP CONTROL page,
-- or run:
-- insert into public.vip_members (user_id, display_name, page_slug)
-- values ('USER-UUID-HERE', 'THE RULEBREAKER', 'therulebreaker');
