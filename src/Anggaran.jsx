import { useEffect, useMemo, useState } from 'react'
import { Copy, Target, Trash2 } from 'lucide-react'
import { supabase } from './supabase.js'
import {
  rupiah, formatInput, parseInput, pesanError, bulanIni, geserBulan, namaBulan, awalBulan, akhirBulan,
  ambilTransaksi, persen,
} from './lib.js'
import {
  PilihBulan, Modal, IkonKat, Progres, StatusAnggaran, PeringatanHemat, InputUang, Skeleton, Kosong, Pas, toast,
} from './ui.jsx'

function FormAnggaran({ kat, bulan, ada, terpakai, onSaved }) {
  const [batas, setBatas] = useState(ada ? formatInput(ada.batas) : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function simpan(e) {
    e.preventDefault()
    const v = parseInput(batas)
    if (!v) { setError('Isi batas lebih dari 0.'); return }
    setBusy(true); setError('')
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase.from('budgets').upsert(
      { user_id: u.user.id, category_id: kat.id, bulan: awalBulan(bulan), batas: v, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,category_id,bulan' },
    )
    setBusy(false)
    if (error) setError(pesanError(error)); else onSaved('simpan')
  }

  async function hapus() {
    if (!confirm(`Hapus anggaran ${kat.nama} untuk ${namaBulan(bulan)}?`)) return
    setBusy(true)
    const { error } = await supabase.from('budgets').delete().eq('id', ada.id)
    setBusy(false)
    if (error) setError(pesanError(error)); else onSaved('hapus')
  }

  return (
    <form className="stack" onSubmit={simpan}>
      <div className="modal-info">
        <IkonKat kat={kat} besar />
        <div>
          <b>{kat.nama}</b>
          <small>{namaBulan(bulan)} · terpakai {rupiah(terpakai)}</small>
        </div>
      </div>
      <label><span className="label-teks">Batas bulan ini</span>
        <InputUang besar autoFocus value={batas} onChange={setBatas} placeholder="0" />
      </label>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan anggaran'}</button>
      {ada && <button type="button" className="bahaya-outline" disabled={busy} onClick={hapus}><Trash2 size={18} /> Hapus anggaran</button>}
    </form>
  )
}

export default function Anggaran({ kategori, versi }) {
  const [bulan, setBulan] = useState(bulanIni())
  const [budgets, setBudgets] = useState([])
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [atur, setAtur] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const katKeluar = useMemo(() => kategori.filter(k => k.jenis === 'pengeluaran'), [kategori])

  async function load() {
    try {
      const [b, list] = await Promise.all([
        supabase.from('budgets').select('id, category_id, batas').eq('bulan', awalBulan(bulan)),
        ambilTransaksi(awalBulan(bulan), akhirBulan(bulan)),
      ])
      if (b.error) throw b.error
      setBudgets(b.data); setItems(list); setError('')
    } catch (e) { setError(pesanError(e)) }
    setLoading(false)
  }
  useEffect(() => { setInfo(''); setLoading(true) }, [bulan])
  useEffect(() => { load() }, [bulan, versi])

  const pakai = id => items.filter(t => t.type === 'pengeluaran' && t.category_id === id).reduce((s, t) => s + Number(t.amount), 0)
  const budgetMap = Object.fromEntries(budgets.map(b => [b.category_id, b]))
  const dengan = katKeluar.filter(k => budgetMap[k.id]).map(k => {
    const p = pakai(k.id)
    return { kat: k, b: budgetMap[k.id], pakai: p, pct: persen(p, budgetMap[k.id].batas) }
  }).sort((a, b) => b.pct - a.pct)
  const tanpa = katKeluar.filter(k => !budgetMap[k.id])
  const totalBatas = dengan.reduce((s, x) => s + Number(x.b.batas), 0)
  const totalPakai = dengan.reduce((s, x) => s + x.pakai, 0)
  const totalPct = persen(totalPakai, totalBatas)

  async function salin() {
    setError(''); setInfo(''); setBusy(true)
    const lalu = geserBulan(bulan, -1)
    const { data, error } = await supabase.from('budgets').select('category_id, batas').eq('bulan', awalBulan(lalu))
    if (error) { setBusy(false); setError(pesanError(error)); return }
    const baru = data.filter(b => !budgetMap[b.category_id] && katKeluar.some(k => k.id === b.category_id))
    if (data.length === 0) { setBusy(false); setInfo(`Tidak ada anggaran di ${namaBulan(lalu)}.`); return }
    if (baru.length === 0) { setBusy(false); setInfo('Semua anggaran bulan lalu sudah ada di bulan ini.'); return }
    const { data: u } = await supabase.auth.getUser()
    const { error: e2 } = await supabase.from('budgets').upsert(
      baru.map(b => ({ user_id: u.user.id, category_id: b.category_id, bulan: awalBulan(bulan), batas: b.batas })),
      { onConflict: 'user_id,category_id,bulan', ignoreDuplicates: true },
    )
    setBusy(false)
    if (e2) { setError(pesanError(e2)); return }
    toast(`${baru.length} anggaran disalin dari ${namaBulan(lalu)}`)
    load()
  }

  function selesai(aksi) {
    setAtur(null)
    load()
    toast(aksi === 'hapus' ? 'Anggaran dihapus' : 'Anggaran disimpan')
  }

  const sisaTotal = totalBatas - totalPakai

  return (
    <>
      <PeringatanHemat versi={versi} />

      <section className="card">
        <PilihBulan value={bulan} onChange={setBulan} />
        {!loading && dengan.length > 0 && (
          <div className="anggaran-total">
            <div className="anggaran-atas">
              <span>
                <small className="muted">Total terpakai</small>
                <Pas as="b" className="angka-besar">{rupiah(totalPakai)}</Pas>
              </span>
              <StatusAnggaran pct={totalPct} />
            </div>
            <Progres pct={totalPct} />
            <small className="muted">
              dari total batas {rupiah(totalBatas)} · {sisaTotal >= 0 ? `sisa ${rupiah(sisaTotal)}` : `lebih ${rupiah(-sisaTotal)}`}
            </small>
          </div>
        )}
        <button type="button" className="secondary" disabled={busy} onClick={salin}><Copy size={16} /> Salin dari bulan lalu</button>
        {info && <p className="ok">{info}</p>}
      </section>

      {error && <p className="alert danger">{error}</p>}

      <section className="card">
        <div className="kepala-kartu">
          <div>
            <h2>Anggaran per kategori</h2>
            <small className="muted">Ketuk untuk mengubah batas</small>
          </div>
        </div>
        {loading ? <Skeleton baris={3} /> : dengan.length === 0 ? (
          <Kosong ikon={<Target size={28} />} judul="Belum ada anggaran"
            teks={`Atur batas belanja ${namaBulan(bulan)} dari daftar kategori di bawah, atau salin dari bulan lalu.`} />
        ) : (
          <ul className="daftar-anggaran">
            {dengan.map(x => {
              const sisa = Number(x.b.batas) - x.pakai
              return (
                <li key={x.kat.id}>
                  <button type="button" className="anggaran-baris" onClick={() => setAtur(x.kat)}>
                    <IkonKat kat={x.kat} />
                    <span className="anggaran-isi">
                      <span className="anggaran-atas"><b>{x.kat.nama}</b><StatusAnggaran pct={x.pct} /></span>
                      <Progres pct={x.pct} />
                      <small>{rupiah(x.pakai)} dari {rupiah(x.b.batas)} · {sisa >= 0 ? `sisa ${rupiah(sisa)}` : `lebih ${rupiah(-sisa)}`}</small>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {!loading && tanpa.length > 0 && (
        <section className="card">
          <div className="kepala-kartu">
            <div>
              <h2>Belum ada anggaran</h2>
              <small className="muted">Kategori pengeluaran tanpa batas di {namaBulan(bulan)}</small>
            </div>
          </div>
          <ul className="daftar">
            {tanpa.map(k => (
              <li key={k.id}>
                <div className="baris">
                  <IkonKat kat={k} />
                  <span className="baris-teks"><b>{k.nama}</b><small>Terpakai {rupiah(pakai(k.id))}</small></span>
                  <button type="button" className="kecil secondary" onClick={() => setAtur(k)}>Atur</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {atur && (
        <Modal judul="Atur anggaran" onClose={() => setAtur(null)}>
          <FormAnggaran kat={atur} bulan={bulan} ada={budgetMap[atur.id]} terpakai={pakai(atur.id)} onSaved={selesai} />
        </Modal>
      )}
    </>
  )
}
