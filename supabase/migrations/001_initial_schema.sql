-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id                      uuid references auth.users(id) on delete cascade primary key,
  email                   text not null,
  full_name               text,
  location                text,
  linkedin_url            text,
  resume_url              text,
  resume_text             text,
  notification_enabled    boolean not null default false,
  notification_frequency  text not null default 'daily'
                            check (notification_frequency in ('daily', 'weekly', 'instant')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create type public.notification_status as enum ('new', 'viewed', 'applied');

create table public.notifications (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  job_title   text not null,
  company     text not null,
  match_score integer not null check (match_score between 0 and 100),
  job_url     text,
  status      public.notification_status not null default 'new',
  created_at  timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications(user_id);
create index notifications_status_idx on public.notifications(status);
create index notifications_created_at_idx on public.notifications(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.notifications enable row level security;

-- Profiles: users own their own row
create policy "profiles_self_crud"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Notifications: users can read/update their own
create policy "notifications_self_select"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications_self_update"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role can insert notifications (used by Edge Function)
create policy "notifications_service_insert"
  on public.notifications for insert
  with check (true);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict do nothing;

create policy "resumes_self_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "resumes_self_select"
  on storage.objects for select
  using (
    bucket_id = 'resumes' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
