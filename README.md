# Catatku

Aplikasi catatan keuangan (Vite + React + Supabase), di-deploy ke GitHub Pages.
Kunci Supabase diisi saat build dari GitHub Secrets `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` — jangan simpan kunci di repo.

## Fitur
Semua fitur terbuka untuk setiap pengguna yang tidak di-ban:
catat pemasukan/pengeluaran, saringan bulan, rekap harian/mingguan/bulanan/tahunan, tabungan + target,
profil keuangan, notifikasi hemat (80% & 100% budget bulanan), dan menu AI Eksklusif
(100.000 kata per minggu, diisi ulang Senin 00.00 WIB; admin tanpa batas).

**Admin:** daftar pengguna dan ban akun (data dihapus, akun diblokir selamanya,
username tidak bisa didaftarkan ulang).

## Menyiapkan database
1. Buka Supabase Dashboard → SQL Editor, jalankan isi `supabase/schema.sql`.
   (Mengasumsikan tabel `transactions` sudah ada dengan kolom `user_id`, `type`, `amount`, `note`, `date`, `created_at`.)
2. Jadikan akunmu admin:
   ```sql
   update public.profiles set role = 'admin' where username = 'username_kamu';
   ```
3. Untuk membatalkan: jalankan `supabase/rollback.sql` (menghapus data premium, tabungan, profil keuangan, dan riwayat langganan).
4. Ban permanen: jalankan `supabase/ban.sql` setelah `schema.sql`. Untuk membatalkan: `supabase/ban_rollback.sql`.
5. Tanpa premium: jalankan `supabase/tanpa_premium.sql` setelah `ban.sql` (hanya mengganti fungsi `is_premium()` dan `ai_quota()`, tidak menghapus data). Untuk membatalkan: `supabase/tanpa_premium_rollback.sql`.
