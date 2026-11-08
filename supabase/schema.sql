-- =====================================================================
-- Catatku — skema premium, langganan, dan admin
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor (sebagai postgres).
-- Aman dijalankan ulang (idempotent sejauh mungkin).
--
-- Asumsi: tabel public.transactions SUDAH ADA (dipakai aplikasi versi gratis)
-- dengan kolom: id, user_id (→ auth.users), type ('pemasukan'/'pengeluaran'),
-- amount, note, date (date), created_at — dan RLS "hanya pemilik" sudah aktif.
--
-- Menjadikan akun admin (jalankan manual setelah skema ini):
--   update public.profiles set role = 'admin' where username = 'username_kamu';
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Harga & durasi paket (satu sumber kebenaran)
-- ---------------------------------------------------------------------
create or replace function public.harga_paket(p_plan text)
returns bigint
language sql immutable
set search_path = ''
as $$
  select case p_plan
    when 'harian'    then 5000
    when 'mingguan'  then 7000
    when 'bulanan'   then 18000
    when 'tahunan'   then 180000
    when 'selamanya' then 2000000
  end::bigint
$$;

create or replace function public.durasi_paket(p_plan text)
returns interval
language sql immutable
set search_path = ''
as $$
  select case p_plan
    when 'harian'   then interval '1 day'
    when 'mingguan' then interval '7 days'
    when 'bulanan'  then interval '1 month'
    when 'tahunan'  then interval '1 year'
  end  -- 'selamanya' → null (tidak pernah habis)
$$;

-- ---------------------------------------------------------------------
-- 2. profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null unique,
  role          text not null default 'user' check (role in ('user', 'admin')),
  premium_plan  text check (premium_plan in ('harian', 'mingguan', 'bulanan', 'tahunan', 'selamanya')),
  premium_until timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profil: baca milik sendiri" on public.profiles;
create policy "profil: baca milik sendiri" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
-- Sengaja TIDAK ada policy insert/update/delete: pengguna tidak bisa
-- mengubah role atau status premium. Perubahan hanya lewat fungsi admin.
revoke insert, update, delete on public.profiles from anon, authenticated;

-- Buat profil otomatis untuk akun baru (username dari metadata pendaftaran)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
begin
  v_username := lower(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    replace(new.id::text, '-', '')
  ));
  if exists (select 1 from public.profiles where username = v_username) then
    v_username := v_username || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  insert into public.profiles (id, username, created_at)
  values (new.id, v_username, coalesce(new.created_at, now()))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Isi profil untuk akun yang sudah ada sebelum skema ini dijalankan
do $$
declare
  u record;
  v_username text;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data, au.created_at
    from auth.users au
    where not exists (select 1 from public.profiles p where p.id = au.id)
    order by au.created_at
  loop
    v_username := lower(coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      replace(u.id::text, '-', '')
    ));
    if exists (select 1 from public.profiles where username = v_username) then
      v_username := v_username || '_' || substr(replace(u.id::text, '-', ''), 1, 6);
    end if;
    insert into public.profiles (id, username, created_at)
    values (u.id, v_username, coalesce(u.created_at, now()))
    on conflict (id) do nothing;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Pengecekan peran
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- Premium aktif: admin, paket selamanya, atau masa paket belum habis.
-- Setelah premium_until lewat, otomatis kembali gratis (tanpa cron).
create or replace function public.is_premium()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or premium_plan = 'selamanya' or premium_until > now())
  )
$$;

-- ---------------------------------------------------------------------
-- 4. user_settings (profil keuangan) — PREMIUM
-- ---------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  pekerjaan       text check (char_length(pekerjaan) <= 100),
  gaji            bigint check (gaji >= 0),
  budget_bulanan  bigint check (budget_bulanan >= 0),
  umur            integer check (umur between 1 and 150),
  target_tabungan bigint check (target_tabungan >= 0),
  updated_at      timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "settings: pemilik premium" on public.user_settings;
create policy "settings: pemilik premium" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_premium()))
  with check (user_id = (select auth.uid()) and (select public.is_premium()));

