import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownLeft, ArrowUpRight, BellRing, ChevronLeft, ChevronRight, CircleCheck, TriangleAlert, Wallet, X } from 'lucide-react'
import { supabase } from './supabase.js'
import {
  rupiah, bulanIni, geserBulan, namaBulan, TANPA_KATEGORI, monthRange, ambilTransaksi, jumlahJenis,
  warnaProgres, formatInput,
} from './lib.js'

// Logo Catatku: huruf C dengan koin
export function Logo({ size = 36 }) {
  const id = 'logo' + useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#065f46" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id})`} />
      <path d="M41 22.5a13 13 0 1 0 0 19" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <circle cx="44.5" cy="32" r="4.5" fill="#a7f3d0" />
    </svg>
  )
}

// Pemilih bulan: ‹ November 2026 ›
export function PilihBulan({ value, onChange }) {
  const kini = bulanIni()
  return (
    <div className="pilihbulan">
      <button type="button" className="ikon-btn" aria-label="Bulan sebelumnya" onClick={() => onChange(geserBulan(value, -1))}><ChevronLeft size={20} /></button>
      <div className="pilihbulan-label">
        <b>{namaBulan(value)}</b>
        {value === kini
          ? <small>Bulan ini</small>
          : <button type="button" className="link mini" onClick={() => onChange(kini)}>Kembali ke bulan ini</button>}
      </div>
      <button type="button" className="ikon-btn" aria-label="Bulan berikutnya" onClick={() => onChange(geserBulan(value, 1))}><ChevronRight size={20} /></button>
    </div>
  )
}

// Jendela: lembar dari bawah di HP, kotak di tengah di laptop
export function Modal({ judul, onClose, children }) {
  const tutup = useRef(onClose)
  tutup.current = onClose
  const kotak = useRef(null)

  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') tutup.current() }
    window.addEventListener('keydown', esc)
    const lama = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (kotak.current && !kotak.current.contains(document.activeElement)) kotak.current.focus()
    return () => {
      window.removeEventListener('keydown', esc)
      document.body.style.overflow = lama
    }
  }, [])

  return createPortal(
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) tutup.current() }}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label={judul} tabIndex={-1} ref={kotak}>
        <div className="modal-kepala">
          <h2>{judul}</h2>
          <button type="button" className="ikon-btn" aria-label="Tutup" onClick={() => tutup.current()}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

// Notifikasi singkat. Panggil toast('Catatan disimpan') dari mana saja.
export function toast(pesan, jenis = 'sukses') {
  window.dispatchEvent(new CustomEvent('catatku:toast', { detail: { pesan, jenis } }))
}

export function Toaster() {
  const [list, setList] = useState([])
  useEffect(() => {
    let n = 0
    const f = e => {
      const id = ++n
      setList(l => [...l.slice(-2), { id, ...e.detail }])
      setTimeout(() => setList(l => l.filter(t => t.id !== id)), 3200)
    }
    window.addEventListener('catatku:toast', f)
    return () => window.removeEventListener('catatku:toast', f)
  }, [])
  return (
    <div className="toaster" role="status" aria-live="polite">
      {list.map(t => (
        <div key={t.id} className={`toast ${t.jenis}`}>
          {t.jenis === 'gagal' ? <TriangleAlert size={18} /> : <CircleCheck size={18} />}
          <span>{t.pesan}</span>
        </div>
      ))}
    </div>
  )
}

// Kerangka berkilau saat memuat daftar
export function Skeleton({ baris = 3 }) {
  return (
    <div className="skeleton" aria-busy="true">
      <span className="sr-only">Memuat…</span>
      {Array.from({ length: baris }, (_, i) => (
        <div key={i} className="sk-baris" aria-hidden="true">
          <span className="sk sk-bulat" />
          <span className="sk-teks"><span className="sk sk-garis" /><span className="sk sk-garis pendek" /></span>
          <span className="sk sk-angka" />
        </div>
      ))}
    </div>
  )
}

// Tampilan kosong yang ramah
export function Kosong({ ikon, judul, teks, children }) {
  return (
    <div className="kosong">
      <div className="kosong-ikon">{ikon}</div>
      <b>{judul}</b>
      {teks && <p>{teks}</p>}
      {children}
    </div>
  )
}

