-- Phase 1B: Secure likes with RLS while keeping current UX working
-- Goal: Make likes secure and future-proof with owner-only policies

-- 1) Turn on RLS for diary_entry_likes
alter table public.diary_entry_likes enable row level security;

-- 2) Read: allow authenticated users to read all likes (needed for UX/counts)
drop policy if exists likes_select_all on public.diary_entry_likes;
create policy likes_select_all on public.diary_entry_likes
  for select
  to authenticated
  using (true);

-- 3) Insert/Delete: only for the owner
drop policy if exists likes_insert_own on public.diary_entry_likes;
create policy likes_insert_own on public.diary_entry_likes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists likes_delete_own on public.diary_entry_likes;
create policy likes_delete_own on public.diary_entry_likes
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 4) Prevent duplicate likes with unique index
-- Fixed column name from entry_id to diary_entry_id to match actual schema
create unique index if not exists diary_entry_likes_unique
  on public.diary_entry_likes (diary_entry_id, user_id);

-- Verification queries (optional - comment out in production)
-- select 'RLS enabled on diary_entry_likes' as status, 
--        relrowsecurity as enabled 
-- from pg_class 
-- where relname = 'diary_entry_likes';

-- select 'Policies created' as status, 
--        count(*) as policy_count 
-- from pg_policies 
-- where tablename = 'diary_entry_likes';
