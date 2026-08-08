-- Fit Planner incremental migration: routines + multi-user profiles.
-- Safe to re-run (idempotent: if not exists / drop policy if exists / guarded destructive blocks).
--
-- IMPORTANT — read before running: this migration TRUNCATES `sessions`,
-- `push_subscriptions`, and `user_settings` (their shape changes in ways that
-- can't carry old rows forward: exercise_id -> routine_id, and a new required
-- app_user_id with no historical value to backfill it from). Only run this if
-- you're fine losing whatever is currently in those three tables.
--
-- Order matters because of foreign keys: app_users must exist before routines,
-- exercises.created_by_app_user_id, sessions.app_user_id, user_settings.app_user_id,
-- and push_subscriptions.app_user_id.

-- ---------------------------------------------------------------------------
-- 1. New tables
-- ---------------------------------------------------------------------------

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  notes text,
  sets integer not null default 1,
  points_value integer not null default 10,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null references routines(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,
  reps integer,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
-- No app_user_id here on purpose: derive it via routine_id -> routines.app_user_id
-- (same idiom app.js already uses for exerciseById()/categoryById()) rather than
-- duplicating state that could drift from its parent routine.

-- ---------------------------------------------------------------------------
-- 2. exercises: drop sets/reps/points (now live on routines), add creator
-- ---------------------------------------------------------------------------

alter table exercises drop column if exists default_sets;
alter table exercises drop column if exists default_reps;
alter table exercises drop column if exists points_value;
alter table exercises add column if not exists created_by_app_user_id uuid references app_users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 3. sessions: exercise_id -> routine_id + app_user_id (destructive, one-time)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sessions' and column_name = 'exercise_id'
  ) then
    truncate table sessions;
    alter table sessions drop column exercise_id;
    alter table sessions add column routine_id uuid references routines(id) on delete set null;
    alter table sessions add column app_user_id uuid not null references app_users(id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. push_subscriptions: add app_user_id (destructive, one-time)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'push_subscriptions' and column_name = 'app_user_id'
  ) then
    truncate table push_subscriptions;
    alter table push_subscriptions add column app_user_id uuid not null references app_users(id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. user_settings: primary key user_id -> app_user_id (destructive, one-time)
-- Note: the RLS policy referencing user_id must be dropped before the column,
-- or Postgres refuses the alter table drop column. Recreated in section 7.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_settings' and column_name = 'app_user_id'
  ) then
    truncate table user_settings;
    drop policy if exists "user_settings_owner" on user_settings;
    alter table user_settings drop constraint if exists user_settings_pkey;
    alter table user_settings drop column user_id;
    alter table user_settings add column app_user_id uuid not null references app_users(id) on delete cascade;
    alter table user_settings add column user_id uuid not null references auth.users(id) on delete cascade;
    alter table user_settings add constraint user_settings_pkey primary key (app_user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Indexes
-- ---------------------------------------------------------------------------

create index if not exists app_users_user_id_idx on app_users(user_id);
create index if not exists routines_user_id_idx on routines(user_id);
create index if not exists routines_app_user_id_idx on routines(app_user_id);
create index if not exists routine_exercises_routine_id_idx on routine_exercises(routine_id);
create index if not exists routine_exercises_exercise_id_idx on routine_exercises(exercise_id);
create index if not exists routine_exercises_user_id_idx on routine_exercises(user_id);
create index if not exists exercises_created_by_app_user_id_idx on exercises(created_by_app_user_id);
create index if not exists sessions_routine_id_idx on sessions(routine_id);
create index if not exists sessions_app_user_id_idx on sessions(app_user_id);
create index if not exists push_subscriptions_app_user_id_idx on push_subscriptions(app_user_id);

-- ---------------------------------------------------------------------------
-- 7. RLS — only the 3 new tables + user_settings need (re)declaring.
-- exercises/sessions/push_subscriptions policies still reference only user_id,
-- which was never dropped from them, so they remain valid as-is.
-- ---------------------------------------------------------------------------

alter table app_users enable row level security;
alter table routines enable row level security;
alter table routine_exercises enable row level security;

drop policy if exists "app_users_owner" on app_users;
create policy "app_users_owner" on app_users
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "routines_owner" on routines;
create policy "routines_owner" on routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "routine_exercises_owner" on routine_exercises;
create policy "routine_exercises_owner" on routine_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_settings_owner" on user_settings;
create policy "user_settings_owner" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 8. Realtime
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'app_users'
  ) then
    alter publication supabase_realtime add table app_users;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'routines'
  ) then
    alter publication supabase_realtime add table routines;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'routine_exercises'
  ) then
    alter publication supabase_realtime add table routine_exercises;
  end if;
end $$;
