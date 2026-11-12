import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'

// Menu AI Eksklusif untuk semua pengguna. Kuota kata mingguan dibaca dari
// fungsi database ai_quota() (100.000 kata per minggu, admin tanpa batas).
// Server: Supabase Edge Function "ai" (Gemini jatah gratis).
const CONTOH = [
  'Enaknya makan siang apa hari ini?',
  'Berapa kira-kira ongkos Gojek 5 km di kotaku?',
  'Belanja kebutuhan mingguan apa saja yang hemat?',
]

function waktuReset(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export default function AI() {
  const [status, setStatus] = useState(null)
  const [chat, setChat] = useState([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  async function call(body) {
    const { data, error } = await supabase.functions.invoke('ai', { body })
    if (error) {
      // Pesan dari server (mis. kuota habis) ada di body respons
      let pesan = 'AI sedang tidak bisa dihubungi. Coba lagi nanti.'
      try {
        const j = await error.context.json()
        if (j?.error) pesan = j.error
      } catch { /* abaikan */ }
      throw new Error(pesan)
    }
    return data
  }

  // Sisa kuota dari ai_quota(): { tier, quota, used, period_key, resets_at }
  async function loadQuota() {
    const { data, error } = await supabase.rpc('ai_quota')
    if (error) { setError(error.message); return }
    setStatus(Array.isArray(data) ? data[0] : data)
  }

  useEffect(() => { loadQuota() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])

  async function ask(e, teks) {
    e?.preventDefault()
    const q = (teks ?? question).trim()
    if (!q || busy) return
    setError(''); setBusy(true); setQuestion('')
    setChat(c => [...c, { role: 'user', text: q }])
    try {
      const data = await call({ question: q })
      setChat(c => [...c, { role: 'ai', text: data.answer }])
    } catch (err) {
      setError(err.message)
      setChat(c => c.slice(0, -1))
      setQuestion(q)
    }
    setBusy(false)
    loadQuota()
  }

  const sisa = status && status.quota != null ? Math.max(0, status.quota - status.used) : null

  return (
    <div className="card ai">
      <div className="row between">
        <h2>✨ AI Eksklusif</h2>
      </div>
      {status && (
        <p className="muted">
          {sisa === null
            ? 'Kuota tanpa batas (admin).'
            : `Sisa kuota minggu ini: ${sisa.toLocaleString('id-ID')} dari ${status.quota.toLocaleString('id-ID')} kata.`}
          {status.resets_at && sisa !== null && ` Diisi ulang ${waktuReset(status.resets_at)}.`}
        </p>
      )}

      <div className="chat">
        {chat.length === 0 && (
          <div className="contoh">
            <p className="muted">Tanya soal makan, belanja, atau ongkos sesuai budget-mu. Contoh:</p>
            {CONTOH.map(c => <button type="button" key={c} className="secondary small" disabled={busy} onClick={() => ask(null, c)}>{c}</button>)}
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>{m.text}</div>
        ))}
        {busy && <div className="bubble ai muted">Sedang berpikir…</div>}
        <div ref={endRef} />
      </div>

      {error && <p className="error">{error}</p>}
      <form className="row" onSubmit={ask}>
        <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Tulis pertanyaan…" maxLength={2000} disabled={busy} />
        <button disabled={busy || !question.trim()}>Kirim</button>
      </form>
      <p className="muted small">Harga yang disebut AI adalah perkiraan, bukan harga pasti. Pertanyaan diproses oleh layanan AI Google (jatah gratis) dan dapat dipakai Google untuk meningkatkan produknya. Jangan menulis password atau data rekening.</p>
    </div>
  )
}
