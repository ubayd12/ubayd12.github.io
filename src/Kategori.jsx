import { useState } from 'react'
import { supabase } from './supabase.js'
import { pesanError } from './lib.js'
import { Modal, Chip, Toggle, JENIS } from './ui.jsx'

const IKON = ['🍽️', '🚌', '🛒', '🧾', '🎬', '💊', '📚', '📦', '🏠', '👕', '📱', '⛽', '☕', '🎮', '✈️', '🐾', '💼', '🎁', '🏪', '💰', '📈', '🤝', '🏷️', '❤️']
const WARNA = ['#ef4444', '#f97316', '#eab308', '#16a34a', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#0d9488']

function FormKategori({ awal, jenisAwal, onSaved }) {
  const [nama, setNama] = useState(awal?.nama || '')
  const [jenis, setJenis] = useState(awal?.jenis || jenisAwal || 'pengeluaran')
  const [ikon, setIkon] = useState(awal?.ikon || '🏷️')
  const [warna, setWarna] = useState(awal?.warna || '#64748b')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function simpan(e) {
    e.preventDefault()
    const n = nama.trim()
    if (!n) { setError('Isi nama kategori.'); return }
    if (!ikon.trim()) { setError('Pilih ikon.'); return }
    setBusy(true); setError('')
    const row = { nama: n, ikon: ikon.trim(), warna }
    const { error } = awal
      ? await supabase.from('categories').update(row).eq('id', awal.id)
      : await supabase.from('categories').insert({ ...row, jenis })
    setBusy(false)
    if (error) setError(pesanError(error)); else onSaved()
  }

  return (
    <form className="stack" onSubmit={simpan}>
      {awal
        ? <small className="muted">Jenis: {awal.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'} (tidak bisa diubah)</small>
        : <Toggle value={jenis} onChange={setJenis} options={JENIS} />}
      <label>Nama
        <input value={nama} maxLength={40} onChange={e => setNama(e.target.value)} placeholder="mis. Kopi" />
      </label>
      <div className="stack-kecil">
        <span className="label">Ikon</span>
        <div className="pilihan-ikon">
          {IKON.map(i => (
            <button key={i} type="button" className={ikon === i ? 'on' : ''} onClick={() => setIkon(i)} aria-label={`Ikon ${i}`}>{i}</button>
          ))}
        </div>
        <label className="sejajar">Atau ketik emoji
          <input value={ikon} maxLength={8} onChange={e => setIkon(e.target.value)} className="pendek" />
        </label>
      </div>
      <div className="stack-kecil">
        <span className="label">Warna</span>
        <div className="pilihan-warna">
          {WARNA.map(w => (
            <button key={w} type="button" className={warna === w ? 'on' : ''} style={{ background: w }} onClick={() => setWarna(w)} aria-label={`Warna ${w}`} />
          ))}
          <input type="color" value={warna} onChange={e => setWarna(e.target.value)} aria-label="Warna lain" />
        </div>
      </div>
      <p>Pratinjau: <Chip kat={{ nama: nama.trim() || 'Kategori', ikon: ikon || '🏷️', warna }} /></p>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
    </form>
  )
}

export default function Kategori({ kategori, reload }) {
  const [edit, setEdit] = useState(null) // null | { awal?, jenis? }
  const [error, setError] = useState('')

  async function hapus(k) {
    if (!confirm(`Hapus kategori "${k.nama}"? Catatan dan transaksi rutin dengan kategori ini menjadi "Tanpa kategori", dan anggarannya ikut dihapus.`)) return
    const { error } = await supabase.from('categories').delete().eq('id', k.id)
    if (error) setError(pesanError(error)); else { setError(''); reload() }
  }

  return (
    <>
      {error && <p className="alert danger">{error}</p>}
      {JENIS.map(j => (
        <div className="card" key={j.value}>
          <div className="row between nowrap">
            <h2>{j.label}</h2>
            <button className="small" onClick={() => setEdit({ jenis: j.value })}>+ Tambah</button>
          </div>
          <ul className="list plain">
            {kategori.filter(k => k.jenis === j.value).length === 0 && <li className="empty">Belum ada kategori.</li>}
            {kategori.filter(k => k.jenis === j.value).map(k => (
              <li key={k.id}>
                <div className="isi"><Chip kat={k} /></div>
                <div className="aksi">
                  <button className="link small" onClick={() => setEdit({ awal: k })}>Edit</button>
                  <button className="link small merah" onClick={() => hapus(k)}>Hapus</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {edit && (
        <Modal judul={edit.awal ? 'Edit kategori' : 'Tambah kategori'} onClose={() => setEdit(null)}>
          <FormKategori awal={edit.awal} jenisAwal={edit.jenis} onSaved={() => { setEdit(null); reload() }} />
        </Modal>
      )}
    </>
  )
}
