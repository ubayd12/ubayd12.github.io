// Helper bersama: format Rupiah, tanggal lokal, bulan, ambil data.
import { supabase } from './supabase.js'

const ribuan = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// Rupiah tanpa desimal: "Rp 1.250.000"
export const rupiah = n => {
  const v = Math.round(Number(n) || 0)
  return (v < 0 ? '−' : '') + 'Rp ' + ribuan(Math.abs(v))
}

// Ringkas untuk sumbu diagram: 1,2 jt / 350 rb
export const rupiahSingkat = n => {
  const v = Math.abs(Number(n) || 0)
  if (v >= 1e9) return (n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' M'
  if (v >= 1e6) return (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt'
  if (v >= 1e3) return Math.round(n / 1e3) + ' rb'
  return String(Math.round(n))
}

// Input angka: tampil "1.250.000", disimpan sebagai angka.
export const formatInput = s => { const d = String(s).replace(/\D/g, '').replace(/^0+/, '').slice(0, 15); return d ? ribuan(d) : '' }
export const parseInput = s => parseInt(String(s).replace(/\D/g, ''), 10) || 0

const pad = n => String(n).padStart(2, '0')
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => ymd(new Date())
export const parseYmd = s => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }

// Rentang bulan relatif terhadap bulan ini (0 = bulan ini, -1 = bulan lalu, 1 = bulan depan)
export function monthRange(offset) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { start: ymd(start), end: ymd(end), label: start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) }
}

// Bulan dalam format "YYYY-MM"
export const bulanIni = () => today().slice(0, 7)
export const geserBulan = (ym, n) => { const [y, m] = ym.split('-').map(Number); return ymd(new Date(y, m - 1 + n, 1)).slice(0, 7) }
export const awalBulan = ym => `${ym}-01`
export const akhirBulan = ym => { const [y, m] = ym.split('-').map(Number); return ymd(new Date(y, m, 0)) }
export const namaBulan = (ym, singkat = false) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: singkat ? 'short' : 'long', year: singkat ? '2-digit' : 'numeric' })
}

export const tanggal = s => parseYmd(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
export const waktu = s => s ? new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'

export const PESAN_BAN = 'Akun Anda sudah di-ban dan tidak bisa digunakan lagi.'

export function pesanError(error) {
  if (!error) return ''
  if (error.code === '42501') return 'Akses ditolak. Coba keluar lalu masuk lagi.'
  if (error.code === '23505') return 'Nama itu sudah dipakai.'
  return error.message
}

export const TANPA_KATEGORI = { id: null, nama: 'Tanpa kategori', ikon: '❔', warna: '#94a3b8' }

// Ambil semua baris (PostgREST membatasi 1000 baris per permintaan).
// buat = fungsi yang mengembalikan query baru setiap dipanggil.
export async function ambilSemua(buat) {
  const hasil = []
  const per = 1000
  for (let dari = 0; ; dari += per) {
    const { data, error } = await buat().range(dari, dari + per - 1)
    if (error) throw error
    hasil.push(...data)
    if (data.length < per) return hasil
  }
}

// Catatan transaksi dalam rentang tanggal (mulai/akhir boleh kosong = semua)
export function ambilTransaksi(mulai, akhir) {
  return ambilSemua(() => {
    let q = supabase.from('transactions').select('id, type, amount, note, date, category_id, created_at')
    if (mulai) q = q.gte('date', mulai)
    if (akhir) q = q.lte('date', akhir)
    return q.order('date', { ascending: false }).order('created_at', { ascending: false }).order('id')
  })
}

export const jumlahJenis = (list, t) => list.filter(i => i.type === t).reduce((s, i) => s + Number(i.amount), 0)

// Warna progres anggaran: hijau < 80%, kuning 80–100%, merah > 100%
export const warnaProgres = pct => pct > 100 ? 'merah' : pct >= 80 ? 'kuning' : 'hijau'
