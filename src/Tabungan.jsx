import { useEffect, useState } from 'react'
import { ArrowUpRight, PiggyBank, Trash2 } from 'lucide-react'
import { supabase } from './supabase.js'
import { rupiah, today, tanggal, formatInput, parseInput, pesanError } from './lib.js'
import { Toggle, InputUang, Skeleton, Kosong, Modal, Pas, useAngkaNaik, toast } from './ui.jsx'

const JENIS_TABUNGAN = [
  { value: 'setor', label: 'Setor', tone: 'in' },
  { value: 'tarik', label: 'Tarik', tone: 'out' },
]

// Cincin progres target tabungan
function Cincin({ pct }) {
  const r = 34
  const keliling = 2 * Math.PI * r
  return (
    <svg className="cincin" viewBox="0 0 80 80" width="88" height="88" aria-hidden="true">
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="8" />
      {pct > 0 && (
        <circle cx="40" cy="40" r={r} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={keliling} strokeDashoffset={keliling * (1 - pct / 100)} transform="rotate(-90 40 40)" />
      )}
      <text x="40" y="46" textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff">{pct}%</text>
    </svg>
  )
}

export default function Tabungan() {
  const [items, setItems] = useState([])
  const [target, setTarget] = useState(0)
  const [targetInput, setTargetInput] = useState('')
  const [type, setType] = useState('setor')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)

  async function load() {
    const [s, t] = await Promise.all([
      supabase.from('savings').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('user_settings').select('target_tabungan').maybeSingle(),
    ])
    if (s.error) setError(pesanError(s.error)); else setItems(s.data)
    const tv = Number(t.data?.target_tabungan) || 0
    setTarget(tv); setTargetInput(tv ? formatInput(tv) : '')
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const total = items.reduce((s, i) => s + (i.type === 'setor' ? 1 : -1) * Number(i.amount), 0)
  const totalTampil = useAngkaNaik(loading ? 0 : total)
  const pct = target > 0 ? Math.min(100, Math.max(0, Math.round(total / target * 100))) : 0

  async function add(e) {
    e.preventDefault()
    setError('')
    const value = parseInput(amount)
    if (!value) { setError('Isi jumlah lebih dari 0.'); return }
    if (type === 'tarik' && value > total) { setError(`Penarikan melebihi total tabungan (${rupiah(total)}).`); return }
    const { error } = await supabase.from('savings').insert({ type, amount: value, note: note.trim() || null, date })
    if (error) { setError(pesanError(error)); return }
    setAmount(''); setNote('')
    toast(type === 'setor' ? 'Setoran disimpan' : 'Penarikan disimpan')
    load()
  }

  async function remove(id) {
    if (!confirm('Hapus catatan tabungan ini?')) return
    const { error } = await supabase.from('savings').delete().eq('id', id)
    if (error) setError(pesanError(error))
    else { setItems(items.filter(i => i.id !== id)); setDetail(null); toast('Catatan tabungan dihapus') }
  }

  async function saveTarget(e) {
    e.preventDefault()
    setError('')
    const value = parseInput(targetInput)
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: u.user.id, target_tabungan: value || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) { setError(pesanError(error)); return }
    setTarget(value); toast('Target tabungan disimpan')
  }

  return (
    <>
      <section className="hero hero-tabungan">
        <div className="hero-baris">
          <div className="hero-kiri">
            <span className="hero-label"><PiggyBank size={16} /> Total tabungan</span>
            {loading ? <span className="sk sk-saldo" /> : <Pas as="div" className="hero-saldo">{rupiah(totalTampil)}</Pas>}
            {!loading && (
              <small className="hero-ket">
                {target > 0
                  ? (total < target ? `Target ${rupiah(target)} · kurang ${rupiah(target - total)}` : `Target ${rupiah(target)} tercapai 🎉`)
                  : 'Belum ada target tabungan'}
              </small>
            )}
          </div>
          {target > 0 && !loading && <Cincin pct={pct} />}
        </div>
      </section>

      {error && <p className="alert danger">{error}</p>}

      <div className="grid2">
        <div>
          <form className="card" onSubmit={add}>
            <h2>Catat tabungan</h2>
            <Toggle value={type} onChange={setType} options={JENIS_TABUNGAN} />
            <label><span className="label-teks">Jumlah</span>
              <InputUang besar value={amount} onChange={setAmount} placeholder="0" />
            </label>
            <label><span className="label-teks">Catatan <span className="opsional">(opsional)</span></span>
              <input value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="mis. dana darurat" />
            </label>
            <label><span className="label-teks">Tanggal</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </label>
            <button>Simpan</button>
          </form>

          <form className="card" onSubmit={saveTarget}>
            <div className="kepala-kartu">
              <div>
                <h2>Target tabungan</h2>
                <small className="muted">Kosongkan untuk menghapus target</small>
              </div>
            </div>
            {target > 0 && (
              <>
                <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><span style={{ width: pct + '%' }} /></div>
                <small className="muted">{pct}% tercapai{total < target ? ` · kurang ${rupiah(target - total)}` : ' · target tercapai 🎉'}</small>
              </>
            )}
            <div className="row">
              <InputUang placeholder="mis. 5.000.000" value={targetInput} onChange={setTargetInput} aria-label="Target tabungan (Rp)" />
              <button>Simpan</button>
            </div>
          </form>
        </div>

        <section className="card">
          <div className="kepala-kartu">
            <h2>Riwayat</h2>
            {!loading && <small className="muted">{items.length} catatan</small>}
          </div>
          {loading ? <Skeleton baris={4} /> : items.length === 0 ? (
            <Kosong ikon={<PiggyBank size={28} />} judul="Belum ada tabungan" teks="Mulai menabung sedikit demi sedikit. Setoran pertamamu akan tampil di sini." />
          ) : (
            <ul className="daftar">
              {items.map(i => (
                <li key={i.id}>
                  <button type="button" className="baris" title="Ketuk untuk detail" onClick={() => setDetail(i)}>
                    <span className={`ikon-kat ${i.type === 'setor' ? 'tint-hijau' : 'tint-merah'}`} aria-hidden="true">
                      {i.type === 'setor' ? <PiggyBank size={20} /> : <ArrowUpRight size={20} />}
                    </span>
                    <span className="baris-teks">
                      <b>{i.type === 'setor' ? 'Setor' : 'Tarik'}</b>
                      <small>{tanggal(i.date)}{i.note ? ` · ${i.note}` : ''}</small>
                    </span>
                    <span className={`baris-jumlah ${i.type === 'setor' ? 'in' : 'out'}`}>{i.type === 'setor' ? '+' : '−'}{rupiah(i.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {detail && (
        <Modal judul={detail.type === 'setor' ? 'Detail setoran' : 'Detail penarikan'} onClose={() => setDetail(null)}>
          <dl className="detail">
            <div><dt>Jumlah</dt><dd className={detail.type === 'setor' ? 'in' : 'out'}>{detail.type === 'setor' ? '+' : '−'}{rupiah(detail.amount)}</dd></div>
            <div><dt>Tanggal</dt><dd>{tanggal(detail.date)}</dd></div>
            <div><dt>Catatan</dt><dd>{detail.note || '–'}</dd></div>
          </dl>
          <button type="button" className="bahaya-outline" onClick={() => remove(detail.id)}><Trash2 size={18} /> Hapus catatan tabungan</button>
        </Modal>
      )}
    </>
  )
}
