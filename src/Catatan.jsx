import { useEffect, useMemo, useState } from 'react'
import { NotebookPen, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from './supabase.js'
import {
  rupiah, today, kemarin, tanggal, labelHari, formatInput, parseInput, pesanError, bulanIni, geserBulan, namaBulan,
  awalBulan, akhirBulan, ambilTransaksi, jumlahJenis, TANPA_KATEGORI,
} from './lib.js'
import {
  Modal, Toggle, JENIS, PilihKategori, PeringatanHemat, InputUang, IkonKat, Ringkas, Skeleton, Kosong, toast,
} from './ui.jsx'

// Formulir catatan (tambah & edit). onSaved('tambah' | 'ubah' | 'hapus')
export function FormTransaksi({ kategori, awal, jenisAwal = 'pengeluaran', onSaved }) {
  const [type, setType] = useState(awal?.type || jenisAwal)
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
    onSaved(awal ? 'ubah' : 'tambah')
  }

  async function hapus() {
    if (!confirm(`Hapus catatan ${rupiah(awal.amount)} tanggal ${tanggal(awal.date)}?`)) return
    setError(''); setBusy(true)
    const { error } = await supabase.from('transactions').delete().eq('id', awal.id)
    setBusy(false)
    if (error) { setError(pesanError(error)); return }
    onSaved('hapus')
  }

  const hariIni = today()
  const kmrn = kemarin()
  return (
    <form className="stack" onSubmit={submit}>
      <Toggle value={type} onChange={gantiJenis} options={JENIS} />
      <label><span className="label-teks">Jumlah</span>
        <InputUang besar value={amount} onChange={setAmount} placeholder="0" autoFocus={!awal} />
      </label>
      <PilihKategori kategori={kategori} jenis={type} value={categoryId} onChange={setCategoryId} />
      <div className="field">
        <div className="field-kepala">
          <span className="label-teks">Tanggal</span>
          <span className="mini-chips">
            <button type="button" className={date === hariIni ? 'on' : ''} onClick={() => setDate(hariIni)}>Hari ini</button>
            <button type="button" className={date === kmrn ? 'on' : ''} onClick={() => setDate(kmrn)}>Kemarin</button>
          </span>
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Tanggal" />
      </div>
      <label><span className="label-teks">Catatan <span className="opsional">(opsional)</span></span>
        <input value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="mis. makan siang" />
      </label>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Menyimpan…' : awal ? 'Simpan perubahan' : 'Simpan catatan'}</button>
      {awal && <button type="button" className="bahaya-outline" disabled={busy} onClick={hapus}><Trash2 size={18} /> Hapus catatan</button>}
    </form>
  )
}

// Satu baris catatan. onClick → buka edit.
export function BarisCatatan({ item, kat, onClick, denganTanggal = true }) {
  const k = kat || TANPA_KATEGORI
  const masuk = item.type === 'pemasukan'
  const ket = [item.note, denganTanggal && tanggal(item.date)].filter(Boolean).join(' · ')
  const isi = (
    <>
      <IkonKat kat={k} />
      <span className="baris-teks">
        <b>{k.nama}</b>
        {ket && <small>{ket}</small>}
      </span>
      <span className={`baris-jumlah ${masuk ? 'in' : 'out'}`}>{masuk ? '+' : '−'}{rupiah(item.amount)}</span>
    </>
  )
  return (
    <li>
      {onClick
        ? <button type="button" className="baris" title="Ketuk untuk edit" onClick={() => onClick(item)}>{isi}</button>
        : <div className="baris">{isi}</div>}
    </li>
  )
}

const PILIHAN_BULAN = Array.from({ length: 26 }, (_, i) => geserBulan(bulanIni(), 1 - i))
const SARING_JENIS = [{ v: '', l: 'Semua' }, { v: 'pemasukan', l: 'Pemasukan' }, { v: 'pengeluaran', l: 'Pengeluaran' }]

