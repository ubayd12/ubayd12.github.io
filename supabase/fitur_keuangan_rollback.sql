-- =====================================================================
-- Catatku — membatalkan supabase/fitur_keuangan.sql
--
-- PERHATIAN: menghapus tabel categories, budgets, dan recurring BESERTA
-- ISINYA, serta kolom transactions.category_id (kategori di setiap catatan
-- hilang). Baris transaksi dan tabungan TIDAK dihapus.
--
-- Lalu membuat ulang ai_usage, ai_quota(), dan ai_consume() sesuai definisi
-- yang ada di database sebelum fitur_keuangan.sql dijalankan. Riwayat
-- pemakaian kata AI yang lama tidak bisa dikembalikan (tabel dibuat kosong).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Hapus fitur keuangan
-- ---------------------------------------------------------------------
drop trigger  if exists on_auth_user_created_kategori on auth.users;
drop function if exists public.handle_new_user_kategori();
drop function if exists public.buat_kategori_bawaan(uuid);

drop function if exists public.proses_transaksi_rutin();

drop table if exists public.recurring;
drop function if exists public.recurring_before_write();
drop function if exists public.jatuh_tempo_sebelumnya(smallint);

drop table if exists public.budgets;

drop policy if exists "kategori transaksi: tambah" on public.transactions;
drop policy if exists "kategori transaksi: ubah"   on public.transactions;
drop index  if exists public.transactions_category_idx;
drop index  if exists public.transactions_user_date_idx;
alter table public.transactions drop column if exists category_id;

drop function if exists public.kategori_milik_saya(uuid, text);
drop table if exists public.categories;
drop function if exists public.categories_before_write();

-- ---------------------------------------------------------------------
-- 2. Buat ulang ai_usage
--    Kolom (nama, tipe, not null, default) dibaca dari database:
--    user_id, period_key, words, updated_at.
--    BELUM DIPASTIKAN dari database (koneksi terputus saat membaca):
--    primary key, foreign key ke auth.users, RLS, dan policy. Yang ditulis
--    di bawah adalah perkiraan: kunci (user_id, period_key) pasti ada karena
--    dibutuhkan "on conflict" di ai_consume(). Cek dulu sebelum menjalankan
--    fitur_keuangan.sql bila ingin persis sama:
--      select conname, pg_get_constraintdef(oid) from pg_constraint
--       where conrelid = 'public.ai_usage'::regclass;
--      select * from pg_policies where tablename = 'ai_usage';
-- ---------------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id    uuid not null references auth.users (id) on delete cascade,
  period_key text not null,
  words      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_key)
);

alter table public.ai_usage enable row level security;
-- Tidak ada policy: tabel hanya dibaca/ditulis lewat fungsi security definer
-- ai_quota() dan ai_consume().
revoke all on table public.ai_usage from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. ai_quota() — persis seperti definisi di database
-- ---------------------------------------------------------------------
create or replace function public.ai_quota()
 returns table(tier text, quota integer, used integer, period_key text, resets_at timestamp with time zone)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  p public.profiles;
  wk_start timestamptz := (date_trunc('week', now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta';
  wk_key text := 'w:' || to_char(now() at time zone 'Asia/Jakarta', 'IYYY-IW');
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then raise exception 'Profil tidak ditemukan'; end if;
  if p.banned_at is not null then raise exception 'Akun Anda sudah di-ban' using errcode = '42501'; end if;

  tier       := 'eksklusif';
  quota      := case when p.role = 'admin' then null else 100000 end;
  period_key := wk_key;
  resets_at  := wk_start + interval '7 days';

  select coalesce((select u.words from public.ai_usage u where u.user_id = auth.uid() and u.period_key = ai_quota.period_key), 0)
    into used;
  return next;
end $function$;

-- ---------------------------------------------------------------------
-- 4. ai_consume() — persis seperti definisi di database
-- ---------------------------------------------------------------------
create or replace function public.ai_consume(p_words integer)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare q record;
begin
  if p_words is null or p_words < 1 or p_words > 5000 then raise exception 'Jumlah kata tidak valid'; end if;
  select * into q from public.ai_quota();
  insert into public.ai_usage (user_id, period_key, words) values (auth.uid(), q.period_key, p_words)
  on conflict (user_id, period_key) do update set words = public.ai_usage.words + excluded.words, updated_at = now();
end $function$;

-- Hak eksekusi seperti di database: postgres, authenticated, service_role
revoke all on function public.ai_quota()           from public, anon;
revoke all on function public.ai_consume(integer)  from public, anon;
grant execute on function public.ai_quota()          to authenticated, service_role;
grant execute on function public.ai_consume(integer) to authenticated, service_role;

commit;
