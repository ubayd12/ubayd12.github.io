-- =====================================================================
-- Catatku — membatalkan supabase/schema.sql
-- PERHATIAN: menghapus tabel profiles, user_settings, savings, dan
-- subscription_requests BESERTA SELURUH ISINYA (status premium, tabungan,
-- profil keuangan, riwayat langganan). Tabel transactions TIDAK disentuh.
-- =====================================================================

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.admin_ban_user(uuid);
drop function if exists public.admin_decide_request(uuid, boolean);
drop function if exists public.admin_list_requests();
drop function if exists public.admin_list_users();
drop function if exists public.rekap_transaksi(date, date, text);
drop function if exists public.transaksi_periode(date, date);

drop table if exists public.subscription_requests;
drop table if exists public.savings;
drop table if exists public.user_settings;
drop table if exists public.profiles;

drop function if exists public.subscription_requests_before_insert();
drop function if exists public.handle_new_user();
drop function if exists public.is_premium();
drop function if exists public.is_admin();
drop function if exists public.durasi_paket(text);
drop function if exists public.harga_paket(text);
