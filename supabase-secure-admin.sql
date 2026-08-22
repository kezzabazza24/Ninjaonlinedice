-- Ninja Online Dice: production security starter
-- Run this AFTER you have created your admin user in Supabase Authentication.

-- 1. Create an admin allow-list.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.admin_users enable row level security;

-- 2. Helper function used by policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

-- 3. Public users can still read rolls for verification.
drop policy if exists "public read rolls" on public.rolls;
create policy "public read rolls"
on public.rolls for select using (true);

-- 4. Remove direct public inserts.
drop policy if exists "public insert rolls" on public.rolls;

-- IMPORTANT:
-- Future roll creation should go through a Supabase Edge Function.
-- Do not re-add a public INSERT policy.

-- 5. Allow admins to read and manage rolls.
drop policy if exists "admin manage rolls" on public.rolls;
create policy "admin manage rolls"
on public.rolls for all
using (public.is_admin())
with check (public.is_admin());

-- After creating your admin account, run this to add it:
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL';