// Sakelar aktif / nonaktif
export function Saklar({ on, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      className={`saklar${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

// Ikon kategori dalam kotak berwarna
export function IkonKat({ kat, besar }) {
  const k = kat || TANPA_KATEGORI
  return <span className={`ikon-kat${besar ? ' besar' : ''}`} style={{ '--c': k.warna }} aria-hidden="true">{k.ikon}</span>
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

// Label status anggaran: hijau < 80%, kuning 80–100%, merah > 100%
export function StatusAnggaran({ pct }) {
  const w = warnaProgres(pct)
  const teks = w === 'merah' ? 'Lewat batas' : w === 'kuning' ? (pct >= 100 ? 'Batas tercapai' : 'Hampir habis') : 'Aman'
  return <span className={`status ${w}`}>{teks} · {pct}%</span>
}

export function Toggle({ value, onChange, options }) {
  return (
    <div className="segmen" role="group">
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value}
          className={`${value === o.value ? 'on' : ''} ${o.tone || ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const JENIS = [
  { value: 'pengeluaran', label: 'Pengeluaran', tone: 'out' },
  { value: 'pemasukan', label: 'Pemasukan', tone: 'in' },
]

// Input Rupiah dengan awalan "Rp", tampil 1.250.000
export function InputUang({ value, onChange, besar, ...rest }) {
  return (
    <div className={`uang${besar ? ' besar' : ''}`}>
      <span aria-hidden="true">Rp</span>
      <input inputMode="numeric" autoComplete="off" value={value} onChange={e => onChange(formatInput(e.target.value))} {...rest} />
    </div>
  )
}

// Pilihan kategori sesuai jenis, berupa tombol-tombol kecil
export function PilihKategori({ kategori, jenis, value, onChange }) {
  const daftar = kategori.filter(k => k.jenis === jenis)
  const pilihan = [...daftar, TANPA_KATEGORI]
  return (
    <div className="field">
      <span className="label-teks">Kategori</span>
      <div className="pilih-kat" role="group" aria-label="Kategori">
        {pilihan.map(k => {
          const on = (value || null) === k.id
          return (
            <button key={k.id ?? 'tanpa'} type="button" aria-pressed={on} className={on ? 'on' : ''}
              style={{ '--c': k.warna }} onClick={() => onChange(k.id)}>
              <span aria-hidden="true">{k.ikon}</span>{k.nama}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Ringkasan pemasukan, pengeluaran, selisih
export function Ringkas({ masuk, keluar }) {
  const selisih = masuk - keluar
  return (
    <section className="card ringkas">
      <div className="ringkas-item"><span className="ikon-bulat tint-hijau"><ArrowDownLeft size={18} /></span><small>Pemasukan</small><b className="in">{rupiah(masuk)}</b></div>
      <div className="ringkas-item"><span className="ikon-bulat tint-merah"><ArrowUpRight size={18} /></span><small>Pengeluaran</small><b className="out">{rupiah(keluar)}</b></div>
      <div className="ringkas-item"><span className="ikon-bulat tint-biru"><Wallet size={18} /></span><small>Selisih</small><b className={selisih < 0 ? 'out' : ''}>{rupiah(selisih)}</b></div>
    </section>
  )
}

// Peringatan hemat (budget bulanan di Profil Keuangan): 80% dan 100%.
// keluar = pengeluaran bulan ini bila sudah diketahui pemanggil.
export function PeringatanHemat({ keluar, versi }) {
  const [budget, setBudget] = useState(0)
  const [keluarSendiri, setKeluarSendiri] = useState(null)

  useEffect(() => {
    supabase.from('user_settings').select('budget_bulanan').maybeSingle()
      .then(({ data }) => setBudget(Number(data?.budget_bulanan) || 0))
  }, [])
  useEffect(() => {
    if (keluar != null || !budget) return
    const r = monthRange(0)
    ambilTransaksi(r.start, r.end).then(list => setKeluarSendiri(jumlahJenis(list, 'pengeluaran'))).catch(() => {})
  }, [keluar, budget, versi])

  const total = keluar ?? keluarSendiri
  if (!budget || total == null) return null
  const persen = Math.round(total / budget * 100)
  if (persen >= 100) {
    return (
      <div className="alert danger" role="status">
        <TriangleAlert size={20} />
        <p>Pengeluaran bulan ini sudah <b>{persen}%</b> dari budget ({rupiah(total)} dari {rupiah(budget)}). Budget bulanan sudah habis — saatnya berhemat!</p>
      </div>
    )
  }
  if (persen >= 80) {
    return (
      <div className="alert warn" role="status">
        <BellRing size={20} />
        <p>Pengeluaran bulan ini sudah <b>{persen}%</b> dari budget ({rupiah(total)} dari {rupiah(budget)}). Sisa {rupiah(budget - total)}.</p>
      </div>
    )
  }
  return null
}
