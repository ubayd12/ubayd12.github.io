import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'
import { rupiah, tanggal, ymd, formatInput, parseInput, pesanError } from './lib.js'
import { Modal, Chip, Toggle, JENIS, PilihKategori } from './ui.jsx'

const TANGGAL = Array.from({ length: 28 }, (_, i) => i + 1)

// Jatuh tempo berikutnya setelah terakhir_dibuat
function berikutnya(r) {
  if (!r.terakhir_dibuat) return null
  const [y, m, d] = r.terakhir_dibuat.split('-').map(Number)
  const t = new Date(y, m - 1 + (r.tanggal <= d ? 1 : 0), r.tanggal)
  return ymd(t)
}

function FormRutin({ kategori, awal, onSaved }) {
  const [jenis, setJenis] = useState(awal?.jenis || 'pengeluaran')
  const [jumlah, setJumlah] = useState(awal ? formatInput(awal.jumlah) : '')
  const [categoryId, setCategoryId] = useState(awal?.category_id || null)
  const [tgl, setTgl] = useState(awal?.tanggal || 1)
  const [catatan, setCatatan] = useState(awal?.catatan || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function gantiJenis(j) {
    setJenis(j)
    if (categoryId && kategori.find(k => k.id === categoryId)?.jenis !== j) setCategoryId(null)
  }

  async function simpan(e) {
    e.preventDefault()
    const v = parseInput(jumlah)
    if (!v) { setError('Isi jumlah lebih dari 0.'); return }
    setBusy(true); setError('')
    const row = { jenis, jumlah: v, category_id: categoryId, tanggal: Number(tgl), catatan: catatan.trim() || null }
    const { error } = awal
      ? await supabase.from('recurring').update(row).eq('id', awal.id)
      : await supabase.from('recurring').insert(row)
    setBusy(false)
    if (error) setError(pesanError(error)); else onSaved()
  }

  return (
    <form className="stack" onSubmit={simpan}>
      <Toggle value={jenis} onChange={gantiJenis} options={JENIS} />
      <label>Jumlah (Rp)
        <input inputMode="numeric" value={jumlah} onChange={e => setJumlah(formatInput(e.target.value))} placeholder="mis. 750.000" />
      </label>
      <PilihKategori kategori={kategori} jenis={jenis} value={categoryId} onChange={setCategoryId} />
      <label>Tiap tanggal
        <select value={tgl} onChange={e => setTgl(e.target.value)}>
          {TANGGAL.map(t => <option key={t} value={t}>Tanggal {t}</option>)}
        </select>
      </label>
      <label>Catatan
        <input value={catatan} maxLength={200} onChange={e => setCatatan(e.target.value)} placeholder="mis. bayar kos" />
      </label>
      <small className="muted">Catatan dibuat otomatis saat aplikasi dibuka pada atau setelah tanggal jatuh tempo, mulai jatuh tempo berikutnya.</small>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
    </form>
  )
}

export default function Rutin({ kategori }) {
  const [items, setItems] = useState([])
  const [edit, setEdit] = useState(null) // null | {} | { awal }
  const [error, setError] = useState('')

  const katMap = useMemo(() => Object.fromEntries(kategori.map(k => [k.id, k])), [kategori])

  async function load() {
    const { data, error } = await supabase.from('recurring').select('*').order('tanggal').order('created_at')
    if (error) setError(pesanError(error)); else { setItems(data); setError('') }
  }
  useEffect(() => { load() }, [])

  async function aktifkan(r) {
    const { error } = await supabase.from('recurring').update({ aktif: !r.aktif }).eq('id', r.id)
    if (error) setError(pesanError(error)); else load()
  }

  async function hapus(r) {
    if (!confirm(`Hapus transaksi rutin ${rupiah(r.jumlah)} tiap tanggal ${r.tanggal}? Catatan yang sudah dibuat tidak ikut terhapus.`)) return
    const { error } = await supabase.from('recurring').delete().eq('id', r.id)
    if (error) setError(pesanError(error)); else load()
  }

  return (
    <>
      <div className="card">
        <div className="row between nowrap">
          <h2>Transaksi rutin</h2>
          <button className="small" onClick={() => setEdit({})}>+ Tambah</button>
        </div>
        <small className="muted">Contoh: gaji tiap tanggal 25, kos tiap tanggal 1.</small>
        {error && <p className="error">{error}</p>}
        <ul className="list plain">
          {items.length === 0 && <li className="empty">Belum ada transaksi rutin.</li>}
          {items.map(r => (
            <li key={r.id} className={r.aktif ? '' : 'redup'}>
              <div className="isi">
                <b className={r.jenis === 'pemasukan' ? 'in' : 'out'}>{r.jenis === 'pemasukan' ? '+' : '−'}{rupiah(r.jumlah)}</b>
                <span className="meta"><Chip kat={katMap[r.category_id]} /> <small>tiap tanggal {r.tanggal}</small></span>
                {r.catatan && <small>{r.catatan}</small>}
                <small>{r.aktif ? `Aktif${berikutnya(r) ? ` · berikutnya ${tanggal(berikutnya(r))}` : ''}` : 'Nonaktif'}</small>
              </div>
              <div className="aksi">
                <button className="link small" onClick={() => aktifkan(r)}>{r.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button className="link small" onClick={() => setEdit({ awal: r })}>Edit</button>
                <button className="link small merah" onClick={() => hapus(r)}>Hapus</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {edit && (
        <Modal judul={edit.awal ? 'Edit transaksi rutin' : 'Tambah transaksi rutin'} onClose={() => setEdit(null)}>
          <FormRutin kategori={kategori} awal={edit.awal} onSaved={() => { setEdit(null); load() }} />
        </Modal>
      )}
    </>
  )
}
