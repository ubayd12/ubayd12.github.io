import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, LogOut, Plus, Repeat, TriangleAlert, X } from 'lucide-react'
import { supabase } from './supabase.js'
import { pesanError, tanggalPanjang } from './lib.js'
import Beranda from './Beranda.jsx'
import Catatan, { FormTransaksi } from './Catatan.jsx'
import Anggaran from './Anggaran.jsx'
import Tabungan from './Tabungan.jsx'
import ProfilKeuangan from './ProfilKeuangan.jsx'
import Kategori from './Kategori.jsx'
import Rutin from './Rutin.jsx'
import Admin from './Admin.jsx'
import { Lainnya, Ekspor, GantiPassword } from './Pengaturan.jsx'
import { Logo, Modal, Toaster, toast } from './ui.jsx'
import { HALAMAN, BAWAH, SAMPING_UTAMA, SAMPING_LAIN } from './menu.js'

// Diagram (recharts) dimuat terpisah supaya pembukaan aplikasi lebih ringan
const Statistik = lazy(() => import('./Statistik.jsx'))

// Halaman disimpan di alamat (#statistik) supaya tombol kembali di HP berfungsi
const halamanDariHash = () => { const h = window.location.hash.slice(1); return HALAMAN[h] ? h : 'beranda' }

// Tombol tambah melayang (HP) hanya di halaman ini
const DENGAN_FAB = new Set(['catatan', 'statistik', 'anggaran'])

function MenuSamping({ id, aktif, go }) {
  const m = HALAMAN[id]
  return (
    <button type="button" className={aktif ? 'on' : ''} aria-current={aktif ? 'page' : undefined} onClick={() => go(id)}>
      <m.Ikon size={19} /> {m.label}
    </button>
  )
}

export default function Dashboard({ session, profile, profileError }) {
  const [page, setPage] = useState(halamanDariHash)
  const [kategori, setKategori] = useState([])
  const [katError, setKatError] = useState('')
  const [rutinInfo, setRutinInfo] = useState('')
  const [versi, setVersi] = useState(0)          // naik → halaman dimuat ulang dari awal
  const [versiData, setVersiData] = useState(0)  // naik → data halaman dimuat ulang
  const [tambah, setTambah] = useState(null)     // null | 'pemasukan' | 'pengeluaran'
  const sudahRutin = useRef(false)
  const admin = profile?.role === 'admin'
  const username = profile?.username || session.user.user_metadata?.username || ''
  const inisial = (username || '?').slice(0, 1).toUpperCase()

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

  const bukaTambah = useCallback((jenis = 'pengeluaran') => setTambah(jenis), [])

  const p = page === 'admin' && !admin ? 'beranda' : page
  const info = HALAMAN[p]
  const aktifBawah = p === 'catatan' ? 'beranda' : BAWAH.includes(p) ? p : 'lainnya'
  const umum = { kategori, versi: versiData, onTambah: bukaTambah, go }

  return (
    <div className="app">
      <aside className="samping">
        <div className="merek"><Logo size={36} /><span>Catatku</span></div>
        <button type="button" className="tambah-samping" onClick={() => bukaTambah()}><Plus size={18} /> Tambah catatan</button>
        <nav aria-label="Menu utama">
          <small className="nav-judul">Menu</small>
          {SAMPING_UTAMA.map(id => <MenuSamping key={id} id={id} aktif={p === id} go={go} />)}
          <small className="nav-judul">Pengaturan</small>
          {SAMPING_LAIN.map(id => <MenuSamping key={id} id={id} aktif={p === id} go={go} />)}
          {admin && <MenuSamping id="admin" aktif={p === 'admin'} go={go} />}
        </nav>
        <div className="pengguna">
          <span className="avatar" aria-hidden="true">{inisial}</span>
          <span className="pengguna-teks">
            <b>{username}</b>
            <small>{admin ? 'Admin' : 'Pengguna'}</small>
          </span>
          <button type="button" className="ikon-btn" title="Keluar" aria-label="Keluar" onClick={() => supabase.auth.signOut()}><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="isi-utama">
        <div className="isi-dalam">
          <header className="kepala">
            {info.induk && (
              <button type="button" className="ikon-btn kembali hanya-hp" aria-label="Kembali" onClick={() => go(info.induk)}><ArrowLeft size={22} /></button>
            )}
            <div className="kepala-teks">
              {p === 'beranda'
                ? <><small>{tanggalPanjang()}</small><h1>Halo, {username} 👋</h1></>
                : <><h1>{info.label}</h1>{info.ket && <small>{info.ket}</small>}</>}
            </div>
            <button type="button" className="avatar hanya-hp" aria-label="Akun dan pengaturan" onClick={() => go('lainnya')}>{inisial}</button>
          </header>

          {profileError && <div className="alert warn"><TriangleAlert size={20} /><p>{profileError}</p></div>}
          {katError && <div className="alert warn"><TriangleAlert size={20} /><p>{katError}</p></div>}
          {rutinInfo && (
            <div className="alert sukses" role="status">
              <Repeat size={20} />
              <p>{rutinInfo}</p>
              <button type="button" className="ikon-btn kecil-ikon" aria-label="Tutup pemberitahuan" onClick={() => setRutinInfo('')}><X size={16} /></button>
            </div>
          )}

          <div className="halaman" key={`${p}-${versi}`}>
            {p === 'beranda' && <Beranda {...umum} />}
            {p === 'catatan' && <Catatan {...umum} />}
            {p === 'statistik' && <Suspense fallback={<div className="card"><div className="sk sk-donut" /></div>}><Statistik {...umum} /></Suspense>}
            {p === 'anggaran' && <Anggaran {...umum} />}
            {p === 'tabungan' && <Tabungan />}
            {p === 'lainnya' && <Lainnya go={go} admin={admin} username={username} />}
            {p === 'kategori' && <Kategori kategori={kategori} reload={loadKategori} />}
            {p === 'rutin' && <Rutin kategori={kategori} />}
            {p === 'ekspor' && <Ekspor kategori={kategori} />}
            {p === 'profil' && <ProfilKeuangan />}
            {p === 'password' && <GantiPassword />}
            {p === 'admin' && admin && <Admin myId={session.user.id} />}
          </div>
        </div>
      </main>

      {DENGAN_FAB.has(p) && (
        <button type="button" className="fab" aria-label="Tambah catatan" onClick={() => bukaTambah()}><Plus size={28} /></button>
      )}

      <nav className="bawah" aria-label="Menu bawah">
        {BAWAH.map(id => {
          const m = HALAMAN[id]
          const on = aktifBawah === id
          return (
            <button key={id} type="button" className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} onClick={() => go(id)}>
              <span className="nav-ikon"><m.Ikon size={22} /></span>{m.label}
            </button>
          )
        })}
      </nav>

      {tambah && (
        <Modal judul="Tambah catatan" onClose={() => setTambah(null)}>
          <FormTransaksi kategori={kategori} jenisAwal={tambah} onSaved={() => {
            setTambah(null)
            setVersiData(v => v + 1)
            toast('Catatan disimpan')
          }} />
        </Modal>
      )}
      <Toaster />
    </div>
  )
}
