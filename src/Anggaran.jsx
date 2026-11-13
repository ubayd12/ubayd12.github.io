import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'
import {
  rupiah, formatInput, parseInput, pesanError, bulanIni, geserBulan, namaBulan, awalBulan, akhirBulan,
  ambilTransaksi,
} from './lib.js'
import { PilihBulan, Modal, Chip, Progres, PeringatanHemat } from './ui.jsx'

function FormAnggaran({ kat, bulan, ada, onSaved }) {
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
    if (error) setError(pesanError(error)); else onSaved()
  }

  async function hapus() {
    if (!confirm(`Hapus anggaran ${kat.nama} untuk ${namaBulan(bulan)}?`)) return
    setBusy(true)
    const { error } = await supabase.from('budgets').delete().eq('id', ada.id)
    setBusy(false)
    if (error) setError(pesanError(error)); else onSaved()
  }

  return (
    <form className="stack" onSubmit={simpan}>
      <p><Chip kat={kat} /> · {namaBulan(bulan)}</p>
      <label>Batas (Rp)
        <input inputMode="numeric" autoFocus value={batas} onChange={e => setBatas(formatInput(e.target.value))} placeholder="mis. 1.500.000" />
      </label>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>Simpan</button>
      {ada && <button type="button" className="secondary danger-text" disabled={busy} onClick={hapus}>Hapus anggaran</button>}
    </form>
  )
}

export default function Anggaran({ kategori }) {
  const [bulan, setBulan] = useState(bulanIni())
  const [budgets, setBudgets] = useState([])
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [atur, setAtur] = useState(null)
  const [busy, setBusy] = useState(false)

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
  }
  useEffect(() => { setInfo(''); load() }, [bulan])

  const pakai = id => items.filter(t => t.type === 'pengeluaran' && t.category_id === id).reduce((s, t) => s + Number(t.amount), 0)
  const budgetMap = Object.fromEntries(budgets.map(b => [b.category_id, b]))
  const dengan = katKeluar.filter(k => budgetMap[k.id]).map(k => {
    const p = pakai(k.id), batas = Number(budgetMap[k.id].batas)
    return { kat: k, b: budgetMap[k.id], pakai: p, pct: Math.round(p / batas * 100) }
  })
  const tanpa = katKeluar.filter(k => !budgetMap[k.id])
  const totalBatas = dengan.reduce((s, x) => s + Number(x.b.batas), 0)
  const totalPakai = dengan.reduce((s, x) => s + x.pakai, 0)
  const totalPct = totalBatas ? Math.round(totalPakai / totalBatas * 100) : 0

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
    setInfo(`${baru.length} anggaran disalin dari ${namaBulan(lalu)}.`)
    load()
  }

  return (
    <>
      <PeringatanHemat />
      <div className="card">
        <PilihBulan value={bulan} onChange={setBulan} />
        {dengan.length > 0 && (
          <>
            <div className="row between nowrap"><small>Total terpakai</small><small className="muted">{totalPct}%</small></div>
            <Progres pct={totalPct} />
            <small className="muted">{rupiah(totalPakai)} dari {rupiah(totalBatas)}</small>
          </>
        )}
        <button className="secondary" disabled={busy} onClick={salin}>Salin dari bulan lalu</button>
        {info && <p className="ok">{info}</p>}
      </div>
      {error && <p className="alert danger">{error}</p>}

      <div className="card">
        <h2>Anggaran per kategori</h2>
        {dengan.length === 0 && <p className="muted">Belum ada anggaran untuk {namaBulan(bulan)}. Pilih kategori di bawah untuk mengatur batas.</p>}
        {dengan.map(x => (
          <button key={x.kat.id} type="button" className="anggaran-item tombol" onClick={() => setAtur(x.kat)}>
            <span className="row between nowrap"><Chip kat={x.kat} /><small className="muted">{x.pct}%</small></span>
            <Progres pct={x.pct} />
            <small className="muted">
              {rupiah(x.pakai)} dari {rupiah(x.b.batas)} · {x.pakai > Number(x.b.batas) ? `lebih ${rupiah(x.pakai - x.b.batas)}` : `sisa ${rupiah(x.b.batas - x.pakai)}`}
            </small>
          </button>
        ))}
      </div>

      {tanpa.length > 0 && (
        <div className="card">
          <h2>Belum ada anggaran</h2>
          <ul className="list plain">
            {tanpa.map(k => (
              <li key={k.id}>
                <div className="isi"><Chip kat={k} /><small>Terpakai {rupiah(pakai(k.id))}</small></div>
                <button className="small secondary" onClick={() => setAtur(k)}>Atur</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {atur && (
        <Modal judul="Atur anggaran" onClose={() => setAtur(null)}>
          <FormAnggaran kat={atur} bulan={bulan} ada={budgetMap[atur.id]} onSaved={() => { setAtur(null); load() }} />
        </Modal>
      )}
    </>
  )
}
