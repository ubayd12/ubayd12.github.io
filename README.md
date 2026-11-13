# Catatku

Aplikasi catatan keuangan (Vite + React + Supabase), di-deploy ke GitHub Pages.
Kunci Supabase diisi saat build dari GitHub Secrets `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` — jangan simpan kunci di repo.

## Fitur
Semua fitur terbuka untuk setiap pengguna yang tidak di-ban:
- **Beranda:** saldo, pemasukan, dan pengeluaran bulan ini, 5 catatan terakhir, dan anggaran yang paling mendekati batas.
- **Catatan:** tambah, edit, dan hapus catatan dengan kategori; saringan bulan, jenis, dan kategori; kotak cari.
- **Statistik:** diagram lingkaran pengeluaran per kategori, diagram batang pemasukan vs pengeluaran 6 bulan, dan rekap harian/mingguan/bulanan/tahunan.
- **Anggaran:** batas per kategori per bulan (hijau < 80%, kuning 80–100%, merah > 100%) dan "Salin dari bulan lalu".
- **Tabungan** + target.
- **Lainnya / Pengaturan:** kategori, transaksi rutin (dibuat otomatis saat aplikasi dibuka), ekspor CSV, profil keuangan, ganti password, keluar.
- Notifikasi hemat (80% & 100% budget bulanan dari Profil Keuangan).

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
6. Fitur keuangan: jalankan `supabase/fitur_keuangan.sql` setelah `tanpa_premium.sql`
   (menghapus fitur AI di database, menambah kategori, anggaran per kategori, dan transaksi rutin;
   data transaksi dan tabungan tidak dihapus). Untuk membatalkan: `supabase/fitur_keuangan_rollback.sql`.