-- ---------------------------------------------------------------------
-- 5. savings (tabungan) — PREMIUM
-- ---------------------------------------------------------------------
create table if not exists public.savings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type       text not null check (type in ('setor', 'tarik')),
  amount     bigint not null check (amount > 0),
  note       text check (char_length(note) <= 200),
  date       date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists savings_user_idx on public.savings (user_id, date desc);

alter table public.savings enable row level security;

drop policy if exists "savings: pemilik premium" on public.savings;
create policy "savings: pemilik premium" on public.savings
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_premium()))
  with check (user_id = (select auth.uid()) and (select public.is_premium()));

-- ---------------------------------------------------------------------
-- 6. subscription_requests (permintaan langganan)
-- ---------------------------------------------------------------------
create table if not exists public.subscription_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan        text not null check (plan in ('harian', 'mingguan', 'bulanan', 'tahunan', 'selamanya')),
  amount      bigint not null,
  sender_name text not null check (char_length(trim(sender_name)) between 1 and 100),
  sender_via  text not null check (char_length(trim(sender_via)) between 1 and 100),
  status      text not null default 'menunggu' check (status in ('menunggu', 'dikonfirmasi', 'ditolak')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references auth.users (id) on delete set null,
  constraint amount_sesuai_paket check (amount = public.harga_paket(plan))
);

-- Satu pengguna hanya boleh punya SATU permintaan berstatus menunggu
create unique index if not exists subscription_requests_satu_menunggu
  on public.subscription_requests (user_id) where status = 'menunggu';

-- Nominal & status selalu ditentukan server, bukan oleh pengguna
create or replace function public.subscription_requests_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id    := auth.uid();
  new.amount     := public.harga_paket(new.plan);
  new.status     := 'menunggu';
  new.created_at := now();
  new.decided_at := null;
  new.decided_by := null;
  new.sender_name := trim(new.sender_name);
  new.sender_via  := trim(new.sender_via);
  return new;
end;
$$;

drop trigger if exists subscription_requests_bi on public.subscription_requests;
create trigger subscription_requests_bi
  before insert on public.subscription_requests
  for each row execute function public.subscription_requests_before_insert();

alter table public.subscription_requests enable row level security;

drop policy if exists "langganan: baca milik sendiri" on public.subscription_requests;
create policy "langganan: baca milik sendiri" on public.subscription_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "langganan: buat milik sendiri" on public.subscription_requests;
create policy "langganan: buat milik sendiri" on public.subscription_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'menunggu');
-- Tidak ada policy update/delete: status hanya diubah lewat admin_decide_request.
revoke update, delete on public.subscription_requests from anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Fitur premium berbasis transaksi (dikunci di database)
--    security invoker → RLS transactions tetap berlaku.
-- ---------------------------------------------------------------------

-- Saringan periode (bulan ini / lalu / depan / sebelumnya)
create or replace function public.transaksi_periode(p_mulai date, p_akhir date)
returns setof public.transactions
language plpgsql stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_premium() then
    raise exception 'Fitur ini khusus Premium' using errcode = '42501';
  end if;
  return query
    select t.* from public.transactions t
    where t.user_id = auth.uid()
      and t.date between p_mulai and p_akhir
    order by t.date desc, t.created_at desc;
end;
$$;

-- Rekap harian / mingguan / bulanan / tahunan
create or replace function public.rekap_transaksi(p_mulai date, p_akhir date, p_satuan text)
returns table (periode date, pemasukan bigint, pengeluaran bigint)
language plpgsql stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_premium() then
    raise exception 'Fitur ini khusus Premium' using errcode = '42501';
  end if;
  if p_satuan not in ('day', 'week', 'month', 'year') then
    raise exception 'Satuan rekap tidak valid';
  end if;
  return query
    select date_trunc(p_satuan, t.date::timestamp)::date,
           coalesce(sum(t.amount) filter (where t.type = 'pemasukan'), 0)::bigint,
           coalesce(sum(t.amount) filter (where t.type = 'pengeluaran'), 0)::bigint
    from public.transactions t
    where t.user_id = auth.uid()
      and t.date between p_mulai and p_akhir
    group by 1
    order by 1 desc;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Fungsi admin (security definer + pengecekan admin)
