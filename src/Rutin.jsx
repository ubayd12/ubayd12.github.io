import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Plus, Repeat, Trash2 } from 'lucide-react'
import { supabase } from './supabase.js'
import { rupiah, tanggal, ymd, formatInput, parseInput, pesanError, TANPA_KATEGORI } from './lib.js'
import { Modal, IkonKat, Toggle, JENIS, PilihKategori, InputUang, Saklar, Skeleton, Kosong, toast } from './ui.jsx'

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
    if (error) setError(pesanError(error)); else onSaved('simpan')
  }

  async function hapus() {
    if (!confirm(`Hapus transaksi rutin ${rupiah(awal.jumlah)} tiap tanggal ${awal.tanggal}? Catatan yang sudah dibuat tidak ikut terhapus.`)) return
    setBusy(true); setError('')
    const { error } = await supabase.from('recurring').delete().eq('id', awal.id)
    setBusy(false)
    if (error) setError(pesanError(error)); else onSaved('hapus')
  }

  return (
    <form className="stack" onSubmit={simpan}>
      <Toggle value={jenis} onChange={gantiJenis} options={JENIS} />
      <label><span className="label-teks">Jumlah</span>
        <InputUang besar value={jumlah} onChange={setJumlah} placeholder="0" />
      </label>
      <PilihKategori kategori={kategori} jenis={jenis} value={categoryId} onChange={setCategoryId} />
      <label><span className="label-teks">Tiap tanggal</span>
        <select value={tgl} onChange={e => setTgl(e.target.value)}>
          {TANGGAL.map(t => <option key={t} value={t}>Tanggal {t} setiap bulan</option>)}
        </select>
      </label>
      <label><span className="label-teks">Catatan <span className="opsional">(opsional)</span></span>
        <input value={catatan} maxLength={200} onChange={e => setCatatan(e.target.value)} placeholder="mis. bayar kos" />
      </label>
      <p className="petunjuk">Catatan dibuat otomatis saat aplikasi dibuka pada atau setelah tanggal jatuh tempo, mulai jatuh tempo berikutnya.</p>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
      {awal && <button type="button" className="bahaya-outline" disabled={busy} onClick={hapus}><Trash2 size={18} /> Hapus transaksi rutin</button>}
    </form>
  )
}

export default function Rutin({ kategori }) {
  const [items, setItems] = useState([])
  const [edit, setEdit] = useState(null) // null | {} | { awal }
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const katMap = useMemo(() => Object.fromEntries(kategori.map(k => [k.id, k])), [kategori])

  async function load() {
    const { data, error } = await supabase.from('recurring').select('*').order('tanggal').order('created_at')
    if (error) setError(pesanError(error)); else { setItems(data); setError('') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function aktifkan(r) {
    setItems(list => list.map(i => i.id === r.id ? { ...i, aktif: !r.aktif } : i))
    const { error } = await supabase.from('recurring').update({ aktif: !r.aktif }).eq('id', r.id)
    if (error) setError(pesanError(error))
    load()
  }

  function selesai(aksi) {
    setEdit(null)
    load()
    toast(aksi === 'hapus' ? 'Transaksi rutin dihapus' : 'Transaksi rutin disimpan')
  }

  return (
    <>
      <section className="card">
        <div className="kepala-kartu">
          <div>
            <h2>Daftar transaksi rutin</h2>
            <small className="muted">Contoh: gaji tiap tanggal 25, kos tiap tanggal 1.</small>
          </div>
          {items.length > 0 && <button type="button" className="kecil" onClick={() => setEdit({})}><Plus size={16} /> Tambah</button>}
        </div>
        {error && <p className="error">{error}</p>}
        {loading ? <Skeleton baris={2} /> : items.length === 0 ? (
          <Kosong ikon={<Repeat size={28} />} judul="Belum ada transaksi rutin" teks="Catatan untuk gaji, kos, atau tagihan bulanan akan dibuat otomatis setiap bulan.">
            <button type="button" onClick={() => setEdit({})}><Plus size={18} /> Tambah transaksi rutin</button>
          </Kosong>
        ) : (
          <ul className="daftar-rutin">
            {items.map(r => {
              const k = katMap[r.category_id] || TANPA_KATEGORI
              const next = r.aktif && berikutnya(r)
              return (
                <li key={r.id} className={`rutin${r.aktif ? '' : ' redup'}`}>
                  <button type="button" className="baris" title="Ketuk untuk edit" onClick={() => setEdit({ awal: r })}>
                    <IkonKat kat={k} />
                    <span className="baris-teks">
                      <b>{r.catatan || k.nama}</b>
                      <small>{r.catatan && r.catatan !== k.nama ? `${k.nama} · ` : ''}tiap tanggal {r.tanggal}</small>
                    </span>
                    <span className={`baris-jumlah ${r.jenis === 'pemasukan' ? 'in' : 'out'}`}>{r.jenis === 'pemasukan' ? '+' : '−'}{rupiah(r.jumlah)}</span>
                  </button>
                  <div className="rutin-bawah">
                    <small><CalendarDays size={14} /> {r.aktif ? (next ? `Berikutnya ${tanggal(next)}` : 'Menunggu jatuh tempo') : 'Sedang dijeda'}</small>
                    <span className="saklar-label">
                      <span>{r.aktif ? 'Aktif' : 'Nonaktif'}</span>
                      <Saklar on={r.aktif} onChange={() => aktifkan(r)} label={`${r.aktif ? 'Nonaktifkan' : 'Aktifkan'} transaksi rutin ${r.catatan || k.nama}`} />
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {edit && (
        <Modal judul={edit.awal ? 'Edit transaksi rutin' : 'Tambah transaksi rutin'} onClose={() => setEdit(null)}>
          <FormRutin kategori={kategori} awal={edit.awal} onSaved={selesai} />
        </Modal>
      )}
    </>
  )
}
