import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { rupiah, bulanIni, geserBulan, namaBulan, TANPA_KATEGORI, monthRange, ambilTransaksi, jumlahJenis, warnaProgres } from './lib.js'

// Pemilih bulan: ‹ November 2026 ›
export function PilihBulan({ value, onChange }) {
  return (
    <div className="pilihbulan">
      <button type="button" className="secondary" aria-label="Bulan sebelumnya" onClick={() => onChange(geserBulan(value, -1))}>‹</button>
      <b>{namaBulan(value)}</b>
      <button type="button" className="secondary" aria-label="Bulan berikutnya" onClick={() => onChange(geserBulan(value, 1))}>›</button>
      {value !== bulanIni() && <button type="button" className="link small" onClick={() => onChange(bulanIni())}>Bulan ini</button>}
    </div>
  )
}

export function Modal({ judul, onClose, children }) {
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label={judul}>
        <div className="row between nowrap">
          <h2>{judul}</h2>
          <button type="button" className="link" aria-label="Tutup" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Chip({ kat }) {
  const k = kat || TANPA_KATEGORI
  return (
    <span className="chip" style={{ '--c': k.warna }}>
      <span aria-hidden="true">{k.ikon}</span> {k.nama}
    </span>
  )
}

export function Progres({ pct }) {
  return (
    <div className={`progress ${warnaProgres(pct)}`} role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
      <span style={{ width: Math.min(100, Math.max(0, pct)) + '%' }} />
    </div>
  )
}

export function Toggle({ value, onChange, options }) {
  return (
    <div className="toggle">
      {options.map(o => (
        <button key={o.value} type="button" className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

export const JENIS = [
  { value: 'pengeluaran', label: 'Pengeluaran' },
  { value: 'pemasukan', label: 'Pemasukan' },
]

// Pilihan kategori sesuai jenis
export function PilihKategori({ kategori, jenis, value, onChange }) {
  const daftar = kategori.filter(k => k.jenis === jenis)
  return (
    <label>Kategori
      <select value={value || ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">{TANPA_KATEGORI.ikon} Tanpa kategori</option>
        {daftar.map(k => <option key={k.id} value={k.id}>{k.ikon} {k.nama}</option>)}
      </select>
    </label>
  )
}

// Peringatan hemat (budget bulanan di Profil Keuangan): 80% dan 100%.
// keluar = pengeluaran bulan ini bila sudah diketahui pemanggil.
export function PeringatanHemat({ keluar }) {
  const [budget, setBudget] = useState(0)
  const [keluarSendiri, setKeluarSendiri] = useState(0)

  useEffect(() => {
    supabase.from('user_settings').select('budget_bulanan').maybeSingle()
      .then(({ data }) => setBudget(Number(data?.budget_bulanan) || 0))
  }, [])
  useEffect(() => {
    if (keluar != null || !budget) return
    const r = monthRange(0)
    ambilTransaksi(r.start, r.end).then(list => setKeluarSendiri(jumlahJenis(list, 'pengeluaran'))).catch(() => {})
  }, [keluar, budget])

  const total = keluar ?? keluarSendiri
  if (!budget) return null
  const persen = Math.round(total / budget * 100)
  if (persen >= 100) {
    return <p className="alert danger">⚠️ Pengeluaran bulan ini sudah {persen}% dari budget ({rupiah(total)} dari {rupiah(budget)}). Budget bulanan sudah habis — saatnya berhemat!</p>
  }
  if (persen >= 80) {
    return <p className="alert warn">🔔 Pengeluaran bulan ini sudah {persen}% dari budget ({rupiah(total)} dari {rupiah(budget)}). Sisa {rupiah(budget - total)}.</p>
  }
  return null
}
