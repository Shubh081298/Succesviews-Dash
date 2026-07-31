-- ============================================================
-- Employee Pipeline — Phase 2 database migration (ADDITIVE ONLY)
-- Safe to run in the Supabase SQL editor. Creates only NEW tables.
-- No existing table or column is altered, renamed, or dropped.
-- Re-runnable: uses IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Master: domains (Admin-managed; employees pick from dropdown) ----------
create table if not exists public.domains (
  id           uuid primary key default gen_random_uuid(),
  domain_name  text not null,
  status       boolean not null default true,
  created_at   timestamptz not null default now()
);

insert into public.domains (domain_name)
select v from (values
  ('CIO Visionaries'), ('CEO Vision'), ('Arab World Leaders'),
  ('CXO Leaders'), ('Healthcare Leaders')
) as t(v)
where not exists (select 1 from public.domains d where d.domain_name = t.v);

-- ---------- Master: client status list (Admin-editable later) ----------
create table if not exists public.pipeline_status_master (
  id            uuid primary key default gen_random_uuid(),
  status_name   text not null,
  colour        text,
  display_order integer not null default 0
);

insert into public.pipeline_status_master (status_name, colour, display_order)
select s, c, o from (values
  ('New Lead','#2563EB',1), ('Interested','#16A34A',2), ('Asking Details','#EA580C',3),
  ('Article Approach','#7C3AED',4), ('Proposal Sent','#4F46E5',5), ('Follow-up Required','#D97706',6),
  ('Contract Order Sent','#0D9488',7), ('Negotiation','#C2410C',8), ('Payment Pending','#DC2626',9),
  ('Payment Received','#15803D',10), ('Completed','#1E3A8A',11), ('Lost','#64748B',12)
) as t(s,c,o)
where not exists (select 1 from public.pipeline_status_master m where m.status_name = t.s);

-- ---------- Clients ----------
create table if not exists public.pipeline_clients (
  id                uuid primary key default gen_random_uuid(),
  employee_id       text references public.employees(id),
  assigned_email_id text,                    -- reuses the employee's existing Assigned Email IDs (string)
  domain_id         uuid references public.domains(id),
  domain_name       text,                    -- denormalised for fast display/search
  client_name       text not null,
  company_name      text,
  client_email      text,
  region            text,
  status            text not null default 'New Lead',
  notes             text,
  last_follow_up    date,
  next_follow_up    date,
  lost_reason       text,
  is_deleted        boolean not null default false,   -- soft delete only, never hard delete
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------- Follow-ups (append-only) ----------
create table if not exists public.pipeline_followups (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid references public.pipeline_clients(id) on delete cascade,
  employee_id        text references public.employees(id),
  follow_up_date     date,
  follow_up_time     time,
  communication_type text,
  notes              text,
  status             text,
  next_follow_up     date,
  created_at         timestamptz not null default now()
);

-- ---------- Contracts ----------
create table if not exists public.pipeline_contracts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references public.pipeline_clients(id) on delete cascade,
  contract_number text,
  contract_date   date,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ---------- Sales ----------
create table if not exists public.pipeline_sales (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.pipeline_clients(id) on delete cascade,
  package_name text,
  amount       numeric not null default 0,
  currency     text not null default 'USD',
  sales_date   date,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ---------- Payments ----------
create table if not exists public.pipeline_payments (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references public.pipeline_clients(id) on delete cascade,
  amount           numeric not null default 0,
  currency         text not null default 'USD',
  payment_method   text,
  reference_number text,
  payment_date     date,
  notes            text,
  created_at       timestamptz not null default now()
);

-- ---------- Notes (append-only) ----------
create table if not exists public.pipeline_notes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.pipeline_clients(id) on delete cascade,
  employee_id text references public.employees(id),
  note        text,
  created_at  timestamptz not null default now()
);

-- ---------- History / audit (append-only, never overwritten) ----------
create table if not exists public.pipeline_history (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.pipeline_clients(id) on delete cascade,
  employee_id text references public.employees(id),
  action      text,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- Indexes (fast search / dashboards) ----------
create index if not exists idx_pc_employee   on public.pipeline_clients(employee_id);
create index if not exists idx_pc_email       on public.pipeline_clients(client_email);
create index if not exists idx_pc_nextfu      on public.pipeline_clients(next_follow_up);
create index if not exists idx_pc_domain      on public.pipeline_clients(domain_id);
create index if not exists idx_pc_status      on public.pipeline_clients(status);
create index if not exists idx_pc_created      on public.pipeline_clients(created_at);
create index if not exists idx_pf_client       on public.pipeline_followups(client_id);
create index if not exists idx_psale_client    on public.pipeline_sales(client_id);
create index if not exists idx_ppay_client     on public.pipeline_payments(client_id);
create index if not exists idx_pcon_client     on public.pipeline_contracts(client_id);
create index if not exists idx_ph_client       on public.pipeline_history(client_id);
create index if not exists idx_pn_client       on public.pipeline_notes(client_id);

-- Data-integrity: no duplicate live client for the same email within a domain.
create unique index if not exists uq_client_email_domain
  on public.pipeline_clients(lower(client_email), domain_id)
  where is_deleted = false and client_email is not null;

-- ---------- Row Level Security ----------
-- NOTE: this app authenticates employees through its own login (not Supabase Auth),
-- so it uses the anon key with permissive policies + in-app gating, matching the
-- existing tables. Ownership is enforced in the client via employee_id. Tightening
-- to auth.uid()-based RLS is tracked as a separate security-hardening task.
alter table public.pipeline_clients      enable row level security;
alter table public.pipeline_followups    enable row level security;
alter table public.pipeline_contracts    enable row level security;
alter table public.pipeline_sales        enable row level security;
alter table public.pipeline_payments     enable row level security;
alter table public.pipeline_notes        enable row level security;
alter table public.pipeline_history      enable row level security;
alter table public.domains               enable row level security;
alter table public.pipeline_status_master enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'pipeline_clients','pipeline_followups','pipeline_contracts','pipeline_sales',
    'pipeline_payments','pipeline_notes','pipeline_history','domains','pipeline_status_master'
  ] loop
    execute format('drop policy if exists %I on public.%I', t||'_all', t);
    execute format('create policy %I on public.%I for all using (true) with check (true)', t||'_all', t);
  end loop;
end $$;

-- ---------- Realtime (optional; mirrors the app's realtime setup) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'pipeline_clients','pipeline_followups','pipeline_contracts','pipeline_sales',
    'pipeline_payments','pipeline_notes','pipeline_history'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Storage bucket for future uploads (proofs/attachments). Safe if it already exists.
insert into storage.buckets (id, name, public)
values ('pipeline-files','pipeline-files', true)
on conflict (id) do nothing;
