# Catatku

Aplikasi catatan keuangan (Vite + React + Supabase), di-deploy ke GitHub Pages.
Kunci Supabase diisi saat build dari GitHub Secrets `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` — jangan simpan kunci di repo.

## Fitur
- **Gratis:** catat pemasukan/pengeluaran, total, saldo, hapus catatan, menu AI Klasik ("AI segera hadir").
- **Premium:** saringan bulan, rekap harian/mingguan/bulanan/tahunan, tabungan + target, profil keuangan,
  notifikasi hemat (80% & 100% budget bulanan), menu AI Eksklusif ("AI segera hadir").
- **Langganan:** pengguna memilih paket, transfer manual ke GoPay, lalu admin mengonfirmasi.
- **Admin:** semua fitur premium, daftar pengguna & permintaan langganan, konfirmasi/tolak, ban akun.

## Menyiapkan database
1. Buka Supabase Dashboard → SQL Editor, jalankan isi `supabase/schema.sql`.
   (Mengasumsikan tabel `transactions` sudah ada dengan kolom `user_id`, `type`, `amount`, `note`, `date`, `created_at`.)
2. Jadikan akunmu admin:
   ```sql
   update public.profiles set role = 'admin' where username = 'username_kamu';
   ```
3. Untuk membatalkan: jalankan `supabase/rollback.sql` (menghapus data premium, tabungan, profil keuangan, dan riwayat langganan).
