-- =====================================================================
-- Catatku — membatalkan supabase/ban.sql
-- Mengembalikan is_premium(), admin_list_users(), admin_ban_user() dan
-- policy ke versi schema.sql, lalu menghapus kolom profiles.banned_at.
--
-- PERHATIAN:
--   - Setelah rollback, tombol Ban kembali MENGHAPUS akun secara permanen.
--   - Akun yang sudah di-ban TETAP terblokir di Supabase Auth
--     (auth.users.banned_until tidak diubah). Untuk membuka blokir
--     semuanya, jalankan manual baris yang dikomentari di bagian akhir
--     SEBELUM kolom banned_at dihapus (atau sebelum menjalankan file ini).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Hapus policy blokir ban
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
  end loop;
end;
$$;

drop function if exists public.is_banned();

-- ---------------------------------------------------------------------
-- 2. is_premium() versi sebelumnya
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
      and (role = 'admin' or premium_plan = 'selamanya' or premium_until > now())
  )
$$;

-- ---------------------------------------------------------------------
-- 3. admin_list_users() versi sebelumnya (tanpa banned_at)
-- ---------------------------------------------------------------------
drop function if exists public.admin_list_users();
create function public.admin_list_users()
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

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- ---------------------------------------------------------------------
-- 4. admin_ban_user() versi sebelumnya (menghapus akun)
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

  -- Hapus transaksi secara eksplisit (jaga-jaga bila FK transactions belum on delete cascade)
  delete from public.transactions where user_id = p_id;
  -- Menghapus akun auth → profiles, user_settings, savings,
  -- subscription_requests ikut terhapus (on delete cascade).
  delete from auth.users where id = p_id;
end;
$$;

revoke all on function public.admin_ban_user(uuid) from public, anon;
grant execute on function public.admin_ban_user(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. (Opsional, jalankan manual) Buka blokir login akun yang di-ban.
--    Harus dijalankan SEBELUM langkah 6 karena memakai kolom banned_at.
-- ---------------------------------------------------------------------
-- update auth.users set banned_until = null
--  where id in (select id from public.profiles where banned_at is not null);

-- ---------------------------------------------------------------------
-- 6. Hapus kolom banned_at
-- ---------------------------------------------------------------------
alter table public.profiles drop column if exists banned_at;
