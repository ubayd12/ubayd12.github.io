import { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartPie } from 'lucide-react'
import {
  rupiah, rupiahSingkat, pesanError, bulanIni, geserBulan, namaBulan, awalBulan, akhirBulan,
  ambilTransaksi, TANPA_KATEGORI,
} from './lib.js'
import { PilihBulan, IkonKat, Kosong } from './ui.jsx'
import Rekap from './Rekap.jsx'

const WARNA_MASUK = '#10b981'
const WARNA_KELUAR = '#f43f5e'
const gerak = typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function TooltipKustom({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const judul = payload[0]?.payload?.panjang || label
  return (
    <div className="chart-tooltip">
      {judul && <b>{judul}</b>}
      {payload.map(p => (
        <div key={p.dataKey ?? p.name}>
          <span className="titik" style={{ background: p.payload?.warna || p.color || p.fill }} />
          <span>{p.name}</span>
          <span className="num">{rupiah(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Statistik({ kategori, versi }) {
  const [bulan, setBulan] = useState(bulanIni())
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const katMap = useMemo(() => Object.fromEntries(kategori.map(k => [k.id, k])), [kategori])
  const bulan6 = useMemo(() => Array.from({ length: 6 }, (_, i) => geserBulan(bulan, i - 5)), [bulan])

  useEffect(() => {
    ambilTransaksi(awalBulan(bulan6[0]), akhirBulan(bulan))
      .then(list => { setItems(list); setError('') })
      .catch(e => setError(pesanError(e)))
      .finally(() => setLoading(false))
  }, [bulan6, bulan, versi])

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
        const kat = katMap[id] || TANPA_KATEGORI
        return { id, kat, nama: `${kat.ikon} ${kat.nama}`, warna: kat.warna, nilai }
      })
      .sort((a, b) => b.nilai - a.nilai)
  }, [items, bulan, katMap])
  const totalKeluar = perKategori.reduce((s, x) => s + x.nilai, 0)

  // Pemasukan vs pengeluaran 6 bulan
  const perBulan = useMemo(() => bulan6.map(b => {
    const isi = items.filter(t => t.date.slice(0, 7) === b)
    return {
      bulan: namaBulan(b, true),
      panjang: namaBulan(b),
      Pemasukan: isi.filter(t => t.type === 'pemasukan').reduce((s, t) => s + Number(t.amount), 0),
      Pengeluaran: isi.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + Number(t.amount), 0),
    }
  }), [items, bulan6])
  const total6Masuk = perBulan.reduce((s, x) => s + x.Pemasukan, 0)
  const total6Keluar = perBulan.reduce((s, x) => s + x.Pengeluaran, 0)

  return (
    <>
      <section className="card">
        <PilihBulan value={bulan} onChange={b => { setLoading(true); setBulan(b) }} />
      </section>
      {error && <p className="alert danger">{error}</p>}

      <div className="grid2 rata">
        <section className="card">
          <div className="kepala-kartu">
            <div>
              <h2>Pengeluaran per kategori</h2>
              <small className="muted">{namaBulan(bulan)}</small>
            </div>
          </div>
          {loading ? <div className="sk sk-donut" /> : perKategori.length === 0 ? (
            <Kosong ikon={<ChartPie size={28} />} judul="Belum ada pengeluaran" teks={`Tidak ada pengeluaran yang tercatat di ${namaBulan(bulan)}.`} />
          ) : (
            <>
              <div className="donut">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={perKategori} dataKey="nilai" nameKey="nama" innerRadius="68%" outerRadius="94%"
                      paddingAngle={perKategori.length > 1 ? 2 : 0} cornerRadius={6} stroke="none" isAnimationActive={gerak}>
                      {perKategori.map(x => <Cell key={x.id} fill={x.warna} />)}
                    </Pie>
                    <Tooltip content={<TooltipKustom />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-tengah">
                  <small>Total pengeluaran</small>
                  <b>{rupiah(totalKeluar)}</b>
                </div>
              </div>
              <ul className="legenda">
                {perKategori.map(x => {
                  const pct = Math.round(x.nilai / totalKeluar * 100)
                  return (
                    <li key={x.id}>
                      <IkonKat kat={x.kat} />
                      <div className="legenda-isi">
                        <div className="legenda-atas"><span className="nama">{x.kat.nama}</span><span className="num">{rupiah(x.nilai)}</span></div>
                        <div className="legenda-bawah">
                          <div className="legenda-bar"><span style={{ width: pct + '%', background: x.warna }} /></div>
                          <small>{pct}%</small>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>

        <section className="card">
          <div className="kepala-kartu">
            <div>
              <h2>Pemasukan vs pengeluaran</h2>
              <small className="muted">{namaBulan(bulan6[0])} – {namaBulan(bulan)}</small>
            </div>
          </div>
          <div className="chart-legenda">
            <span><i className="titik" style={{ background: WARNA_MASUK }} />Pemasukan</span>
            <span><i className="titik" style={{ background: WARNA_KELUAR }} />Pengeluaran</span>
          </div>
          {loading ? <div className="sk sk-batang" /> : (
            <div className="chart">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={perBulan} barGap={3} barCategoryGap="22%" margin={{ top: 8, right: 4, left: -4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e8eeeb" />
                  <XAxis dataKey="bulan" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#4b5d57' }} interval={0} tickMargin={8} />
                  <YAxis tickFormatter={rupiahSingkat} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6b7c76' }} width={44} />
                  <Tooltip content={<TooltipKustom />} cursor={{ fill: 'rgba(16,185,129,.08)' }} />
                  <Bar dataKey="Pemasukan" fill={WARNA_MASUK} radius={[6, 6, 2, 2]} maxBarSize={22} isAnimationActive={gerak} />
                  <Bar dataKey="Pengeluaran" fill={WARNA_KELUAR} radius={[6, 6, 2, 2]} maxBarSize={22} isAnimationActive={gerak} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mini-statistik">
            <div><small>Total pemasukan 6 bulan</small><b className="in">{rupiah(total6Masuk)}</b></div>
            <div><small>Total pengeluaran 6 bulan</small><b className="out">{rupiah(total6Keluar)}</b></div>
          </div>
        </section>
      </div>

      <Rekap versi={versi} />
    </>
  )
}
