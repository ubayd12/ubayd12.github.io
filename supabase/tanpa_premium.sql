-- =====================================================================
-- Catatku — hapus sistem premium (semua fitur terbuka)
-- Jalankan di Supabase Dashboard → SQL Editor (sebagai postgres),
-- SETELAH schema.sql dan ban.sql. Aman dijalankan ulang.
-- Batalkan dengan supabase/tanpa_premium_rollback.sql.
--
-- Yang berubah HANYA dua fungsi:
--   1. is_premium(): true untuk setiap pengguna yang login dan tidak di-ban.
--      Policy savings & user_settings serta transaksi_periode() dan
--      rekap_transaksi() memakai fungsi ini, jadi semuanya ikut terbuka.
--   2. ai_quota(): semua pengguna yang tidak di-ban mendapat AI Eksklusif
--      dengan kuota 100.000 kata per minggu (admin tanpa batas).
--
-- Tidak ada tabel, kolom, atau data yang dihapus/diubah. Kolom
-- premium_plan / premium_until dan tabel subscription_requests dibiarkan.
-- create or replace mempertahankan hak eksekusi (grant) yang sudah ada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. is_premium(): login dan tidak di-ban
-- ---------------------------------------------------------------------
create or replace function public.is_premium()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and banned_at is null
  )
$$;

-- ---------------------------------------------------------------------
-- 2. ai_quota(): AI Eksklusif, 100.000 kata per minggu (WIB)
--    period_key  = 'w:' + tahun-minggu ISO zona Asia/Jakarta
--    resets_at   = Senin berikutnya pukul 00.00 WIB
--    admin       = quota null (tanpa batas)
--    di-ban      = ditolak
-- ---------------------------------------------------------------------
create or replace function public.ai_quota()
returns table (tier text, quota integer, used integer, period_key text, resets_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
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
