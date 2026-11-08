// Helper bersama: format Rupiah, tanggal lokal, paket langganan.

export const rupiah = n => {
  const v = Math.round(Number(n) || 0)
  return (v < 0 ? '−' : '') + 'Rp' + Math.abs(v).toLocaleString('id-ID')
}

// Input angka: tampil "1.250.000", disimpan sebagai angka.
export const formatInput = s => { const d = String(s).replace(/\D/g, ''); return d ? Number(d).toLocaleString('id-ID') : '' }
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

export const tanggal = s => parseYmd(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
export const waktu = s => s ? new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'

export const PLANS = [
  { id: 'harian', nama: 'Harian', harga: 5000, durasi: '1 hari' },
  { id: 'mingguan', nama: 'Mingguan', harga: 7000, durasi: '7 hari' },
  { id: 'bulanan', nama: 'Bulanan', harga: 18000, durasi: '1 bulan' },
  { id: 'tahunan', nama: 'Tahunan', harga: 180000, durasi: '1 tahun' },
  { id: 'selamanya', nama: 'Selamanya', harga: 2000000, durasi: 'tanpa batas waktu' },
]
export const planName = id => PLANS.find(p => p.id === id)?.nama || '–'

export const GOPAY = '082119032019'

// Sama dengan public.is_premium() di database
export const PESAN_BAN = 'Akun Anda sudah di-ban dan tidak bisa digunakan lagi.'

export function isPremium(profile) {
  if (!profile || profile.banned_at) return false
  return profile.role === 'admin' || profile.premium_plan === 'selamanya' ||
    (profile.premium_until != null && new Date(profile.premium_until) > new Date())
}

export function pesanError(error) {
  if (!error) return ''
  if (error.code === '42501' || /premium/i.test(error.message)) return 'Fitur ini khusus Premium.'
  return error.message
}
