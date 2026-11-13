import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'
import {
  rupiah, today, tanggal, formatInput, parseInput, pesanError, bulanIni, geserBulan, namaBulan,
  awalBulan, akhirBulan, ambilTransaksi, jumlahJenis, TANPA_KATEGORI,
} from './lib.js'
import { Modal, Chip, Toggle, JENIS, PilihKategori, PeringatanHemat } from './ui.jsx'

// Formulir catatan (tambah & edit)
function FormTransaksi({ kategori, awal, onSaved, tombol = 'Simpan' }) {
  const [type, setType] = useState(awal?.type || 'pengeluaran')
  const [amount, setAmount] = useState(awal ? formatInput(awal.amount) : '')
  const [categoryId, setCategoryId] = useState(awal?.category_id || null)
  const [date, setDate] = useState(awal?.date || today())
  const [note, setNote] = useState(awal?.note || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function gantiJenis(j) {
    setType(j)
    // Kategori harus sesuai jenis
    if (categoryId && kategori.find(k => k.id === categoryId)?.jenis !== j) setCategoryId(null)
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const value = parseInput(amount)
    if (!value) { setError('Isi jumlah lebih dari 0.'); return }
    if (!date) { setError('Isi tanggal.'); return }
    const row = { type, amount: value, category_id: categoryId, date, note: note.trim() || null }
    setBusy(true)
    const { error } = awal
      ? await supabase.from('transactions').update(row).eq('id', awal.id)
      : await supabase.from('transactions').insert(row)
    setBusy(false)
    if (error) { setError(pesanError(error)); return }
    if (!awal) { setAmount(''); setNote('') }
    onSaved()
  }

  return (
    <form className="stack" onSubmit={submit}>
      <Toggle value={type} onChange={gantiJenis} options={JENIS} />
      <label>Jumlah (Rp)
        <input inputMode="numeric" value={amount} onChange={e => setAmount(formatInput(e.target.value))} placeholder="mis. 25.000" />
      </label>
      <PilihKategori kategori={kategori} jenis={type} value={categoryId} onChange={setCategoryId} />
      <label>Tanggal
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </label>
      <label>Catatan
        <input value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="mis. makan siang" />
      </label>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Menyimpan…' : tombol}</button>
    </form>
  )
}

// Satu baris catatan dalam daftar
export function BarisCatatan({ item, kat, onEdit, onHapus }) {
  return (
    <li>
      <div className="isi">
        <b className={item.type === 'pemasukan' ? 'in' : 'out'}>
          {item.type === 'pemasukan' ? '+' : '−'}{rupiah(item.amount)}
        </b>
        <span className="meta"><Chip kat={kat} /> <small>{tanggal(item.date)}</small></span>
        {item.note && <small>{item.note}</small>}
      </div>
      {(onEdit || onHapus) && (
        <div className="aksi">
          {onEdit && <button className="link small" onClick={() => onEdit(item)}>Edit</button>}
          {onHapus && <button className="link small merah" onClick={() => onHapus(item)}>Hapus</button>}
        </div>
      )}
    </li>
  )
}

const PILIHAN_BULAN = Array.from({ length: 26 }, (_, i) => geserBulan(bulanIni(), 1 - i))

export default function Catatan({ kategori }) {
  const [items, setItems] = useState([])
  const [bulan, setBulan] = useState(bulanIni())
  const [jenis, setJenis] = useState('')
  const [kat, setKat] = useState('')
  const [cari, setCari] = useState('')
  const [edit, setEdit] = useState(null)
  const [tambah, setTambah] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const katMap = useMemo(() => Object.fromEntries(kategori.map(k => [k.id, k])), [kategori])

  async function load() {
    setLoading(true)
    try {
      setItems(await ambilTransaksi(bulan && awalBulan(bulan), bulan && akhirBulan(bulan)))
      setError('')
    } catch (e) { setError(pesanError(e)) }
    setLoading(false)
  }
  useEffect(() => { load() }, [bulan])

  async function hapus(item) {
    if (!confirm(`Hapus catatan ${rupiah(item.amount)} tanggal ${tanggal(item.date)}?`)) return
    const { error } = await supabase.from('transactions').delete().eq('id', item.id)
    if (error) { setError(pesanError(error)); return }
    setItems(items.filter(i => i.id !== item.id))
  }

  const kata = cari.trim().toLowerCase()
  const tampil = items.filter(i => {
    if (jenis && i.type !== jenis) return false
    if (kat === 'none' && i.category_id && katMap[i.category_id]) return false
    if (kat && kat !== 'none' && i.category_id !== kat) return false
    if (kata) {
      const namaKat = (katMap[i.category_id] || TANPA_KATEGORI).nama.toLowerCase()
      if (!(i.note || '').toLowerCase().includes(kata) && !namaKat.includes(kata)) return false
    }
    return true
  })
  const masuk = jumlahJenis(tampil, 'pemasukan')
  const keluar = jumlahJenis(tampil, 'pengeluaran')
  const disaring = jenis || kat || kata

  return (
    <>
      <PeringatanHemat />

      <div className="card">
        <div className="row between">
          <h2>Catatan</h2>
          <button className="small" onClick={() => setTambah(true)}>+ Tambah</button>
        </div>
        <div className="saringan">
          <label>Bulan
            <select value={bulan} onChange={e => setBulan(e.target.value)}>
              <option value="">Semua bulan</option>
              {PILIHAN_BULAN.map(b => <option key={b} value={b}>{namaBulan(b)}</option>)}
            </select>
          </label>
          <label>Jenis
            <select value={jenis} onChange={e => { setJenis(e.target.value); setKat('') }}>
              <option value="">Semua</option>
              {JENIS.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
            </select>
          </label>
          <label>Kategori
            <select value={kat} onChange={e => setKat(e.target.value)}>
              <option value="">Semua</option>
              <option value="none">{TANPA_KATEGORI.ikon} Tanpa kategori</option>
              {kategori.filter(k => !jenis || k.jenis === jenis).map(k => (
                <option key={k.id} value={k.id}>{k.ikon} {k.nama}{jenis ? '' : ` (${k.jenis})`}</option>
              ))}
            </select>
          </label>
          <label>Cari
            <input type="search" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari catatan…" />
          </label>
        </div>
      </div>

      <div className="summary">
        <div><small>Pemasukan</small><b className="in">{rupiah(masuk)}</b></div>
        <div><small>Pengeluaran</small><b className="out">{rupiah(keluar)}</b></div>
        <div className="lebar"><small>Selisih</small><b>{rupiah(masuk - keluar)}</b></div>
      </div>

      {error && <p className="alert danger">{error}</p>}

      <ul className="list">
        {loading && <li className="empty">Memuat…</li>}
        {!loading && tampil.length === 0 && <li className="empty">{disaring ? 'Tidak ada catatan yang cocok.' : 'Belum ada catatan.'}</li>}
        {!loading && tampil.map(i => (
          <BarisCatatan key={i.id} item={i} kat={katMap[i.category_id]} onEdit={setEdit} onHapus={hapus} />
        ))}
      </ul>

      {tambah && (
        <Modal judul="Tambah catatan" onClose={() => setTambah(false)}>
          <FormTransaksi kategori={kategori} onSaved={() => { setTambah(false); load() }} />
        </Modal>
      )}
      {edit && (
        <Modal judul="Edit catatan" onClose={() => setEdit(null)}>
          <FormTransaksi kategori={kategori} awal={edit} tombol="Simpan perubahan" onSaved={() => { setEdit(null); load() }} />
        </Modal>
      )}
    </>
  )
}

export { FormTransaksi }
