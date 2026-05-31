-- ============================================================
-- ResumeIQ — Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Resumes ──────────────────────────────────────────────────

create table if not exists public.resumes (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  file_url    text not null,
  parsed_text text not null,
  filename    text,
  created_at  timestamptz default now()
);

create index on public.resumes(user_id);

-- ── Job Descriptions ─────────────────────────────────────────

create table if not exists public.job_descriptions (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz default now()
);

create index on public.job_descriptions(user_id);

-- ── Analyses ─────────────────────────────────────────────────

create table if not exists public.analyses (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  resume_id        uuid not null references public.resumes(id) on delete cascade,
  jd_id            uuid not null references public.job_descriptions(id) on delete cascade,
  ats_score        numeric(5,2) default 0,
  recruiter_score  numeric(4,2) default 0,
  created_at       timestamptz default now()
);

create index on public.analyses(user_id);
create index on public.analyses(user_id, created_at desc);

-- ── Feedback ─────────────────────────────────────────────────

create table if not exists public.feedback (
  id               uuid primary key default uuid_generate_v4(),
  analysis_id      uuid not null references public.analyses(id) on delete cascade,
  missing_keywords jsonb default '[]'::jsonb,
  matched_keywords jsonb default '[]'::jsonb,
  suggestions      jsonb default '[]'::jsonb,
  strengths        jsonb default '[]'::jsonb,
  weaknesses       jsonb default '[]'::jsonb,
  rewritten_points jsonb default '[]'::jsonb,
  persona          text default 'standard',
  created_at       timestamptz default now()
);

-- If upgrading an existing database, add the persona column:
alter table public.feedback add column if not exists persona text default 'standard';

create index on public.feedback(analysis_id);

-- ── Row Level Security ────────────────────────────────────────

alter table public.resumes enable row level security;
alter table public.job_descriptions enable row level security;
alter table public.analyses enable row level security;
alter table public.feedback enable row level security;

-- Users can only access their own resumes
create policy "users_own_resumes" on public.resumes
  for all using (auth.uid() = user_id);

-- Users can only access their own job descriptions
create policy "users_own_jds" on public.job_descriptions
  for all using (auth.uid() = user_id);

-- Users can only access their own analyses
create policy "users_own_analyses" on public.analyses
  for all using (auth.uid() = user_id);

-- Users can access feedback for their own analyses
create policy "users_own_feedback" on public.feedback
  for all using (
    exists (
      select 1 from public.analyses a
      where a.id = feedback.analysis_id and a.user_id = auth.uid()
    )
  );

-- ── Storage Bucket ────────────────────────────────────────────
-- Run this separately in Supabase Storage UI or here:
-- insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false);

-- Storage RLS: only owner can read/write their own files
create policy "owner_can_upload" on storage.objects
  for insert with check (
    bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "owner_can_read" on storage.objects
  for select using (
    bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]
  );
