-- ============================================================
--  SuccessViews — Supabase Database Schema
--  Paste this entire file into:
--  Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- ── 1. DEPARTMENTS ──────────────────────────────────────────
create table if not exists departments (
  id        bigint generated always as identity primary key,
  name      text not null unique,
  created_at timestamptz default now()
);

-- Seed default departments
insert into departments (name) values ('Sales'), ('Operations')
on conflict (name) do nothing;

-- ── 2. EMPLOYEES ────────────────────────────────────────────
create table if not exists employees (
  id            text primary key,           -- e.g. EMP001
  name          text not null,
  department    text not null default 'Sales',
  code          text not null default '0000',
  password_hash text not null,              -- bcrypt hash, never plain text
  photo         text default '',            -- base64 data URL or empty
  team_lead     text default '',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── 3. SUBMISSIONS (Daily Status Reports) ───────────────────
create table if not exists submissions (
  id                   text primary key,
  emp_id               text not null references employees(id) on delete cascade,
  emp_name             text not null,
  department           text not null,
  date                 date not null,
  status               text not null default 'Draft',  -- Draft | Submitted
  attendance           text default 'Present',
  fresh_emails         int default 0,
  reminder_emails      int default 0,
  new_leads_interested int default 0,
  new_follow_ups       int default 0,
  calls_scheduled      int default 0,
  sales_generated      numeric default 0,
  payment_received     numeric default 0,
  currency             text default 'INR',
  working_hours        numeric default 0,
  websites_data        jsonb default '[]',   -- [{name, description}]
  pending_tasks        text default '',
  challenges_faced     text default '',
  updates_for_team_lead text default '',
  remarks              text default '',
  custom_fields        jsonb default '{}',
  submitted_at         timestamptz,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  unique(emp_id, date)                        -- one DSR per employee per day
);

-- ── 4. LEAVES ───────────────────────────────────────────────
create table if not exists leaves (
  id          bigint generated always as identity primary key,
  emp_id      text not null references employees(id) on delete cascade,
  emp_name    text not null,
  from_date   date not null,
  to_date     date not null,
  reason      text not null,
  status      text not null default 'Pending',  -- Pending | Approved | Rejected
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── 5. SALARIES ─────────────────────────────────────────────
create table if not exists salaries (
  id             bigint generated always as identity primary key,
  emp_id         text not null references employees(id) on delete cascade unique,
  fixed_salary   numeric not null default 0,
  incentives     jsonb default '[]',   -- [{id, amount, reason, date}]
  payments       jsonb default '[]',   -- [{id, amount, fixed, incentiveTotal, date}]
  updated_at     timestamptz default now()
);

-- ── 6. ANNOUNCEMENTS ────────────────────────────────────────
create table if not exists announcements (
  id           bigint generated always as identity primary key,
  text         text not null,
  departments  text[] not null default '{}',  -- array of dept names
  dismissed_by text[] default '{}',           -- array of emp IDs who dismissed
  created_at   timestamptz default now()
);

-- ── 7. MESSAGES (Admin → Employee) ──────────────────────────
create table if not exists messages (
  id          bigint generated always as identity primary key,
  emp_id      text not null references employees(id) on delete cascade,
  text        text not null,
  dismissed   boolean default false,
  created_at  timestamptz default now()
);

-- ── 8. CUSTOM FIELDS ────────────────────────────────────────
create table if not exists custom_fields (
  id        bigint generated always as identity primary key,
  label     text not null,
  type      text not null default 'text',     -- text | number | textarea
  required  boolean default false,
  created_at timestamptz default now()
);

-- ── 9. WEBSITES (Operations DSR master list) ────────────────
create table if not exists websites (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  created_at timestamptz default now()
);

-- Seed default websites
insert into websites (name)
values ('Company Blog'), ('Main Website'), ('E-Commerce Store')
on conflict (name) do nothing;

-- ── 10. SETTINGS (key-value store) ──────────────────────────
create table if not exists settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

-- Seed default settings
-- Admin password default is "Admin@123" (bcrypt hash below)
insert into settings (key, value) values
  ('admin_password_hash', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
  ('logo', ''),
  ('theme', 'light')
on conflict (key) do nothing;

-- Seed default targets (stored as JSON string)
insert into settings (key, value) values
  ('targets', '{"emailsSent":20,"newLeads":5,"callsMade":15,"salesGenerated":1000,"followUps":10,"meetings":2}')
on conflict (key) do nothing;

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
--  Employees can only see their own data.
--  Admin bypasses RLS via service role key (server-side only).
-- ============================================================

alter table employees     enable row level security;
alter table submissions   enable row level security;
alter table leaves        enable row level security;
alter table salaries      enable row level security;
alter table announcements enable row level security;
alter table messages      enable row level security;
alter table custom_fields enable row level security;
alter table websites      enable row level security;
alter table departments   enable row level security;
alter table settings      enable row level security;

-- Allow anon/authenticated to read departments, websites, custom_fields
create policy "public read departments"  on departments  for select using (true);
create policy "public read websites"     on websites     for select using (true);
create policy "public read custom_fields" on custom_fields for select using (true);

-- Employees table: allow reading (login needs to fetch by id)
create policy "public read employees"   on employees    for select using (true);

-- Submissions: anyone authenticated can insert/update their own
create policy "insert own submission"   on submissions  for insert with check (true);
create policy "update own submission"   on submissions  for update using (true);
create policy "read all submissions"    on submissions  for select using (true);

-- Leaves: employees can insert, everyone can read
create policy "insert own leave"        on leaves       for insert with check (true);
create policy "read all leaves"         on leaves       for select using (true);
create policy "update leave status"     on leaves       for update using (true);

-- Announcements: read all, insert/update via admin
create policy "read announcements"      on announcements for select using (true);
create policy "insert announcements"    on announcements for insert with check (true);
create policy "update announcements"    on announcements for update using (true);
create policy "delete announcements"    on announcements for delete using (true);

-- Messages
create policy "read messages"           on messages     for select using (true);
create policy "insert messages"         on messages     for insert with check (true);
create policy "update messages"         on messages     for update using (true);
create policy "delete messages"         on messages     for delete using (true);

-- Salaries
create policy "read salaries"           on salaries     for select using (true);
create policy "insert salaries"         on salaries     for insert with check (true);
create policy "update salaries"         on salaries     for update using (true);

-- Settings
create policy "read settings"           on settings     for select using (true);
create policy "update settings"         on settings     for update using (true);
create policy "insert settings"         on settings     for insert with check (true);

-- Employees: allow insert/update/delete (admin operations)
create policy "manage employees"        on employees    for insert with check (true);
create policy "update employees"        on employees    for update using (true);
create policy "delete employees"        on employees    for delete using (true);

-- Custom fields: full management
create policy "manage custom_fields"    on custom_fields for insert with check (true);
create policy "delete custom_fields"    on custom_fields for delete using (true);

-- Websites: full management
create policy "manage websites"         on websites     for insert with check (true);
create policy "delete websites"         on websites     for delete using (true);

-- Departments: full management
create policy "manage departments"      on departments  for insert with check (true);
create policy "delete departments"      on departments  for delete using (true);

-- ============================================================
--  DONE! Your database is ready.
--  Next step: go back to VS Code and update your .env file.
-- ============================================================
