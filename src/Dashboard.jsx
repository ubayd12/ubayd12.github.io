import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { pesanError } from './lib.js'
import Beranda from './Beranda.jsx'
import Catatan from './Catatan.jsx'
import Anggaran from './Anggaran.jsx'
import Tabungan from './Tabungan.jsx'
import ProfilKeuangan from './ProfilKeuangan.jsx'
import Kategori from './Kategori.jsx'
import Rutin from './Rutin.jsx'
import Admin from './Admin.jsx'
import { Lainnya, Ekspor, GantiPassword } from './Pengaturan.jsx'

// Diagram (recharts) dimuat terpisah supaya pembukaan aplikasi lebih ringan
const Statistik = lazy(() => import('./Statistik.jsx'))

// Halaman di menu bawah (HP)
const BAWAH = [
  { id: 'beranda', label: 'Beranda', ikon: '🏠' },
  { id: 'statistik', label: 'Statistik', ikon: '📊' },
  { id: 'anggaran', label: 'Anggaran', ikon: '🎯' },
  { id: 'tabungan', label: 'Tabungan', ikon: '🐷' },
  { id: 'lainnya', label: 'Lainnya', ikon: '☰' },
]
// Isi menu Lainnya / Pengaturan
const LAINNYA = [
  { id: 'catatan', label: 'Semua catatan', ikon: '📝' },
  { id: 'kategori', label: 'Kategori', ikon: '🏷️' },
  { id: 'rutin', label: 'Transaksi rutin', ikon: '🔁' },
  { id: 'ekspor', label: 'Ekspor CSV', ikon: '⬇️' },
  { id: 'profil', label: 'Profil keuangan', ikon: '👤' },
  { id: 'password', label: 'Ganti password', ikon: '🔑' },
]
// Menu samping (laptop)
const SAMPING = [
  { id: 'beranda', label: 'Beranda', ikon: '🏠' },
  { id: 'catatan', label: 'Catatan', ikon: '📝' },
  { id: 'statistik', label: 'Statistik', ikon: '📊' },
  { id: 'anggaran', label: 'Anggaran', ikon: '🎯' },
  { id: 'tabungan', label: 'Tabungan', ikon: '🐷' },
  { id: 'rutin', label: 'Transaksi rutin', ikon: '🔁' },
  { id: 'kategori', label: 'Kategori', ikon: '🏷️' },
  { id: 'ekspor', label: 'Ekspor CSV', ikon: '⬇️' },
  { id: 'profil', label: 'Profil keuangan', ikon: '👤' },
  { id: 'password', label: 'Ganti password', ikon: '🔑' },
]
const JUDUL = Object.fromEntries([...BAWAH, ...LAINNYA, ...SAMPING, { id: 'admin', label: 'Admin' }].map(m => [m.id, m.label]))
JUDUL.catatan = 'Catatan'
const SEMUA = new Set(Object.keys(JUDUL))

// Halaman disimpan di alamat (#statistik) supaya tombol kembali di HP berfungsi
const halamanDariHash = () => { const h = window.location.hash.slice(1); return SEMUA.has(h) ? h : 'beranda' }

export default function Dashboard({ session, profile, profileError }) {
  const [page, setPage] = useState(halamanDariHash)
  const [kategori, setKategori] = useState([])
  const [katError, setKatError] = useState('')
  const [rutinInfo, setRutinInfo] = useState('')
  const [versi, setVersi] = useState(0)
  const sudahRutin = useRef(false)
  const admin = profile?.role === 'admin'
  const username = profile?.username || session.user.user_metadata?.username || ''

  useEffect(() => {
    const f = () => { setPage(halamanDariHash()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  const go = id => { if (id === page) return; window.location.hash = id }

  const loadKategori = useCallback(async () => {
    const { data, error } = await supabase.from('categories').select('*').order('created_at').order('nama')
    if (error) setKatError('Kategori belum bisa dimuat: ' + pesanError(error))
    else { setKatError(''); setKategori(data) }
  }, [])
  useEffect(() => { loadKategori() }, [loadKategori])

  // Buat catatan dari transaksi rutin yang sudah jatuh tempo (sekali per pembukaan aplikasi)
  useEffect(() => {
    if (sudahRutin.current || profile?.banned_at) return
    sudahRutin.current = true
    supabase.rpc('proses_transaksi_rutin').then(({ data, error }) => {
      if (error) return
      const n = Number(data) || 0
      if (n > 0) {
        setRutinInfo(`${n} catatan dari transaksi rutin dibuat otomatis.`)
        setVersi(v => v + 1) // muat ulang halaman yang sedang tampil
      }
    })
  }, [profile])

  const aktifBawah = page === 'catatan' ? 'beranda' : BAWAH.some(b => b.id === page) ? page : 'lainnya'
  const p = page === 'admin' && !admin ? 'beranda' : page

  return (
    <div className="app">
      <aside className="samping">
        <div className="logo">Catatku</div>
        <nav>
          {SAMPING.map(m => (
            <button key={m.id} className={p === m.id ? 'on' : ''} onClick={() => go(m.id)}><span aria-hidden="true">{m.ikon}</span> {m.label}</button>
          ))}
          {admin && <button className={p === 'admin' ? 'on' : ''} onClick={() => go('admin')}><span aria-hidden="true">🛡️</span> Admin</button>}
        </nav>
        <div className="samping-bawah">
          <small>Masuk sebagai <b>{username}</b>{admin && <> <span className="badge">Admin</span></>}</small>
          <button className="link" onClick={() => supabase.auth.signOut()}>Keluar</button>
        </div>
      </aside>

      <main className="isi-utama">
        <header className="topbar">
          <div>
            <span className="logo-hp">Catatku</span>
            <h1>{JUDUL[p]}</h1>
          </div>
          <small className="halo">Halo, <b>{username}</b>{admin && <> <span className="badge">Admin</span></>}</small>
        </header>

        {profileError && <p className="alert warn">{profileError}</p>}
        {katError && <p className="alert warn">{katError}</p>}
        {rutinInfo && (
          <p className="alert ok-bg" role="status">
            🔁 {rutinInfo} <button className="link small" onClick={() => setRutinInfo('')}>Tutup</button>
          </p>
        )}

        <div key={`${p}-${versi}`}>
          {p === 'beranda' && <Beranda kategori={kategori} go={go} />}
          {p === 'catatan' && <Catatan kategori={kategori} />}
          {p === 'statistik' && <Suspense fallback={<p>Memuat…</p>}><Statistik kategori={kategori} /></Suspense>}
          {p === 'anggaran' && <Anggaran kategori={kategori} />}
          {p === 'tabungan' && <Tabungan />}
          {p === 'lainnya' && <Lainnya go={go} admin={admin} menu={LAINNYA} />}
          {p === 'kategori' && <Kategori kategori={kategori} reload={loadKategori} />}
          {p === 'rutin' && <Rutin kategori={kategori} />}
          {p === 'ekspor' && <Ekspor kategori={kategori} />}
          {p === 'profil' && <ProfilKeuangan />}
          {p === 'password' && <GantiPassword />}
          {p === 'admin' && admin && <Admin myId={session.user.id} />}
        </div>
      </main>

      <nav className="bawah" aria-label="Menu utama">
        {BAWAH.map(m => (
          <button key={m.id} className={aktifBawah === m.id ? 'on' : ''} onClick={() => go(m.id)}>
            <span aria-hidden="true">{m.ikon}</span>{m.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
