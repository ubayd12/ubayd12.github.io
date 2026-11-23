import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { UserRound } from 'lucide-react'
import { formatInput, parseInput, pesanError } from './lib.js'
import { InputUang, toast } from './ui.jsx'

export default function ProfilKeuangan() {
  const [pekerjaan, setPekerjaan] = useState('')
  const [gaji, setGaji] = useState('')
  const [budget, setBudget] = useState('')
  const [umur, setUmur] = useState('')
  const [kota, setKota] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('user_settings').select('*').maybeSingle().then(({ data, error }) => {
      if (error) { setError(pesanError(error)); return }
      if (!data) return
      setPekerjaan(data.pekerjaan || '')
      setGaji(data.gaji != null ? formatInput(data.gaji) : '')
      setBudget(data.budget_bulanan != null ? formatInput(data.budget_bulanan) : '')
      setUmur(data.umur != null ? String(data.umur) : '')
      setKota(data.kota || '')
    })
  }, [])

  async function save(e) {
    e.preventDefault()
    setError(''); setInfo('')
    const u = umur.trim() === '' ? null : parseInt(umur, 10)
    if (u !== null && (!Number.isInteger(u) || u < 1 || u > 150)) { setError('Umur harus angka 1–150, atau kosongkan.'); return }
    setBusy(true)
    const { data: au } = await supabase.auth.getUser()
    const { error } = await supabase.from('user_settings').upsert({
      user_id: au.user.id,
      pekerjaan: pekerjaan.trim() || null,
      gaji: gaji ? parseInput(gaji) : null,
      budget_bulanan: budget ? parseInput(budget) : null,
      umur: u,
      kota: kota.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setBusy(false)
    if (error) setError(pesanError(error))
    else { setInfo('Profil keuangan disimpan.'); toast('Profil keuangan disimpan') }
  }

  return (
    <form className="card" onSubmit={save}>
      <div className="kartu-ikon">
        <span className="menu-ikon tint-teal"><UserRound size={22} /></span>
        <div>
          <h2>Data keuanganmu</h2>
          <small className="muted">Dipakai untuk peringatan hemat. Semua kolom boleh dikosongkan.</small>
        </div>
      </div>
      <label><span className="label-teks">Pekerjaan</span>
        <input value={pekerjaan} maxLength={100} onChange={e => setPekerjaan(e.target.value)} placeholder="mis. karyawan swasta" />
      </label>
      <label><span className="label-teks">Gaji per bulan</span>
        <InputUang value={gaji} onChange={setGaji} placeholder="0" />
      </label>
      <label><span className="label-teks">Budget bulanan</span>
        <InputUang value={budget} onChange={setBudget} placeholder="0" />
        <small className="muted">Kamu akan diperingatkan saat pengeluaran bulan ini mencapai 80% dan 100% dari budget.</small>
      </label>
      <label><span className="label-teks">Kota</span>
        <input value={kota} maxLength={60} onChange={e => setKota(e.target.value)} placeholder="mis. Surabaya" />
        <small className="muted">Kota tempat tinggalmu (opsional).</small>
      </label>
      <label><span className="label-teks">Umur <span className="opsional">(opsional)</span></span>
        <input inputMode="numeric" value={umur} onChange={e => setUmur(e.target.value.replace(/\D/g, '').slice(0, 3))} />
      </label>
      {error && <p className="error">{error}</p>}
      {info && <p className="ok">{info}</p>}
      <button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
    </form>
  )
}
