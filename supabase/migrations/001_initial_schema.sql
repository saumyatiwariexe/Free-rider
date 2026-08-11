-- =============================================================
-- Free-Rider Tracker — Phase 1 Database Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 1: Create all tables (policies come after — they need all tables to exist)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.users (
  id         uuid primary key default gen_random_uuid(),
  clerk_id   text unique not null,
  name       text,
  email      text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.linked_accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  provider         text not null check (provider in ('github', 'figma', 'google_docs')),
  external_id      text not null,
  access_token_enc text not null,
  linked_at        timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  source_refs jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.contribution_events (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  provider   text not null check (provider in ('github', 'figma', 'google_docs')),
  type       text not null,
  timestamp  timestamptz not null,
  magnitude  numeric not null default 1,
  raw_ref    text,
  created_at timestamptz not null default now()
);

create index if not exists idx_contribution_events_group_user
  on public.contribution_events (group_id, user_id, timestamp);

create table if not exists public.submissions (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  snapshot_ref text
);

create table if not exists public.insight_reports (
  id                 uuid primary key default gen_random_uuid(),
  submission_id      uuid not null references public.submissions(id) on delete cascade unique,
  per_member_share   jsonb not null default '{}',
  timeline           jsonb not null default '[]',
  narrative_insights text[] not null default '{}',
  generated_at       timestamptz not null default now()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 2: Enable Row-Level Security on every table
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

alter table public.users               enable row level security;
alter table public.linked_accounts     enable row level security;
alter table public.groups              enable row level security;
alter table public.group_members       enable row level security;
alter table public.contribution_events enable row level security;
alter table public.submissions         enable row level security;
alter table public.insight_reports     enable row level security;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 3: RLS Policies (all tables exist now — no forward-reference errors)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- users
create policy "users: read own row"
  on public.users for select
  using (auth.uid()::text = clerk_id);

-- linked_accounts
create policy "linked_accounts: read own rows"
  on public.linked_accounts for select
  using (
    user_id = (select id from public.users where clerk_id = auth.uid()::text)
  );

-- groups (now group_members exists)
create policy "groups: read if member"
  on public.groups for select
  using (
    exists (
      select 1 from public.group_members gm
      join public.users u on u.id = gm.user_id
      where gm.group_id = public.groups.id
        and u.clerk_id = auth.uid()::text
    )
  );

-- group_members
create policy "group_members: read if same group"
  on public.group_members for select
  using (
    exists (
      select 1 from public.group_members gm2
      join public.users u on u.id = gm2.user_id
      where gm2.group_id = public.group_members.group_id
        and u.clerk_id = auth.uid()::text
    )
  );

-- contribution_events
create policy "contribution_events: read if group member"
  on public.contribution_events for select
  using (
    exists (
      select 1 from public.group_members gm
      join public.users u on u.id = gm.user_id
      where gm.group_id = public.contribution_events.group_id
        and u.clerk_id = auth.uid()::text
    )
  );

-- submissions
create policy "submissions: read if group member"
  on public.submissions for select
  using (
    exists (
      select 1 from public.group_members gm
      join public.users u on u.id = gm.user_id
      where gm.group_id = public.submissions.group_id
        and u.clerk_id = auth.uid()::text
    )
  );

-- insight_reports
create policy "insight_reports: read if group member"
  on public.insight_reports for select
  using (
    exists (
      select 1 from public.submissions s
      join public.group_members gm on gm.group_id = s.group_id
      join public.users u on u.id = gm.user_id
      where s.id = public.insight_reports.submission_id
        and u.clerk_id = auth.uid()::text
    )
  );
