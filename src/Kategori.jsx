import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from './supabase.js'
import { pesanError } from './lib.js'
import { Modal, IkonKat, Toggle, JENIS, toast } from './ui.jsx'

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
    if (error) setError(pesanError(error)); else onSaved('simpan')
  }

  async function hapus() {
    if (!confirm(`Hapus kategori "${awal.nama}"? Catatan dan transaksi rutin dengan kategori ini menjadi "Tanpa kategori", dan anggarannya ikut dihapus.`)) return
    setBusy(true); setError('')
    const { error } = await supabase.from('categories').delete().eq('id', awal.id)
    setBusy(false)
    if (error) setError(pesanError(error)); else onSaved('hapus')
  }

  return (
    <form className="stack" onSubmit={simpan}>
      <div className="pratinjau">
        <IkonKat kat={{ ikon: ikon || '🏷️', warna }} besar />
        <div>
          <b>{nama.trim() || 'Nama kategori'}</b>
          <small>{(awal?.jenis || jenis) === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}{awal ? ' · jenis tidak bisa diubah' : ''}</small>
        </div>
      </div>
      {!awal && <Toggle value={jenis} onChange={setJenis} options={JENIS} />}
      <label><span className="label-teks">Nama</span>
        <input value={nama} maxLength={40} onChange={e => setNama(e.target.value)} placeholder="mis. Kopi" />
      </label>
      <div className="field">
        <span className="label-teks">Ikon</span>
        <div className="pilihan-ikon">
          {IKON.map(i => (
            <button key={i} type="button" className={ikon === i ? 'on' : ''} aria-pressed={ikon === i} onClick={() => setIkon(i)} aria-label={`Ikon ${i}`}>{i}</button>
          ))}
        </div>
        <label className="sejajar"><span className="label-teks">Atau ketik emoji</span>
          <input value={ikon} maxLength={8} onChange={e => setIkon(e.target.value)} className="pendek" />
        </label>
      </div>
      <div className="field">
        <span className="label-teks">Warna</span>
        <div className="pilihan-warna">
          {WARNA.map(w => (
            <button key={w} type="button" className={warna === w ? 'on' : ''} aria-pressed={warna === w} style={{ background: w }} onClick={() => setWarna(w)} aria-label={`Warna ${w}`} />
          ))}
          <input type="color" value={warna} onChange={e => setWarna(e.target.value)} aria-label="Warna lain" />
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan kategori'}</button>
      {awal && <button type="button" className="bahaya-outline" disabled={busy} onClick={hapus}><Trash2 size={18} /> Hapus kategori</button>}
    </form>
  )
}

export default function Kategori({ kategori, reload }) {
  const [edit, setEdit] = useState(null) // null | { awal } | { jenis }

  function selesai(aksi) {
    setEdit(null)
    reload()
    toast(aksi === 'hapus' ? 'Kategori dihapus' : 'Kategori disimpan')
  }

  return (
    <>
      {JENIS.map(j => {
        const daftar = kategori.filter(k => k.jenis === j.value)
        return (
          <section className="card" key={j.value}>
            <div className="kepala-kartu">
              <div>
                <h2>{j.label}</h2>
                <small className="muted">{daftar.length} kategori · ketuk untuk mengubah</small>
              </div>
            </div>
            <div className="ubin-grid">
              {daftar.map(k => (
                <button key={k.id} type="button" className="ubin" onClick={() => setEdit({ awal: k })}>
                  <IkonKat kat={k} besar />
                  <span>{k.nama}</span>
                </button>
              ))}
              <button type="button" className="ubin tambah" onClick={() => setEdit({ jenis: j.value })}>
                <span className="ikon-kat besar tint-hijau" aria-hidden="true"><Plus size={22} /></span>
                <span>Tambah</span>
              </button>
            </div>
          </section>
        )
      })}
      {edit && (
        <Modal judul={edit.awal ? 'Edit kategori' : 'Tambah kategori'} onClose={() => setEdit(null)}>
          <FormKategori awal={edit.awal} jenisAwal={edit.jenis} onSaved={selesai} />
        </Modal>
      )}
    </>
  )
}
