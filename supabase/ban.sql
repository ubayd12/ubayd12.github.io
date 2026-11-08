-- =====================================================================
-- Catatku — ban permanen (akun TIDAK dihapus, tetapi diblokir selamanya)
-- Jalankan di Supabase Dashboard → SQL Editor (sebagai postgres),
-- SETELAH supabase/schema.sql. Aman dijalankan ulang.
-- Batalkan dengan supabase/ban_rollback.sql.
--
-- Perilaku ban:
--   1. seluruh data pengguna dihapus (transactions, savings, user_settings,
--      subscription_requests);
--   2. premium dicabut, profiles.banned_at = now();
--   3. login di Supabase Auth diblokir selamanya (auth.users.banned_until);
--   4. baris auth.users TIDAK dihapus → username tetap terpakai dan
--      tidak bisa didaftarkan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kolom banned_at (null = tidak di-ban)
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists banned_at timestamptz;

-- ---------------------------------------------------------------------
-- 2. Pengecekan "akun saya di-ban?" (dipakai policy di bawah)
-- ---------------------------------------------------------------------
create or replace function public.is_banned()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and banned_at is not null
  )
$$;

revoke all on function public.is_banned() from public, anon;
grant execute on function public.is_banned() to authenticated;

-- ---------------------------------------------------------------------
-- 3. is_premium(): akun yang di-ban selalu tidak premium
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
-- 4. Policy: akun yang di-ban tidak bisa insert / update / delete.
--    Dibuat sebagai policy RESTRICTIVE, sehingga digabung (AND) dengan
--    policy yang sudah ada di tiap tabel — termasuk policy transactions
--    yang namanya tidak diatur di schema.sql. Policy lama tidak diubah.
--    Ini menutup sesi lama (JWT yang masih berlaku) milik akun yang di-ban.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['transactions', 'savings', 'user_settings', 'subscription_requests']
  loop
    execute format('drop policy if exists "ban: blokir insert" on public.%I', t);
    execute format('drop policy if exists "ban: blokir update" on public.%I', t);
    execute format('drop policy if exists "ban: blokir delete" on public.%I', t);

    execute format($p$
      create policy "ban: blokir insert" on public.%I
        as restrictive for insert to authenticated
        with check (not (select public.is_banned()))
    $p$, t);
    execute format($p$
      create policy "ban: blokir update" on public.%I
        as restrictive for update to authenticated
        using (not (select public.is_banned()))
        with check (not (select public.is_banned()))
    $p$, t);
    execute format($p$
      create policy "ban: blokir delete" on public.%I
        as restrictive for delete to authenticated
        using (not (select public.is_banned()))
    $p$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. admin_list_users(): ikut mengembalikan banned_at
--    (tipe kembalian berubah → fungsi harus di-drop dulu)
-- ---------------------------------------------------------------------
drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table (
  id uuid, username text, role text, premium_plan text,
  premium_until timestamptz, premium_aktif boolean, created_at timestamptz,
  banned_at timestamptz
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
           (p.banned_at is null
             and (p.role = 'admin' or p.premium_plan = 'selamanya' or coalesce(p.premium_until > now(), false))),
           p.created_at,
           p.banned_at
    from public.profiles p
    order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- ---------------------------------------------------------------------
-- 6. admin_ban_user(): hapus data, cabut premium, blokir login selamanya.
--    Baris auth.users TIDAK dihapus.
-- ---------------------------------------------------------------------
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

  -- 1. Hapus seluruh data pengguna
  delete from public.transactions          where user_id = p_id;
  delete from public.savings               where user_id = p_id;
  delete from public.user_settings         where user_id = p_id;
  delete from public.subscription_requests where user_id = p_id;

  -- 2. Cabut premium dan tandai di-ban
  update public.profiles
     set premium_plan  = null,
         premium_until = null,
         banned_at     = now()
   where id = p_id;

  -- 3. Blokir login di Supabase Auth selamanya
  update auth.users set banned_until = '9999-12-31 00:00:00+00' where id = p_id;

  -- 4. Baris auth.users sengaja TIDAK dihapus: username tetap terpakai.
end;
$$;

revoke all on function public.admin_ban_user(uuid) from public, anon;
grant execute on function public.admin_ban_user(uuid) to authenticated;
