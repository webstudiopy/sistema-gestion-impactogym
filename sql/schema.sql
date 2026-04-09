-- =========================================================
-- GYMCONTROL • ESQUEMA BASE PARA SUPABASE / POSTGRESQL
-- Sistema de cobro mensual para gimnasio
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.socios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  documento text,
  telefono text,
  plan text not null default 'Mensual',
  monto_mensual numeric(12,2) not null default 0,
  proximo_vencimiento date not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.formas_pago (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references public.socios(id) on delete restrict,
  forma_pago_id uuid not null references public.formas_pago(id) on delete restrict,
  monto numeric(12,2) not null check (monto >= 0),
  periodo text not null,
  fecha_pago date not null default current_date,
  observacion text,
  created_at timestamptz not null default now()
);

create index if not exists idx_socios_nombre on public.socios (nombre);
create index if not exists idx_pagos_socio_id on public.pagos (socio_id);
create index if not exists idx_pagos_forma_pago_id on public.pagos (forma_pago_id);
create index if not exists idx_pagos_periodo on public.pagos (periodo);
create index if not exists idx_pagos_fecha on public.pagos (fecha_pago desc);

insert into public.formas_pago (nombre, activo)
values
  ('Efectivo', true),
  ('Transferencia', true),
  ('QR', true),
  ('Tarjeta', true)
on conflict (nombre) do nothing;

-- =========================================================
-- RLS BÁSICO PARA USO CON ANON KEY EN FRONTEND
-- Ajusta según tu sistema de autenticación real.
-- =========================================================

alter table public.socios enable row level security;
alter table public.formas_pago enable row level security;
alter table public.pagos enable row level security;

-- Para una base rápida en GitHub Pages:
-- permite leer y escribir con anon key y usuarios autenticados.
-- Si luego agregas login, conviene endurecer estas políticas.

drop policy if exists "socios_select_auth" on public.socios;
create policy "socios_select_auth"
  on public.socios for select
  to anon, authenticated
  using (true);

drop policy if exists "socios_insert_auth" on public.socios;
create policy "socios_insert_auth"
  on public.socios for insert
  to anon, authenticated
  with check (true);

drop policy if exists "socios_update_auth" on public.socios;
create policy "socios_update_auth"
  on public.socios for update
  to anon, authenticated
  using (true)
  with check (true);


drop policy if exists "formas_pago_select_auth" on public.formas_pago;
create policy "formas_pago_select_auth"
  on public.formas_pago for select
  to anon, authenticated
  using (true);

drop policy if exists "formas_pago_insert_auth" on public.formas_pago;
create policy "formas_pago_insert_auth"
  on public.formas_pago for insert
  to anon, authenticated
  with check (true);

drop policy if exists "formas_pago_update_auth" on public.formas_pago;
create policy "formas_pago_update_auth"
  on public.formas_pago for update
  to anon, authenticated
  using (true)
  with check (true);


drop policy if exists "pagos_select_auth" on public.pagos;
create policy "pagos_select_auth"
  on public.pagos for select
  to anon, authenticated
  using (true);

drop policy if exists "pagos_insert_auth" on public.pagos;
create policy "pagos_insert_auth"
  on public.pagos for insert
  to anon, authenticated
  with check (true);

drop policy if exists "pagos_update_auth" on public.pagos;
create policy "pagos_update_auth"
  on public.pagos for update
  to anon, authenticated
  using (true)
  with check (true);

-- =========================================================
-- OPCIONAL: crear un usuario de prueba desde Supabase Auth
-- y usar login real más adelante.
-- =========================================================
