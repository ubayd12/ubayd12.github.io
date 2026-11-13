-- =====================================================================
-- Catatku — fitur keuangan: kategori, anggaran per kategori, transaksi
-- rutin; sekaligus menghapus fitur AI dari database.
--
-- Jalankan di Supabase Dashboard → SQL Editor (sebagai postgres),
-- SETELAH schema.sql, ban.sql, dan tanpa_premium.sql. Aman dijalankan ulang.
-- Batalkan dengan supabase/fitur_keuangan_rollback.sql.
--
-- Data transaksi dan tabungan yang sudah ada TIDAK dihapus. Transaksi lama
-- mendapat kolom category_id kosong (tampil sebagai "Tanpa kategori").
--
-- Aturan akses semua tabel baru (RLS):
--   * pengguna hanya bisa membaca/menulis datanya sendiri;
--   * akun yang di-ban (profiles.banned_at terisi) tidak bisa menulis;
--   * category_id selalu harus kategori milik pengguna itu sendiri
--     dengan jenis yang sama (pemasukan/pengeluaran).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Hapus fitur AI
-- ---------------------------------------------------------------------
drop function if exists public.ai_consume(integer);
drop function if exists public.ai_quota();
drop table if exists public.ai_usage;

-- ---------------------------------------------------------------------
-- 2. categories
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nama       text not null check (char_length(trim(nama)) between 1 and 40),
  jenis      text not null check (jenis in ('pemasukan', 'pengeluaran')),
  ikon       text not null default '🏷️' check (char_length(ikon) between 1 and 16),
  warna      text not null default '#64748b' check (warna ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

-- Nama unik per pengguna dan jenis (tidak membedakan huruf besar/kecil)
create unique index if not exists categories_nama_unik
  on public.categories (user_id, jenis, lower(trim(nama)));

alter table public.categories enable row level security;
revoke all on table public.categories from anon;

drop policy if exists "kategori: baca milik sendiri" on public.categories;
create policy "kategori: baca milik sendiri" on public.categories
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "kategori: tambah milik sendiri" on public.categories;
create policy "kategori: tambah milik sendiri" on public.categories
  for insert to authenticated
  with check (user_id = (select auth.uid()) and not (select public.is_banned()));

drop policy if exists "kategori: ubah milik sendiri" on public.categories;
create policy "kategori: ubah milik sendiri" on public.categories
  for update to authenticated
  using (user_id = (select auth.uid()) and not (select public.is_banned()))
  with check (user_id = (select auth.uid()) and not (select public.is_banned()));

drop policy if exists "kategori: hapus milik sendiri" on public.categories;
create policy "kategori: hapus milik sendiri" on public.categories
  for delete to authenticated
  using (user_id = (select auth.uid()) and not (select public.is_banned()));

-- Jenis kategori tidak bisa diubah (supaya catatan, anggaran, dan transaksi
-- rutin yang memakainya tetap konsisten). Nama dirapikan.
create or replace function public.categories_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nama := trim(new.nama);
  new.ikon := trim(new.ikon);
  if tg_op = 'UPDATE' then
    new.jenis   := old.jenis;
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists categories_bw on public.categories;
create trigger categories_bw
  before insert or update on public.categories
  for each row execute function public.categories_before_write();

-- Kategori bawaan
create or replace function public.buat_kategori_bawaan(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (user_id, nama, jenis, ikon, warna)
  select p_user, v.nama, v.jenis, v.ikon, v.warna
  from (values
    ('Makan',        'pengeluaran', '🍽️', '#ef4444'),
    ('Transportasi', 'pengeluaran', '🚌', '#f97316'),
    ('Belanja',      'pengeluaran', '🛒', '#eab308'),
    ('Tagihan',      'pengeluaran', '🧾', '#8b5cf6'),
    ('Hiburan',      'pengeluaran', '🎬', '#ec4899'),
    ('Kesehatan',    'pengeluaran', '💊', '#14b8a6'),
    ('Pendidikan',   'pengeluaran', '📚', '#3b82f6'),
    ('Lainnya',      'pengeluaran', '📦', '#64748b'),
    ('Gaji',         'pemasukan',   '💼', '#16a34a'),
    ('Bonus',        'pemasukan',   '🎁', '#22c55e'),
    ('Usaha',        'pemasukan',   '🏪', '#0d9488'),
    ('Lainnya',      'pemasukan',   '💰', '#64748b')
  ) as v (nama, jenis, ikon, warna)
  on conflict do nothing
$$;

-- Hanya dipanggil dari trigger dan skrip ini, bukan dari aplikasi
revoke all on function public.buat_kategori_bawaan(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user_kategori()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.buat_kategori_bawaan(new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user_kategori() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_kategori on auth.users;
create trigger on_auth_user_created_kategori
  after insert on auth.users
  for each row execute function public.handle_new_user_kategori();

-- Isi kategori bawaan untuk akun yang sudah ada (yang belum punya kategori
-- sama sekali, supaya menjalankan ulang skrip tidak memunculkan lagi
-- kategori yang sudah diganti nama/dihapus pengguna)
select public.buat_kategori_bawaan(u.id)
from auth.users u
where not exists (select 1 from public.categories c where c.user_id = u.id);

-- Dipakai policy: kategori milik saya dengan jenis tertentu?
create or replace function public.kategori_milik_saya(p_id uuid, p_jenis text)
returns boolean
language sql stable
security invoker
set search_path = ''
as $$
  select p_id is null or exists (
    select 1 from public.categories c
    where c.id = p_id and c.user_id = auth.uid() and c.jenis = p_jenis
  )
$$;

revoke all on function public.kategori_milik_saya(uuid, text) from public, anon;
grant execute on function public.kategori_milik_saya(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. transactions.category_id
-- ---------------------------------------------------------------------
alter table public.transactions
  add column if not exists category_id uuid references public.categories (id) on delete set null;

create index if not exists transactions_category_idx on public.transactions (category_id);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);

-- Policy RESTRICTIVE: digabung (AND) dengan policy transaksi yang sudah ada.
drop policy if exists "kategori transaksi: tambah" on public.transactions;
create policy "kategori transaksi: tambah" on public.transactions
  as restrictive for insert to authenticated
  with check (public.kategori_milik_saya(category_id, type));

drop policy if exists "kategori transaksi: ubah" on public.transactions;
create policy "kategori transaksi: ubah" on public.transactions
  as restrictive for update to authenticated
  using (true)
  with check (public.kategori_milik_saya(category_id, type));

-- ---------------------------------------------------------------------
-- 4. budgets (anggaran per kategori per bulan)
-- ---------------------------------------------------------------------
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  bulan       date not null check (extract(day from bulan) = 1),
  batas       bigint not null check (batas > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, category_id, bulan)
);

create index if not exists budgets_user_bulan_idx on public.budgets (user_id, bulan);

alter table public.budgets enable row level security;
revoke all on table public.budgets from anon;

drop policy if exists "anggaran: baca milik sendiri" on public.budgets;
create policy "anggaran: baca milik sendiri" on public.budgets
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "anggaran: tambah milik sendiri" on public.budgets;
create policy "anggaran: tambah milik sendiri" on public.budgets
  for insert to authenticated
  with check (user_id = (select auth.uid()) and not (select public.is_banned())
              and category_id is not null and public.kategori_milik_saya(category_id, 'pengeluaran'));

drop policy if exists "anggaran: ubah milik sendiri" on public.budgets;
create policy "anggaran: ubah milik sendiri" on public.budgets
  for update to authenticated
  using (user_id = (select auth.uid()) and not (select public.is_banned()))
  with check (user_id = (select auth.uid()) and not (select public.is_banned())
              and category_id is not null and public.kategori_milik_saya(category_id, 'pengeluaran'));

drop policy if exists "anggaran: hapus milik sendiri" on public.budgets;
create policy "anggaran: hapus milik sendiri" on public.budgets
  for delete to authenticated
  using (user_id = (select auth.uid()) and not (select public.is_banned()));

-- ---------------------------------------------------------------------
-- 5. recurring (transaksi rutin bulanan)
-- ---------------------------------------------------------------------
create table if not exists public.recurring (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  jenis           text not null check (jenis in ('pemasukan', 'pengeluaran')),
  jumlah          bigint not null check (jumlah > 0),
  category_id     uuid references public.categories (id) on delete set null,
  catatan         text check (char_length(catatan) <= 200),
  tanggal         smallint not null check (tanggal between 1 and 28),
  aktif           boolean not null default true,
  terakhir_dibuat date,  -- tanggal jatuh tempo terakhir yang sudah dibuatkan catatan
  created_at      timestamptz not null default now()
);

create index if not exists recurring_user_idx on public.recurring (user_id);

alter table public.recurring enable row level security;
revoke all on table public.recurring from anon;

drop policy if exists "rutin: baca milik sendiri" on public.recurring;
create policy "rutin: baca milik sendiri" on public.recurring
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "rutin: tambah milik sendiri" on public.recurring;
create policy "rutin: tambah milik sendiri" on public.recurring
  for insert to authenticated
  with check (user_id = (select auth.uid()) and not (select public.is_banned())
              and public.kategori_milik_saya(category_id, jenis));

drop policy if exists "rutin: ubah milik sendiri" on public.recurring;
create policy "rutin: ubah milik sendiri" on public.recurring
  for update to authenticated
  using (user_id = (select auth.uid()) and not (select public.is_banned()))
  with check (user_id = (select auth.uid()) and not (select public.is_banned())
              and public.kategori_milik_saya(category_id, jenis));

drop policy if exists "rutin: hapus milik sendiri" on public.recurring;
create policy "rutin: hapus milik sendiri" on public.recurring
  for delete to authenticated
  using (user_id = (select auth.uid()) and not (select public.is_banned()));

-- Jatuh tempo terakhir SEBELUM hari ini (WIB) untuk tanggal tertentu
create or replace function public.jatuh_tempo_sebelumnya(p_tanggal smallint)
returns date
language sql stable
set search_path = ''
as $$
  select case when d < h then d else (d - interval '1 month')::date end
  from (select (now() at time zone 'Asia/Jakarta')::date as h) x,
       lateral (select (date_trunc('month', x.h) + (p_tanggal - 1) * interval '1 day')::date as d) y
$$;

-- Saat dibuat, diaktifkan kembali, atau tanggalnya diganti: mulai dari jatuh
-- tempo berikutnya (hari ini ikut bila hari ini jatuh tempo). Bulan-bulan
-- yang terlewat saat nonaktif tidak dibuatkan catatan.
create or replace function public.recurring_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.catatan := nullif(trim(new.catatan), '');
  if tg_op = 'INSERT' then
    new.terakhir_dibuat := public.jatuh_tempo_sebelumnya(new.tanggal);
  else
    new.user_id := old.user_id;
    if (new.aktif and not old.aktif) or new.tanggal <> old.tanggal then
      new.terakhir_dibuat := greatest(old.terakhir_dibuat, public.jatuh_tempo_sebelumnya(new.tanggal));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists recurring_bw on public.recurring;
create trigger recurring_bw
  before insert or update on public.recurring
  for each row execute function public.recurring_before_write();

-- Dipanggil aplikasi saat dibuka: membuat catatan untuk semua transaksi rutin
-- aktif yang sudah jatuh tempo sejak terakhir_dibuat, lalu mengembalikan
-- jumlah catatan yang dibuat. Baris recurring dikunci (for update) sehingga
-- dua tab yang dibuka bersamaan tidak membuat catatan dobel.
-- security invoker → RLS dan policy ban tetap berlaku.
create or replace function public.proses_transaksi_rutin()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r        record;
  v_hari   date := (now() at time zone 'Asia/Jakarta')::date;
  v_tgl    date;
  v_akhir  date;
  v_jumlah integer := 0;
begin
  if auth.uid() is null or public.is_banned() then
    return 0;
  end if;

  for r in
    select * from public.recurring
    where user_id = auth.uid() and aktif
    order by created_at
    for update
  loop
    v_akhir := null;
    v_tgl := (date_trunc('month', coalesce(r.terakhir_dibuat, public.jatuh_tempo_sebelumnya(r.tanggal)))
              + (r.tanggal - 1) * interval '1 day')::date;
    if v_tgl <= coalesce(r.terakhir_dibuat, public.jatuh_tempo_sebelumnya(r.tanggal)) then
      v_tgl := (v_tgl + interval '1 month')::date;
    end if;

    while v_tgl <= v_hari loop
      insert into public.transactions (user_id, type, amount, note, date, category_id)
      values (auth.uid(), r.jenis, r.jumlah, r.catatan, v_tgl, r.category_id);
      v_jumlah := v_jumlah + 1;
      v_akhir  := v_tgl;
      v_tgl    := (v_tgl + interval '1 month')::date;
    end loop;

    if v_akhir is not null then
      update public.recurring set terakhir_dibuat = v_akhir where id = r.id;
    end if;
  end loop;

  return v_jumlah;
end;
$$;

revoke all on function public.jatuh_tempo_sebelumnya(smallint) from public, anon;
revoke all on function public.proses_transaksi_rutin()          from public, anon;
grant execute on function public.jatuh_tempo_sebelumnya(smallint) to authenticated;
grant execute on function public.proses_transaksi_rutin()          to authenticated;

commit;
