import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

const rupiah = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, zona waktu lokal

export default function Dashboard({ session }) {
  const [items, setItems] = useState([])
  const [type, setType] = useState('pengeluaran')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [error, setError] = useState('')
  const username = session.user.user_metadata?.username || ''

  async function load() {
    const { data, error } = await supabase.from('transactions')
      .select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setItems(data)
  }
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    setError('')
    const value = parseInt(amount.replace(/\D/g, ''), 10)
    if (!value) { setError('Isi jumlah lebih dari 0.'); return }
    const { error } = await supabase.from('transactions').insert({ type, amount: value, note: note.trim() || null, date })
    if (error) { setError(error.message); return }
    setAmount(''); setNote('')
    load()
  }

  async function remove(id) {
    if (!confirm('Hapus catatan ini?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) setError(error.message)
    else setItems(items.filter(i => i.id !== id))
  }

  const masuk = items.filter(i => i.type === 'pemasukan').reduce((s, i) => s + Number(i.amount), 0)
  const keluar = items.filter(i => i.type === 'pengeluaran').reduce((s, i) => s + Number(i.amount), 0)

  return (
    <>
      <div className="topbar">
        <span>Halo, <b>{username}</b></span>
        <button className="link" onClick={() => supabase.auth.signOut()}>Keluar</button>
      </div>

      <div className="summary">
        <div><small>Pemasukan</small><b className="in">{rupiah(masuk)}</b></div>
        <div><small>Pengeluaran</small><b className="out">{rupiah(keluar)}</b></div>
        <div><small>Saldo</small><b>{rupiah(masuk - keluar)}</b></div>
      </div>

      <form className="card" onSubmit={add}>
        <div className="toggle">
          <button type="button" className={type === 'pengeluaran' ? 'on' : ''} onClick={() => setType('pengeluaran')}>Pengeluaran</button>
          <button type="button" className={type === 'pemasukan' ? 'on' : ''} onClick={() => setType('pemasukan')}>Pemasukan</button>
        </div>
        <label>Jumlah (Rp)
          <input inputMode="numeric" value={amount}
            onChange={e => { const d = e.target.value.replace(/\D/g, ''); setAmount(d ? Number(d).toLocaleString('id-ID') : '') }} />
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
              <small>{i.date}{i.note ? ` · ${i.note}` : ''}</small>
            </div>
            <button className="link" onClick={() => remove(i.id)}>Hapus</button>
          </li>
        ))}
      </ul>
    </>
  )
}
