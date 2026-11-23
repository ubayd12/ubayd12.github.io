import { useMemo, useState } from 'react'
import { ChevronRight, Download, Eye, EyeOff, FileSpreadsheet, KeyRound, LogOut } from 'lucide-react'
import { supabase } from './supabase.js'
import { pesanError, bulanIni, namaBulan, awalBulan, akhirBulan, ambilTransaksi, TANPA_KATEGORI } from './lib.js'
import { PilihBulan } from './ui.jsx'
import { HALAMAN, GRUP_LAINNYA } from './menu.js'

// Halaman "Lainnya": profil singkat + menu pengaturan
export function Lainnya({ go, admin, username }) {
  const grup = GRUP_LAINNYA.map(g => ({
    ...g,
    ids: g.judul === 'Akun' && admin ? [...g.ids, 'admin'] : g.ids,
  }))
  return (
    <>
      <section className="card profil-kartu">
        <span className="avatar besar" aria-hidden="true">{(username || '?').slice(0, 1).toUpperCase()}</span>
        <div>
          <b>{username}</b>
          <small>{admin ? <span className="badge">Admin</span> : 'Pengguna Catatku'}</small>
        </div>
      </section>

      {grup.map(g => (
        <section className="card menu-grup" key={g.judul}>
          <h3>{g.judul}</h3>
          <ul>
            {g.ids.map(id => {
              const m = HALAMAN[id]
              return (
                <li key={id}>
                  <button type="button" onClick={() => go(id)}>
                    <span className={`menu-ikon tint-${m.warna}`}><m.Ikon size={20} /></span>
                    <span className="menu-teks"><b>{m.label}</b><small>{m.ket}</small></span>
                    <ChevronRight size={18} className="panah" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <button type="button" className="keluar-btn" onClick={() => supabase.auth.signOut()}><LogOut size={18} /> Keluar</button>
    </>
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
    <section className="card">
      <div className="kartu-ikon">
        <span className="menu-ikon tint-oranye"><FileSpreadsheet size={22} /></span>
        <div>
          <h2>Unduh catatan</h2>
          <small className="muted">File CSV bisa dibuka di Excel. Kolom: Tanggal, Jenis, Kategori, Jumlah, Catatan.</small>
        </div>
      </div>
      <PilihBulan value={bulan} onChange={setBulan} />
      <button type="button" disabled={busy} onClick={() => ekspor(false)}><Download size={18} /> Unduh {namaBulan(bulan)}</button>
      <button type="button" className="secondary lebar" disabled={busy} onClick={() => ekspor(true)}><Download size={18} /> Unduh semua catatan</button>
      {error && <p className="error">{error}</p>}
      {info && <p className="ok">{info}</p>}
    </section>
  )
}

// ---------------------------------------------------------------------
// Ganti password
// ---------------------------------------------------------------------
function InputPassword({ value, onChange, lihat, ...rest }) {
  return <input type={lihat ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} autoComplete="new-password" {...rest} />
}

export function GantiPassword() {
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [lihat, setLihat] = useState(false)
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
      <div className="kartu-ikon">
        <span className="menu-ikon tint-kuning"><KeyRound size={22} /></span>
        <div>
          <h2>Password baru</h2>
          <small className="muted">Minimal 6 karakter. Isi dua kali supaya tidak salah ketik.</small>
        </div>
      </div>
      <label><span className="label-teks">Password baru</span>
        <InputPassword value={pw1} onChange={setPw1} lihat={lihat} />
      </label>
      <label><span className="label-teks">Ulangi password baru</span>
        <InputPassword value={pw2} onChange={setPw2} lihat={lihat} />
      </label>
      <button type="button" className="link lihat-pw" onClick={() => setLihat(!lihat)}>
        {lihat ? <><EyeOff size={16} /> Sembunyikan password</> : <><Eye size={16} /> Tampilkan password</>}
      </button>
      {error && <p className="error">{error}</p>}
      {info && <p className="ok">{info}</p>}
      <button disabled={busy}>{busy ? 'Menyimpan…' : 'Ganti password'}</button>
    </form>
  )
}