--    Admin hanya melihat data akun & langganan — TIDAK ada akses ke
--    transaksi, tabungan, atau profil keuangan pengguna lain.
-- ---------------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (
  id uuid, username text, role text, premium_plan text,
  premium_until timestamptz, premium_aktif boolean, created_at timestamptz
)
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin' using errcode = '42501';
  end if;
  return query
    select p.id, p.username, p.role, p.premium_plan, p.premium_until,
           (p.role = 'admin' or p.premium_plan = 'selamanya' or coalesce(p.premium_until > now(), false)),
           p.created_at
    from public.profiles p
    order by p.created_at desc;
end;
$$;

create or replace function public.admin_list_requests()
returns table (
  id uuid, user_id uuid, username text, plan text, amount bigint,
  sender_name text, sender_via text, status text,
  created_at timestamptz, decided_at timestamptz
)
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin' using errcode = '42501';
  end if;
  return query
    select r.id, r.user_id, p.username, r.plan, r.amount,
           r.sender_name, r.sender_via, r.status, r.created_at, r.decided_at
    from public.subscription_requests r
    left join public.profiles p on p.id = r.user_id
    order by (r.status = 'menunggu') desc, r.created_at desc;
end;
$$;

create or replace function public.admin_decide_request(p_id uuid, p_setuju boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.subscription_requests;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin' using errcode = '42501';
  end if;

  select * into r from public.subscription_requests where id = p_id for update;
  if not found then
    raise exception 'Permintaan tidak ditemukan';
  end if;
  if r.status <> 'menunggu' then
    raise exception 'Permintaan ini sudah diproses';
  end if;

  update public.subscription_requests
     set status = case when p_setuju then 'dikonfirmasi' else 'ditolak' end,
         decided_at = now(),
         decided_by = auth.uid()
   where id = p_id;

  if p_setuju then
    -- Paket selamanya: tidak pernah habis (premium_until null).
    -- Paket lain: diperpanjang dari sisa masa aktif (atau dari sekarang).
    update public.profiles
       set premium_plan  = case when premium_plan = 'selamanya' or r.plan = 'selamanya'
                                then 'selamanya' else r.plan end,
           premium_until = case when premium_plan = 'selamanya' or r.plan = 'selamanya'
                                then null
                                else greatest(coalesce(premium_until, now()), now()) + public.durasi_paket(r.plan) end
     where id = r.user_id;
  end if;
end;
$$;

create or replace function public.admin_ban_user(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin' using errcode = '42501';
  end if;
  if p_id = auth.uid() then
    raise exception 'Admin tidak bisa ban dirinya sendiri';
  end if;
  if exists (select 1 from public.profiles where id = p_id and role = 'admin') then
    raise exception 'Admin tidak bisa ban admin lain';
  end if;
  if not exists (select 1 from auth.users where id = p_id) then
    raise exception 'Pengguna tidak ditemukan';
  end if;

  -- Hapus transaksi secara eksplisit (jaga-jaga bila FK transactions belum on delete cascade)
  delete from public.transactions where user_id = p_id;
  -- Menghapus akun auth → profiles, user_settings, savings,
  -- subscription_requests ikut terhapus (on delete cascade).
  delete from auth.users where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Hak eksekusi fungsi
-- ---------------------------------------------------------------------
revoke all on function public.is_admin()                               from public, anon;
revoke all on function public.is_premium()                             from public, anon;
revoke all on function public.transaksi_periode(date, date)            from public, anon;
revoke all on function public.rekap_transaksi(date, date, text)        from public, anon;
revoke all on function public.admin_list_users()                       from public, anon;
revoke all on function public.admin_list_requests()                    from public, anon;
revoke all on function public.admin_decide_request(uuid, boolean)      from public, anon;
revoke all on function public.admin_ban_user(uuid)                     from public, anon;

grant execute on function public.is_admin()                            to authenticated;
grant execute on function public.is_premium()                          to authenticated;
grant execute on function public.transaksi_periode(date, date)         to authenticated;
grant execute on function public.rekap_transaksi(date, date, text)     to authenticated;
grant execute on function public.admin_list_users()                    to authenticated;
grant execute on function public.admin_list_requests()                 to authenticated;
grant execute on function public.admin_decide_request(uuid, boolean)   to authenticated;
grant execute on function public.admin_ban_user(uuid)                  to authenticated;
