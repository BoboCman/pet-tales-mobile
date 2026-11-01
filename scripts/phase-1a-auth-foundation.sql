-- Phase 1A: Supabase Auth foundation (profiles + RLS)
-- Auto-create profile row + lock down public.users

-- 1) Columns & defaults
alter table public.users
  alter column id set not null,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.users
  add column if not exists stripe_customer_id text,
  add column if not exists marketing_opt_in boolean not null default false;

-- 2) updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row execute procedure public.set_updated_at();

-- 3) Auto-profile creation on auth.users insert
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
  insert into public.users (id, email, name, avatar_url, subscription_tier, is_onboarded, preferences)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url',''),
    coalesce(new.raw_user_meta_data->>'subscription_tier','free'),
    false,
    '{}'::jsonb
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 4) RLS on public.users
alter table public.users enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (auth.uid() = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id);
