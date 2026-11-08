import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { rupiah, today, tanggal, monthRange, formatInput, parseInput, pesanError } from './lib.js'

// Pilihan saringan: '' = semua, angka = selisih bulan dari bulan ini
const FILTERS = [
  { value: '0', label: 'Bulan ini' },
  { value: '-1', label: 'Bulan lalu' },
  { value: '1', label: 'Bulan depan' },
  ...Array.from({ length: 22 }, (_, i) => -(i + 2)).map(o => ({ value: String(o), label: monthRange(o).label })),
]

export default function Catatan({ premium, onSubscribe }) {
  const [all, setAll] = useState([])
  const [filtered, setFiltered] = useState(null)
  const [filter, setFilter] = useState('')
  const [budget, setBudget] = useState(0)
  const [type, setType] = useState('pengeluaran')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [error, setError] = useState('')

  async function loadAll() {
    const { data, error } = await supabase.from('transactions')
      .select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setAll(data)
  }

  async function loadFiltered(f = filter) {
    if (f === '' || !premium) { setFiltered(null); return }
    const { start, end } = monthRange(Number(f))
    const { data, error } = await supabase.rpc('transaksi_periode', { p_mulai: start, p_akhir: end })
    if (error) { setError(pesanError(error)); setFiltered(null) }
    else setFiltered(data)
  }

  useEffect(() => { loadAll() }, [])
  useEffect(() => { loadFiltered() }, [filter, premium])
  useEffect(() => {
    if (!premium) return
    supabase.from('user_settings').select('budget_bulanan').maybeSingle()
      .then(({ data }) => setBudget(Number(data?.budget_bulanan) || 0))
  }, [premium])

  async function add(e) {
    e.preventDefault()
    setError('')
    const value = parseInput(amount)
    if (!value) { setError('Isi jumlah lebih dari 0.'); return }
    const { error } = await supabase.from('transactions').insert({ type, amount: value, note: note.trim() || null, date })
    if (error) { setError(error.message); return }
    setAmount(''); setNote('')
    loadAll(); loadFiltered()
  }

  async function remove(id) {
    if (!confirm('Hapus catatan ini?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setAll(all.filter(i => i.id !== id))
    if (filtered) setFiltered(filtered.filter(i => i.id !== id))
  }

  const items = filtered ?? all
  const sum = (list, t) => list.filter(i => i.type === t).reduce((s, i) => s + Number(i.amount), 0)
  const masuk = sum(items, 'pemasukan')
  const keluar = sum(items, 'pengeluaran')

  // Notifikasi hemat: pengeluaran bulan ini vs budget bulanan
  const bulanIni = monthRange(0)
  const keluarBulanIni = sum(all.filter(i => i.date >= bulanIni.start && i.date <= bulanIni.end), 'pengeluaran')
  const persen = budget > 0 ? Math.round(keluarBulanIni / budget * 100) : 0

  return (
    <>
      {premium && budget > 0 && persen >= 100 && (
        <p className="alert danger">⚠️ Pengeluaran bulan ini sudah {persen}% dari budget ({rupiah(keluarBulanIni)} dari {rupiah(budget)}). Budget bulanan sudah habis — saatnya berhemat!</p>
      )}
      {premium && budget > 0 && persen >= 80 && persen < 100 && (
        <p className="alert warn">🔔 Pengeluaran bulan ini sudah {persen}% dari budget ({rupiah(keluarBulanIni)} dari {rupiah(budget)}). Sisa {rupiah(budget - keluarBulanIni)}.</p>
      )}

      <div className="filterbar">
        <label>Tampilkan
          {premium ? (
            <select value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">Semua catatan</option>
              {FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          ) : (
            <select disabled><option>Semua catatan</option></select>
          )}
        </label>
        {!premium && <button type="button" className="link" onClick={onSubscribe}>🔒 Saring per bulan (Premium)</button>}
      </div>

      <div className="summary">
        <div><small>Pemasukan</small><b className="in">{rupiah(masuk)}</b></div>
        <div><small>Pengeluaran</small><b className="out">{rupiah(keluar)}</b></div>
        <div><small>Saldo</small><b>{rupiah(masuk - keluar)}</b></div>
      </div>

      <div className="grid2">
        <form className="card" onSubmit={add}>
          <div className="toggle">
            <button type="button" className={type === 'pengeluaran' ? 'on' : ''} onClick={() => setType('pengeluaran')}>Pengeluaran</button>
            <button type="button" className={type === 'pemasukan' ? 'on' : ''} onClick={() => setType('pemasukan')}>Pemasukan</button>
          </div>
          <label>Jumlah (Rp)
            <input inputMode="numeric" value={amount} onChange={e => setAmount(formatInput(e.target.value))} />
          </label>
          <label>Catatan
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="mis. makan siang" />
          </label>
          <label>Tanggal
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button>Simpan</button>
        </form>

        <ul className="list">
          {items.length === 0 && <li className="empty">Belum ada catatan.</li>}
          {items.map(i => (
            <li key={i.id}>
              <div>
                <b className={i.type === 'pemasukan' ? 'in' : 'out'}>
                  {i.type === 'pemasukan' ? '+' : '−'}{rupiah(i.amount)}
                </b>
                <small>{tanggal(i.date)}{i.note ? ` · ${i.note}` : ''}</small>
              </div>
              <button className="link" onClick={() => remove(i.id)}>Hapus</button>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
