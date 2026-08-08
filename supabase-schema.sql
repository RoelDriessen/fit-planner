-- Fit Planner schema. Run once in a fresh Supabase project's SQL Editor.
-- Idempotent: safe to re-run (if not exists / drop-then-create policy style).
--
-- On a project that already ran an earlier version of this file (before routines
-- and multi-user profiles existed), run supabase-schema-2-routines-multiuser.sql
-- instead — it's a guarded, destructive-where-necessary migration for an
-- already-provisioned project. This file is the from-scratch bootstrap.

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists exercise_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#6d8dff',
  created_at timestamptz not null default now()
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references exercise_categories(id) on delete set null,
  created_by_app_user_id uuid references app_users(id) on delete set null,
  name text not null,
  notes text,
  default_duration_minutes integer,
  video_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
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

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_user_id uuid not null references app_users(id) on delete cascade,
  routine_id uuid references routines(id) on delete set null,
  scheduled_date date not null,
  scheduled_time time,
  status text not null default 'planned' check (status in ('planned', 'done', 'skipped')),
  completed_at timestamptz,
  points_awarded integer,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists user_settings (
  app_user_id uuid primary key references app_users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  timezone text not null default 'Europe/Amsterdam',
  daily_reminder_enabled boolean not null default true,
  daily_reminder_time time not null default '18:00',
  weekly_reminder_enabled boolean not null default true,
  weekly_reminder_day smallint not null default 0 check (weekly_reminder_day between 0 and 6),
  weekly_reminder_time time not null default '18:00',
  last_daily_reminder_sent_date date,
  last_weekly_reminder_sent_date date,
  preferred_workout_media text not null default 'video' check (preferred_workout_media in ('video', 'image')),
  updated_at timestamptz not null default now()
);
-- Safety net for projects that ran an earlier version of this file before preferred_workout_media existed.
alter table user_settings add column if not exists preferred_workout_media text not null default 'video' check (preferred_workout_media in ('video', 'image'));

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_user_id uuid not null references app_users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists exercise_attachments (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists app_users_user_id_idx on app_users(user_id);
create index if not exists exercises_user_id_idx on exercises(user_id);
create index if not exists exercises_category_id_idx on exercises(category_id);
create index if not exists exercises_created_by_app_user_id_idx on exercises(created_by_app_user_id);
create index if not exists routines_user_id_idx on routines(user_id);
create index if not exists routines_app_user_id_idx on routines(app_user_id);
create index if not exists routine_exercises_routine_id_idx on routine_exercises(routine_id);
create index if not exists routine_exercises_exercise_id_idx on routine_exercises(exercise_id);
create index if not exists routine_exercises_user_id_idx on routine_exercises(user_id);
create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists sessions_app_user_id_idx on sessions(app_user_id);
create index if not exists sessions_scheduled_date_idx on sessions(scheduled_date);
create index if not exists sessions_routine_id_idx on sessions(routine_id);
create index if not exists push_subscriptions_user_id_idx on push_subscriptions(user_id);
create index if not exists push_subscriptions_app_user_id_idx on push_subscriptions(app_user_id);
create index if not exists exercise_attachments_exercise_id_idx on exercise_attachments(exercise_id);
create index if not exists exercise_attachments_user_id_idx on exercise_attachments(user_id);

alter table app_users enable row level security;
alter table exercise_categories enable row level security;
alter table exercises enable row level security;
alter table routines enable row level security;
alter table routine_exercises enable row level security;
alter table sessions enable row level security;
alter table user_settings enable row level security;
alter table push_subscriptions enable row level security;
alter table exercise_attachments enable row level security;

drop policy if exists "app_users_owner" on app_users;
create policy "app_users_owner" on app_users
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "exercise_categories_owner" on exercise_categories;
create policy "exercise_categories_owner" on exercise_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "exercises_owner" on exercises;
create policy "exercises_owner" on exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "routines_owner" on routines;
create policy "routines_owner" on routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "routine_exercises_owner" on routine_exercises;
create policy "routine_exercises_owner" on routine_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sessions_owner" on sessions;
create policy "sessions_owner" on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_settings_owner" on user_settings;
create policy "user_settings_owner" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_owner" on push_subscriptions;
create policy "push_subscriptions_owner" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "exercise_attachments_owner" on exercise_attachments;
create policy "exercise_attachments_owner" on exercise_attachments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
    where pubname = 'supabase_realtime' and tablename = 'exercise_categories'
  ) then
    alter publication supabase_realtime add table exercise_categories;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'exercises'
  ) then
    alter publication supabase_realtime add table exercises;
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
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'user_settings'
  ) then
    alter publication supabase_realtime add table user_settings;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'push_subscriptions'
  ) then
    alter publication supabase_realtime add table push_subscriptions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'exercise_attachments'
  ) then
    alter publication supabase_realtime add table exercise_attachments;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Private storage bucket for exercise photos (PNG/JPG, enforced client-side).
-- If this insert errors due to permissions, create it manually instead:
-- Dashboard -> Storage -> New bucket -> name "exercise-attachments", uncheck "Public bucket".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('exercise-attachments', 'exercise-attachments', false)
on conflict (id) do nothing;

-- Files are stored under "<user_id>/<exercise_id>/<filename>" — this policy makes sure
-- everyone can only read/write/delete files inside their own "<user_id>/..." folder.
drop policy if exists "exercise_attachments_storage_owner" on storage.objects;
create policy "exercise_attachments_storage_owner" on storage.objects
  for all
  using (bucket_id = 'exercise-attachments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'exercise-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Scheduled reminders (pg_cron + pg_net). NEW pattern for this project — the
-- sibling "Gerechten" app has no precedent for this. Run this block ONLY
-- after the send-reminders Edge Function is deployed (see supabase/functions/
-- send-reminders) and its CRON_SECRET is set, since <PROJECT_REF> and
-- <CRON_SECRET> below need to be filled in by hand first.
-- ---------------------------------------------------------------------------

-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'send-reminders-every-10-min',
--   '*/10 * * * *',
--   $cron$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-cron-secret', '<CRON_SECRET>'
--     ),
--     body := '{}'::jsonb
--   );
--   $cron$
-- );
--
-- To change frequency:   select cron.schedule('send-reminders-every-10-min', '*/5 * * * *', ...);
-- To remove the job:     select cron.unschedule('send-reminders-every-10-min');
