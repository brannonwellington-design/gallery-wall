-- Run this once in the Supabase SQL Editor (or via the CLI) for any
-- project that should host gallery-wall data.

create extension if not exists "pgcrypto";

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled room',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_updated_at_idx
  on public.rooms (updated_at desc);

-- The app talks to Supabase exclusively from server-side route handlers
-- using the service-role key, which bypasses Row Level Security. RLS
-- stays enabled so the anon key can never read or write directly.
alter table public.rooms enable row level security;
