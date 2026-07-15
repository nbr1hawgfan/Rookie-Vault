-- Rookie Vault — Supabase schema
-- Run this in your Supabase project's SQL Editor (Database → SQL Editor → New query)

-- 1. The cards table
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  player text not null,
  team text,
  sport text not null default 'baseball',
  year text,
  brand text,
  card_number text,
  parallel text,
  rookie boolean not null default false,
  graded boolean not null default false,
  grading_co text,
  grade text,
  condition text,
  purchase_price numeric not null default 0,
  current_value numeric not null default 0,
  value_history jsonb not null default '[]'::jsonb,
  front_image_path text,
  back_image_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Lock the table down: only a signed-in session may touch it.
--    (The app signs in with one shared account after the PIN screen —
--    see README for creating that account.)
alter table cards enable row level security;

create policy "authenticated read" on cards
  for select using (auth.role() = 'authenticated');

create policy "authenticated write" on cards
  for insert with check (auth.role() = 'authenticated');

create policy "authenticated update" on cards
  for update using (auth.role() = 'authenticated');

create policy "authenticated delete" on cards
  for delete using (auth.role() = 'authenticated');

-- 3. Storage bucket for card photos
insert into storage.buckets (id, name, public)
values ('card-photos', 'card-photos', true)
on conflict (id) do nothing;

-- Photos are readable by anyone with the exact URL (fine for casual family use —
-- there's nothing sensitive in a card photo, and URLs aren't listed publicly),
-- but only the shared signed-in session may upload or delete.
create policy "public read card photos" on storage.objects
  for select using (bucket_id = 'card-photos');

create policy "authenticated upload card photos" on storage.objects
  for insert with check (bucket_id = 'card-photos' and auth.role() = 'authenticated');

create policy "authenticated delete card photos" on storage.objects
  for delete using (bucket_id = 'card-photos' and auth.role() = 'authenticated');
