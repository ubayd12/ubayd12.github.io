import { useMemo, useState } from 'react'
import { supabase } from './supabase.js'
import { pesanError, bulanIni, namaBulan, awalBulan, akhirBulan, ambilTransaksi, TANPA_KATEGORI } from './lib.js'
import { PilihBulan } from './ui.jsx'

// Menu "Lainnya" / Pengaturan
export function Lainnya({ go, admin, menu }) {
  return (
    <div className="card">
      <h2>Lainnya</h2>
      <ul className="menu-lainnya">
        {menu.map(m => (
          <li key={m.id}><button type="button" onClick={() => go(m.id)}><span aria-hidden="true">{m.ikon}</span> {m.label}<span className="panah">›</span></button></li>
        ))}
        {admin && <li><button type="button" onClick={() => go('admin')}><span aria-hidden="true">🛡️</span> Admin<span className="panah">›</span></button></li>}
        <li><button type="button" className="keluar" onClick={() => supabase.auth.signOut()}><span aria-hidden="true">🚪</span> Keluar</button></li>
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------
// Ekspor CSV
// ---------------------------------------------------------------------
function selCsv(v) {
  let s = v == null ? '' : String(v)
  // Cegah teks dibaca Excel sebagai rumus
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function buatCsv(list, katMap) {
  // Pemisah titik koma: dibaca langsung sebagai kolom oleh Excel berbahasa Indonesia.
  const baris = [['Tanggal', 'Jenis', 'Kategori', 'Jumlah', 'Catatan']]
  for (const t of [...list].reverse()) {
    baris.push([
      t.date,
      t.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
      (katMap[t.category_id] || TANPA_KATEGORI).nama,
      Math.round(Number(t.amount)),
      t.note || '',
    ])
  }
  // BOM supaya Excel membaca huruf non-ASCII dengan benar
  return '﻿' + baris.map(r => r.map(selCsv).join(';')).join('\r\n') + '\r\n'
}

function unduh(namaFile, isi) {
  const url = URL.createObjectURL(new Blob([isi], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = namaFile
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Ekspor({ kategori }) {
  const [bulan, setBulan] = useState(bulanIni())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const katMap = useMemo(() => Object.fromEntries(kategori.map(k => [k.id, k])), [kategori])

  async function ekspor(semua) {
    setBusy(true); setError(''); setInfo('')
    try {
      const list = semua ? await ambilTransaksi() : await ambilTransaksi(awalBulan(bulan), akhirBulan(bulan))
      if (list.length === 0) { setInfo('Tidak ada catatan untuk diunduh.'); return }
      unduh(semua ? 'catatku-semua.csv' : `catatku-${bulan}.csv`, buatCsv(list, katMap))
      setInfo(`${list.length} catatan diunduh.`)
    } catch (e) {
      setError(pesanError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>Ekspor CSV</h2>
      <small className="muted">File bisa dibuka di Excel. Kolom: Tanggal, Jenis, Kategori, Jumlah, Catatan.</small>
      <PilihBulan value={bulan} onChange={setBulan} />
      <button disabled={busy} onClick={() => ekspor(false)}>Unduh {namaBulan(bulan)}</button>
      <button className="secondary" disabled={busy} onClick={() => ekspor(true)}>Unduh semua catatan</button>
      {error && <p className="error">{error}</p>}
      {info && <p className="ok">{info}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------
// Ganti password
// ---------------------------------------------------------------------
export function GantiPassword() {
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function simpan(e) {
    e.preventDefault()
    setError(''); setInfo('')
    if (pw1.length < 6) { setError('Password minimal 6 karakter.'); return }
    if (pw1 !== pw2) { setError('Kedua password tidak sama.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw1 })
    setBusy(false)
    if (error) {
      const p = (error.message || '').toLowerCase()
      if (error.code === 'same_password' || p.includes('different from the old')) setError('Password baru harus berbeda dari password lama.')
      else if (error.code === 'reauthentication_needed' || p.includes('reauthenticat')) setError('Demi keamanan, keluar lalu masuk lagi, kemudian coba ganti password.')
      else setError(error.message)
      return
    }
    setPw1(''); setPw2('')
    setInfo('Password berhasil diganti.')
  }

  return (
    <form className="card" onSubmit={simpan}>
      <h2>Ganti password</h2>
      <label>Password baru
        <input type="password" value={pw1} onChange={e => setPw1(e.target.value)} autoComplete="new-password" />
      </label>
      <label>Ulangi password baru
        <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" />
      </label>
      {error && <p className="error">{error}</p>}
      {info && <p className="ok">{info}</p>}
      <button disabled={busy}>{busy ? 'Menyimpan…' : 'Ganti password'}</button>
    </form>
  )
}
