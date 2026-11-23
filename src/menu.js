import {
  House, NotebookPen, ChartPie, Target, PiggyBank, LayoutGrid, Repeat, Tags, Download, UserRound, KeyRound, ShieldCheck,
} from 'lucide-react'

// Semua halaman: judul, keterangan singkat, ikon, warna ikon di menu Lainnya,
// dan halaman induk (untuk tombol kembali di HP).
export const HALAMAN = {
  beranda: { label: 'Beranda', Ikon: House },
  catatan: { label: 'Catatan', ket: 'Semua pemasukan dan pengeluaran', Ikon: NotebookPen, warna: 'biru' },
  statistik: { label: 'Statistik', ket: 'Lihat ke mana uangmu pergi', Ikon: ChartPie },
  anggaran: { label: 'Anggaran', ket: 'Batas belanja per kategori', Ikon: Target },
  tabungan: { label: 'Tabungan', ket: 'Sedikit demi sedikit, lama-lama menjadi bukit', Ikon: PiggyBank },
  lainnya: { label: 'Lainnya', ket: 'Pengaturan dan akun', Ikon: LayoutGrid },
  kategori: { label: 'Kategori', ket: 'Tambah dan atur kategori catatan', Ikon: Tags, warna: 'ungu', induk: 'lainnya' },
  rutin: { label: 'Transaksi rutin', ket: 'Catatan otomatis setiap bulan', Ikon: Repeat, warna: 'hijau', induk: 'lainnya' },
  ekspor: { label: 'Ekspor CSV', ket: 'Unduh catatan untuk dibuka di Excel', Ikon: Download, warna: 'oranye', induk: 'lainnya' },
  profil: { label: 'Profil keuangan', ket: 'Pekerjaan, gaji, budget bulanan, dan kota', Ikon: UserRound, warna: 'teal', induk: 'lainnya' },
  password: { label: 'Ganti password', ket: 'Jaga keamanan akunmu', Ikon: KeyRound, warna: 'kuning', induk: 'lainnya' },
  admin: { label: 'Admin', ket: 'Pengawasan pengguna', Ikon: ShieldCheck, warna: 'merah', induk: 'lainnya' },
}

// Menu bawah (HP)
export const BAWAH = ['beranda', 'statistik', 'anggaran', 'tabungan', 'lainnya']
// Menu samping (laptop)
export const SAMPING_UTAMA = ['beranda', 'catatan', 'statistik', 'anggaran', 'tabungan']
export const SAMPING_LAIN = ['rutin', 'kategori', 'ekspor', 'profil', 'password']
// Isi halaman Lainnya
export const GRUP_LAINNYA = [
  { judul: 'Catatan', ids: ['catatan', 'kategori', 'rutin', 'ekspor'] },
  { judul: 'Akun', ids: ['profil', 'password'] },
]
