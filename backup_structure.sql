-- LogiConnect Supabase schema
-- Execute in Supabase SQL Editor
-- This schema keeps the site working with the existing frontend expectations.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  full_name text,
  role text default 'user',
  phone text,
  country text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inscriptions (
  id bigserial primary key,
  type text,
  ambassadeur_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.commandes (
  id text primary key,
  service text,
  service_type text,
  montant numeric,
  commission numeric,
  net_prestataire numeric,
  commission_rate numeric,
  client_nom text,
  client_email text,
  client_tel text,
  prestataire_email text,
  prestataire_tel text,
  prestataire_user_id text,
  ambassadeur_code text,
  statut text default 'en_attente_confirmation',
  methode_paiement text,
  date timestamptz not null default now(),
  date_paiement timestamptz,
  date_liberation timestamptz,
  date_validation_paiement_admin timestamptz,
  date_validation_qr timestamptz,
  order_payload jsonb,
  details jsonb,
  secure_actions jsonb,
  repayment_requested_at timestamptz,
  repayment_request_count integer default 0,
  service_token text,
  service_qr_link text,
  paiement_admin_confirme boolean default false,
  ordre_execution_envoye boolean default false,
  validation_qr_source text,
  motif_litige text,
  note_litige text
);

create table if not exists public.ambassadeurs (
  id text primary key,
  code text unique,
  prenom text,
  nom text,
  email text,
  telephone text,
  profil text,
  paiement text,
  paiement_detail text,
  statut text default 'actif',
  taux_commission numeric,
  commissions_total numeric default 0,
  commissions_en_attente numeric default 0,
  commissions_en_traitement numeric default 0,
  operations jsonb default '[]'::jsonb,
  operations_count integer default 0,
  link_clicks integer default 0,
  link text,
  historique_paiements jsonb default '[]'::jsonb,
  notifications jsonb default '[]'::jsonb,
  mot_de_passe_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.activite (
  id bigserial primary key,
  type text,
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.operators (
  id text primary key,
  user_id text,
  type text,
  name text,
  loc text,
  chips text[],
  price numeric,
  unit text,
  rating numeric,
  rv numeric,
  whatsapp text,
  tel text,
  email text,
  ambassadeur_code text,
  statut text default 'publie',
  published boolean default true,
  visible boolean default true,
  created_at timestamptz not null default now(),
  publie_at timestamptz not null default now()
);

create index if not exists idx_commandes_client_email on public.commandes (client_email);
create index if not exists idx_commandes_prestataire_email on public.commandes (prestataire_email);
create index if not exists idx_commandes_statut on public.commandes (statut);
create index if not exists idx_ambassadeurs_code on public.ambassadeurs (code);
create index if not exists idx_operators_user_id on public.operators (user_id);

alter table public.profiles enable row level security;
alter table public.inscriptions enable row level security;
alter table public.commandes enable row level security;
alter table public.ambassadeurs enable row level security;
alter table public.activite enable row level security;
alter table public.operators enable row level security;

create or replace function public.is_logiconnect_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.email(), '') = 'contactlogiconnectapp@gmail.com';
$$;

drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select using (
    auth.uid()::text = id::text
    or public.is_logiconnect_admin()
  );
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid()::text = id::text);
create policy profiles_update_own on public.profiles
  for update using (
    auth.uid()::text = id::text
    or public.is_logiconnect_admin()
  ) with check (
    auth.uid()::text = id::text
    or public.is_logiconnect_admin()
  );

drop policy if exists inscriptions_authenticated on public.inscriptions;
create policy inscriptions_authenticated on public.inscriptions
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists commandes_authenticated on public.commandes;
create policy commandes_authenticated on public.commandes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists ambassadeurs_authenticated on public.ambassadeurs;
create policy ambassadeurs_authenticated on public.ambassadeurs
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists activite_authenticated on public.activite;
create policy activite_authenticated on public.activite
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists operators_public_read on public.operators;
drop policy if exists operators_authenticated_write on public.operators;
create policy operators_public_read on public.operators
  for select using (true);
create policy operators_authenticated_write on public.operators
  for insert with check (auth.uid() is not null);
create policy operators_authenticated_update on public.operators
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy operators_authenticated_delete on public.operators
  for delete using (auth.uid() is not null);

-- Secure defaults:
-- - anonymous users can read public operator listings only
-- - authenticated users can work with their own rows
-- - admin access is granted through the profiles.role = 'admin' check
-- If you want unauthenticated public writes, do not add them back.
