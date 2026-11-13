import { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import {
  rupiah, rupiahSingkat, pesanError, bulanIni, geserBulan, namaBulan, awalBulan, akhirBulan,
  ambilTransaksi, TANPA_KATEGORI,
} from './lib.js'
import { PilihBulan } from './ui.jsx'
import Rekap from './Rekap.jsx'

const fmtTooltip = v => rupiah(v)

export default function Statistik({ kategori }) {
  const [bulan, setBulan] = useState(bulanIni())
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const katMap = useMemo(() => Object.fromEntries(kategori.map(k => [k.id, k])), [kategori])
  const bulan6 = useMemo(() => Array.from({ length: 6 }, (_, i) => geserBulan(bulan, i - 5)), [bulan])

  useEffect(() => {
    setLoading(true)
    ambilTransaksi(awalBulan(bulan6[0]), akhirBulan(bulan))
      .then(list => { setItems(list); setError('') })
      .catch(e => setError(pesanError(e)))
      .finally(() => setLoading(false))
  }, [bulan6, bulan])

  // Pengeluaran per kategori bulan terpilih
  const perKategori = useMemo(() => {
    const total = {}
    for (const t of items) {
      if (t.type !== 'pengeluaran' || t.date.slice(0, 7) !== bulan) continue
      const k = katMap[t.category_id] ? t.category_id : 'none'
      total[k] = (total[k] || 0) + Number(t.amount)
    }
    return Object.entries(total)
      .map(([id, nilai]) => {
        const k = katMap[id] || TANPA_KATEGORI
        return { id, nama: `${k.ikon} ${k.nama}`, warna: k.warna, nilai }
      })
      .sort((a, b) => b.nilai - a.nilai)
  }, [items, bulan, katMap])
  const totalKeluar = perKategori.reduce((s, x) => s + x.nilai, 0)

  // Pemasukan vs pengeluaran 6 bulan
  const perBulan = useMemo(() => bulan6.map(b => {
    const isi = items.filter(t => t.date.slice(0, 7) === b)
    return {
      bulan: namaBulan(b, true),
      Pemasukan: isi.filter(t => t.type === 'pemasukan').reduce((s, t) => s + Number(t.amount), 0),
      Pengeluaran: isi.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + Number(t.amount), 0),
    }
  }), [items, bulan6])

  return (
    <>
      <div className="card">
        <PilihBulan value={bulan} onChange={setBulan} />
      </div>
      {error && <p className="alert danger">{error}</p>}

      <div className="grid2 rata">
        <div className="card">
          <h2>Pengeluaran per kategori</h2>
          <small className="muted">{namaBulan(bulan)} · total {rupiah(totalKeluar)}</small>
          {loading ? <p>Memuat…</p> : perKategori.length === 0 ? <p className="muted">Belum ada pengeluaran bulan ini.</p> : (
            <>
              <div className="chart">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={perKategori} dataKey="nilai" nameKey="nama" innerRadius="45%" outerRadius="80%" paddingAngle={1} isAnimationActive={false}>
                      {perKategori.map(x => <Cell key={x.id} fill={x.warna} />)}
                    </Pie>
                    <Tooltip formatter={fmtTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="legenda">
                {perKategori.map(x => (
                  <li key={x.id}>
                    <span className="titik" style={{ background: x.warna }} />
                    <span className="nama">{x.nama}</span>
                    <span className="num">{rupiah(x.nilai)} <small className="muted">{Math.round(x.nilai / totalKeluar * 100)}%</small></span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="card">
          <h2>Pemasukan vs pengeluaran</h2>
          <small className="muted">6 bulan: {namaBulan(bulan6[0])} – {namaBulan(bulan)}</small>
          {loading ? <p>Memuat…</p> : (
            <div className="chart">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={perBulan} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bulan" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis tickFormatter={rupiahSingkat} tick={{ fontSize: 11 }} width={48} />
                  <Tooltip formatter={fmtTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Pemasukan" fill="#1f7a4d" isAnimationActive={false} />
                  <Bar dataKey="Pengeluaran" fill="#b42318" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <Rekap />
    </>
  )
}
