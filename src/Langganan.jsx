import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { PLANS, GOPAY, rupiah, waktu, planName } from './lib.js'

const STATUS = { menunggu: 'Menunggu konfirmasi admin', dikonfirmasi: 'Dikonfirmasi', ditolak: 'Ditolak' }
const VIA = ['GoPay', 'OVO', 'DANA', 'ShopeePay', 'BCA', 'BRI', 'BNI', 'Mandiri', 'BSI', 'SeaBank', 'Bank Jago']

export default function Langganan({ profile, premium, reloadProfile }) {
  const [requests, setRequests] = useState([])
  const [plan, setPlan] = useState(null)
  const [senderName, setSenderName] = useState('')
  const [senderVia, setSenderVia] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('subscription_requests').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setRequests(data)
  }
  useEffect(() => { load() }, [])

  const pending = requests.find(r => r.status === 'menunggu')
  const forever = premium && profile?.premium_plan === 'selamanya'
  const chosen = PLANS.find(p => p.id === plan)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!senderName.trim()) { setError('Nama pengirim wajib diisi.'); return }
    if (!senderVia.trim()) { setError('Transfer dari wajib diisi.'); return }
    setBusy(true)
    const { error } = await supabase.from('subscription_requests').insert({
      plan: chosen.id, amount: chosen.harga, sender_name: senderName.trim(), sender_via: senderVia.trim(),
    })
    setBusy(false)
    if (error) {
      setError(error.code === '23505' ? 'Kamu masih punya permintaan yang menunggu konfirmasi admin.' : error.message)
      load()
      return
    }
    setPlan(null); setSenderName(''); setSenderVia('')
    load()
  }

  async function refresh() { await Promise.all([reloadProfile(), load()]) }

  return (
    <>
      <div className="card">
        <h2>Status akun</h2>
        {premium ? (
          <p><span className="badge gold">Premium · {planName(profile.premium_plan)}</span>{' '}
            {forever ? 'aktif selamanya.' : `aktif sampai ${waktu(profile.premium_until)}.`}</p>
        ) : (
          <p><span className="badge">Gratis</span> Buka saringan bulan, rekap, tabungan, profil keuangan, notifikasi hemat, dan AI Eksklusif dengan Premium.</p>
        )}
        {pending && (
          <p className="alert warn">⏳ <b>Menunggu konfirmasi admin</b> — paket {planName(pending.plan)} ({rupiah(pending.amount)}), dikirim {waktu(pending.created_at)}. Premium aktif setelah dikonfirmasi admin.</p>
        )}
        <button type="button" className="secondary" onClick={refresh}>Cek status</button>
      </div>

      {!forever && !pending && (
        <div className="card">
          <h2>Pilih paket</h2>
          <div className="plans">
            {PLANS.map(p => (
              <button key={p.id} type="button" className={`plan ${plan === p.id ? 'on' : ''}`} onClick={() => { setPlan(p.id); setError('') }}>
                <b>{p.nama}</b>
                <span>{rupiah(p.harga)}</span>
                <small>{p.durasi}</small>
              </button>
            ))}
          </div>

          {chosen && (
            <form className="pay" onSubmit={submit}>
              <p className="paytext">Transfer {rupiah(chosen.harga)} ke GoPay {GOPAY}</p>
              <label>Nama pengirim
                <input value={senderName} maxLength={100} onChange={e => setSenderName(e.target.value)} placeholder="nama di akun pengirim" required />
              </label>
              <label>Transfer dari
                <input value={senderVia} maxLength={100} list="via-list" onChange={e => setSenderVia(e.target.value)} placeholder="GoPay / nama bank / lainnya" required />
                <datalist id="via-list">{VIA.map(v => <option key={v} value={v} />)}</datalist>
              </label>
              {error && <p className="error">{error}</p>}
              <button disabled={busy}>{busy ? 'Mengirim…' : 'Saya sudah bayar'}</button>
            </form>
          )}
        </div>
      )}

      {requests.length > 0 && (
        <div className="card">
          <h2>Riwayat permintaan</h2>
          <ul className="list plain">
            {requests.map(r => (
              <li key={r.id}>
                <div>
                  <b>{planName(r.plan)} · {rupiah(r.amount)}</b>
                  <small>{waktu(r.created_at)} · dari {r.sender_via} a.n. {r.sender_name}</small>
                </div>
                <span className={`status ${r.status}`}>{STATUS[r.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
