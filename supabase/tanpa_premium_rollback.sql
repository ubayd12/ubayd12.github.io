-- =====================================================================
-- Catatku — membatalkan supabase/tanpa_premium.sql
-- Mengembalikan is_premium() dan ai_quota() persis ke definisi sebelum
-- tanpa_premium.sql (premium berbayar + AI Klasik/Eksklusif per paket).
-- Tidak ada tabel atau data yang diubah.
--
-- Catatan: frontend versi tanpa premium tidak lagi punya menu Langganan;
-- kembalikan juga frontend versi sebelumnya bila sistem premium dipakai lagi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. is_premium() versi sebelumnya (ban.sql)
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
      and (role = 'admin' or premium_plan = 'selamanya' or premium_until > now())
  )
$$;

-- ---------------------------------------------------------------------
-- 2. ai_quota() versi sebelumnya
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

  if p.role = 'admin' then
    tier := 'eksklusif'; quota := null; period_key := wk_key; resets_at := wk_start + interval '7 days';
  elsif p.premium_plan = 'selamanya' then
    tier := 'eksklusif'; quota := 5000; period_key := wk_key; resets_at := wk_start + interval '7 days';
  elsif p.premium_plan is not null and p.premium_until > now() then
    tier := 'eksklusif';
    quota := case p.premium_plan when 'harian' then 3500 when 'mingguan' then 5000
                                 when 'bulanan' then 12500 when 'tahunan' then 125000 end;
    period_key := 'p:' || p.premium_plan || ':' || to_char(p.premium_until, 'YYYYMMDDHH24MISS');
    resets_at := p.premium_until;
  else
    tier := 'klasik'; quota := 1000; period_key := wk_key; resets_at := wk_start + interval '7 days';
  end if;

  select coalesce((select u.words from public.ai_usage u where u.user_id = auth.uid() and u.period_key = ai_quota.period_key), 0)
    into used;
  return next;
end $function$;
