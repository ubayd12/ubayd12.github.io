import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { rupiah, ymd, parseYmd, monthRange, pesanError } from './lib.js'

const MODES = [
  { id: 'day', label: 'Harian', ket: 'Bulan ini' },
  { id: 'week', label: 'Mingguan', ket: '12 minggu terakhir' },
  { id: 'month', label: 'Bulanan', ket: '12 bulan terakhir' },
  { id: 'year', label: 'Tahunan', ket: 'Semua tahun' },
]

function range(mode) {
  const now = new Date()
  if (mode === 'day') { const r = monthRange(0); return [r.start, r.end] }
  if (mode === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 83)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)) // mundur ke hari Senin
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6 - ((now.getDay() + 6) % 7))
    return [ymd(start), ymd(end)]
  }
  if (mode === 'month') return [monthRange(-11).start, monthRange(0).end]
  return ['1900-01-01', '2999-12-31']
}

function label(mode, s) {
  const d = parseYmd(s)
  if (mode === 'day') return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
  if (mode === 'week') {
    const e = new Date(d); e.setDate(e.getDate() + 6)
    return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  if (mode === 'month') return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  return String(d.getFullYear())
}

export default function Rekap() {
  const [mode, setMode] = useState('day')
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const [mulai, akhir] = range(mode)
    setLoading(true); setError('')
    supabase.rpc('rekap_transaksi', { p_mulai: mulai, p_akhir: akhir, p_satuan: mode }).then(({ data, error }) => {
      setLoading(false)
      if (error) { setError(pesanError(error)); setRows([]) }
      else setRows(data)
    })
  }, [mode])

  const tIn = rows.reduce((s, r) => s + Number(r.pemasukan), 0)
  const tOut = rows.reduce((s, r) => s + Number(r.pengeluaran), 0)

  return (
    <div className="card">
      <div className="toggle four">
        {MODES.map(m => <button key={m.id} type="button" className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>{m.label}</button>)}
      </div>
      <small className="muted">{MODES.find(m => m.id === mode).ket}</small>
      {error && <p className="error">{error}</p>}
      {loading ? <p>Memuat…</p> : (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Periode</th><th className="num">Pemasukan</th><th className="num">Pengeluaran</th><th className="num">Selisih</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan="4" className="muted">Belum ada catatan pada periode ini.</td></tr>}
              {rows.map(r => (
                <tr key={r.periode}>
                  <td>{label(mode, r.periode)}</td>
                  <td className="num in">{rupiah(r.pemasukan)}</td>
                  <td className="num out">{rupiah(r.pengeluaran)}</td>
                  <td className="num">{rupiah(r.pemasukan - r.pengeluaran)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot><tr><th>Total</th><th className="num in">{rupiah(tIn)}</th><th className="num out">{rupiah(tOut)}</th><th className="num">{rupiah(tIn - tOut)}</th></tr></tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
