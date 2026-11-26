-- Ledgerly / School Fee Management System
-- Run this script once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text not null unique,
  full_name text not null,
  class_name text not null,
  academic_year text not null default '',
  guardian_phone text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  class_name text not null,
  academic_year text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null default current_date,
  method text not null default 'Cash',
  reference text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists students_class_idx on public.students(class_name);
create index if not exists payments_student_idx on public.payments(student_id);
create index if not exists payments_date_idx on public.payments(paid_on desc);
create index if not exists fees_class_idx on public.fee_structures(class_name);

-- The first registered account becomes admin. Subsequent accounts become staff.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role text;
begin
  if not exists (select 1 from public.profiles) then
    assigned_role := 'admin';
  else
    assigned_role := 'staff';
  end if;

  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), assigned_role);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.fee_structures enable row level security;
alter table public.payments enable row level security;

-- Only authenticated users can access school data.
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles" on public.profiles
for select to authenticated using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Authenticated users manage students" on public.students;
create policy "Authenticated users manage students" on public.students
for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users manage fee structures" on public.fee_structures;
drop policy if exists "Authenticated users read fee structures" on public.fee_structures;
drop policy if exists "Admins insert fee structures" on public.fee_structures;
drop policy if exists "Admins update fee structures" on public.fee_structures;
drop policy if exists "Admins delete fee structures" on public.fee_structures;

create policy "Authenticated users read fee structures" on public.fee_structures
for select to authenticated using (true);

create policy "Admins insert fee structures" on public.fee_structures
for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins update fee structures" on public.fee_structures
for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins delete fee structures" on public.fee_structures
for delete to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Authenticated users manage payments" on public.payments;
create policy "Authenticated users manage payments" on public.payments
for all to authenticated using (true) with check (true);

-- Keep the public profile role column protected from self-promotion:
revoke update (role) on public.profiles from authenticated;
