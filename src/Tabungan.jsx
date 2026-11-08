import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { rupiah, today, tanggal, formatInput, parseInput, pesanError } from './lib.js'
import Locked from './Locked.jsx'

export default function Tabungan({ premium, onSubscribe }) {
  const [items, setItems] = useState([])
  const [target, setTarget] = useState(0)
  const [targetInput, setTargetInput] = useState('')
  const [type, setType] = useState('setor')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function load() {
    const [s, t] = await Promise.all([
      supabase.from('savings').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('user_settings').select('target_tabungan').maybeSingle(),
    ])
    if (s.error) setError(pesanError(s.error)); else setItems(s.data)
    const tv = Number(t.data?.target_tabungan) || 0
    setTarget(tv); setTargetInput(tv ? formatInput(tv) : '')
  }
  useEffect(() => { if (premium) load() }, [premium])

  if (!premium) return <Locked title="Tabungan" onSubscribe={onSubscribe}>Catat setoran dan penarikan tabungan, lalu pantau progres menuju target tabunganmu dengan Premium.</Locked>

  const total = items.reduce((s, i) => s + (i.type === 'setor' ? 1 : -1) * Number(i.amount), 0)
  const pct = target > 0 ? Math.min(100, Math.max(0, Math.round(total / target * 100))) : 0

  async function add(e) {
    e.preventDefault()
    setError(''); setInfo('')
    const value = parseInput(amount)
    if (!value) { setError('Isi jumlah lebih dari 0.'); return }
    if (type === 'tarik' && value > total) { setError(`Penarikan melebihi total tabungan (${rupiah(total)}).`); return }
    const { error } = await supabase.from('savings').insert({ type, amount: value, note: note.trim() || null, date })
    if (error) { setError(pesanError(error)); return }
    setAmount(''); setNote('')
    load()
  }

  async function remove(id) {
    if (!confirm('Hapus catatan tabungan ini?')) return
    const { error } = await supabase.from('savings').delete().eq('id', id)
    if (error) setError(pesanError(error))
    else setItems(items.filter(i => i.id !== id))
  }

  async function saveTarget(e) {
    e.preventDefault()
    setError(''); setInfo('')
    const value = parseInput(targetInput)
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: u.user.id, target_tabungan: value || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) { setError(pesanError(error)); return }
    setTarget(value); setInfo('Target tabungan disimpan.')
  }

  return (
    <>
      <div className="summary two">
        <div><small>Total tabungan</small><b className="in">{rupiah(total)}</b></div>
        <div><small>Target</small><b>{target ? rupiah(target) : '–'}</b></div>
      </div>

      <form className="card" onSubmit={saveTarget}>
        <h2>Target tabungan</h2>
        {target > 0 && (
          <>
            <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><span style={{ width: pct + '%' }} /></div>
            <small className="muted">{pct}% tercapai{total < target ? ` · kurang ${rupiah(target - total)}` : ' · target tercapai 🎉'}</small>
          </>
        )}
        <div className="row">
          <input inputMode="numeric" placeholder="mis. 5.000.000" value={targetInput} onChange={e => setTargetInput(formatInput(e.target.value))} aria-label="Target tabungan (Rp)" />
          <button>Simpan target</button>
        </div>
        {info && <p className="ok">{info}</p>}
      </form>

      <div className="grid2">
        <form className="card" onSubmit={add}>
          <div className="toggle">
            <button type="button" className={type === 'setor' ? 'on' : ''} onClick={() => setType('setor')}>Setor</button>
            <button type="button" className={type === 'tarik' ? 'on' : ''} onClick={() => setType('tarik')}>Tarik</button>
          </div>
          <label>Jumlah (Rp)
            <input inputMode="numeric" value={amount} onChange={e => setAmount(formatInput(e.target.value))} />
          </label>
          <label>Catatan
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="mis. dana darurat" />
          </label>
          <label>Tanggal
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button>Simpan</button>
        </form>

        <ul className="list">
          {items.length === 0 && <li className="empty">Belum ada catatan tabungan.</li>}
          {items.map(i => (
            <li key={i.id}>
              <div>
                <b className={i.type === 'setor' ? 'in' : 'out'}>{i.type === 'setor' ? '+' : '−'}{rupiah(i.amount)}</b>
                <small>{i.type === 'setor' ? 'Setor' : 'Tarik'} · {tanggal(i.date)}{i.note ? ` · ${i.note}` : ''}</small>
              </div>
              <button className="link" onClick={() => remove(i.id)}>Hapus</button>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