export default function Catatan({ kategori, versi, onTambah }) {
  const [items, setItems] = useState([])
  const [bulan, setBulan] = useState(bulanIni())
  const [jenis, setJenis] = useState('')
  const [kat, setKat] = useState('')
  const [cari, setCari] = useState('')
  const [edit, setEdit] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const katMap = useMemo(() => Object.fromEntries(kategori.map(k => [k.id, k])), [kategori])

  async function load() {
    try {
      setItems(await ambilTransaksi(bulan && awalBulan(bulan), bulan && akhirBulan(bulan)))
      setError('')
    } catch (e) { setError(pesanError(e)) }
    setLoading(false)
  }
  useEffect(() => { setLoading(true) }, [bulan]) // kerangka hanya saat ganti bulan
  useEffect(() => { load() }, [bulan, versi])

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

  // Kelompokkan per tanggal
  const grup = []
  for (const i of tampil) {
    const g = grup[grup.length - 1]
    if (g && g.date === i.date) g.items.push(i)
    else grup.push({ date: i.date, items: [i] })
  }
  for (const g of grup) g.net = jumlahJenis(g.items, 'pemasukan') - jumlahJenis(g.items, 'pengeluaran')

  function selesai(aksi) {
    setEdit(null)
    load()
    toast(aksi === 'hapus' ? 'Catatan dihapus' : 'Perubahan disimpan')
  }

  return (
    <>
      <PeringatanHemat versi={versi} />

      <section className="card alat">
        <div className="cari">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari catatan atau kategori…" aria-label="Cari catatan" />
        </div>
        <div className="alat-baris">
          <select value={bulan} onChange={e => setBulan(e.target.value)} aria-label="Bulan">
            <option value="">Semua bulan</option>
            {PILIHAN_BULAN.map(b => <option key={b} value={b}>{namaBulan(b)}</option>)}
          </select>
          <select value={kat} onChange={e => setKat(e.target.value)} aria-label="Kategori">
            <option value="">Semua kategori</option>
            <option value="none">{TANPA_KATEGORI.ikon} Tanpa kategori</option>
            {kategori.filter(k => !jenis || k.jenis === jenis).map(k => (
              <option key={k.id} value={k.id}>{k.ikon} {k.nama}{jenis ? '' : ` (${k.jenis})`}</option>
            ))}
          </select>
        </div>
        <div className="chips" role="group" aria-label="Jenis">
          {SARING_JENIS.map(j => (
            <button key={j.v} type="button" aria-pressed={jenis === j.v} className={jenis === j.v ? 'on' : ''}
              onClick={() => { setJenis(j.v); setKat('') }}>{j.l}</button>
          ))}
        </div>
      </section>

      <Ringkas masuk={masuk} keluar={keluar} />

      {error && <p className="alert danger">{error}</p>}

      <section className="card">
        <div className="kepala-kartu">
          <div>
            <h2>{bulan ? namaBulan(bulan) : 'Semua bulan'}</h2>
            {!loading && <small className="muted">{tampil.length} catatan</small>}
          </div>
          <button type="button" className="kecil hanya-laptop" onClick={() => onTambah()}><Plus size={16} /> Tambah</button>
        </div>

        {loading ? <Skeleton baris={5} /> : tampil.length === 0 ? (
          <Kosong ikon={<NotebookPen size={28} />}
            judul={disaring ? 'Tidak ada yang cocok' : 'Belum ada catatan'}
            teks={disaring ? 'Coba ubah kata kunci atau saringan.' : 'Catat pemasukan dan pengeluaranmu supaya keuangan lebih teratur.'}>
            {!disaring && <button type="button" onClick={() => onTambah()}><Plus size={18} /> Tambah catatan</button>}
          </Kosong>
        ) : grup.map(g => (
          <div className="grup" key={g.date}>
            <div className="grup-kepala">
              <span>{labelHari(g.date)}</span>
              {g.items.length > 1 && <span className={g.net < 0 ? 'out' : 'in'}>{g.net > 0 ? '+' : ''}{rupiah(g.net)}</span>}
            </div>
            <ul className="daftar">
              {g.items.map(i => (
                <BarisCatatan key={i.id} item={i} kat={katMap[i.category_id]} onClick={setEdit} denganTanggal={false} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      {edit && (
        <Modal judul="Edit catatan" onClose={() => setEdit(null)}>
          <FormTransaksi kategori={kategori} awal={edit} onSaved={selesai} />
        </Modal>
      )}
    </>
  )
}
