import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { rupiah, waktu, planName } from './lib.js'

const STATUS = { menunggu: 'Menunggu', dikonfirmasi: 'Diterima', ditolak: 'Ditolak' }

// Sisa masa aktif dalam bahasa sederhana: "sisa 5 jam", "sisa 3 hari", dst.
function sisaMasaAktif(u) {
  if (u.premium_plan === 'selamanya') return 'Selamanya'
  if (!u.premium_until) return '–'
  const ms = new Date(u.premium_until) - new Date()
  if (ms <= 0) return '–'
  const jam = ms / 3600000
  if (jam < 1) return 'kurang dari 1 jam'
  if (jam < 24) return `sisa ${Math.floor(jam)} jam`
  const hari = Math.floor(jam / 24)
  if (hari < 30) return `sisa ${hari} hari`
  if (hari < 365) return `sisa ${Math.floor(hari / 30)} bulan`
  return `sisa ${Math.floor(hari / 365)} tahun`
}

function statusUser(u) {
  if (u.role === 'admin') return 'Admin'
  return u.premium_aktif ? 'Premium' : 'Gratis'
}

// Admin hanya melihat data akun & langganan, tidak ada transaksi/tabungan/profil keuangan.
export default function Admin({ myId }) {
  const [users, setUsers] = useState([])
  const [requests, setRequests] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [menu, setMenu] = useState('pembayaran')
  const [cari, setCari] = useState('')
  const [saring, setSaring] = useState('semua')

  async function load() {
    setError('')
    const [u, r] = await Promise.all([supabase.rpc('admin_list_users'), supabase.rpc('admin_list_requests')])
    if (u.error || r.error) setError((u.error || r.error).message)
    setUsers(u.data || [])
    setRequests(r.data || [])
  }
  useEffect(() => { load() }, [])

  async function decide(req, setuju) {
    const teks = setuju
      ? `Terima pembayaran ${req.username} untuk paket ${planName(req.plan)} (${rupiah(req.amount)})? Premium akan langsung aktif.`
      : `Tolak permintaan ${req.username} untuk paket ${planName(req.plan)}?`
    if (!confirm(teks)) return
    setBusy(req.id)
    const { error } = await supabase.rpc('admin_decide_request', { p_id: req.id, p_setuju: setuju })
    setBusy(null)
    if (error) setError(error.message)
    load()
  }

  async function ban(user) {
    if (!confirm(`Ban ${user.username}? Akun beserta SELURUH datanya (catatan, tabungan, profil, langganan) akan dihapus permanen.`)) return
    if (prompt(`Ketik username "${user.username}" untuk konfirmasi:`) !== user.username) return
    setBusy(user.id)
    const { error } = await supabase.rpc('admin_ban_user', { p_id: user.id })
    setBusy(null)
    if (error) setError(error.message)
    load()
  }

  const premiumAktif = users.filter(u => u.role !== 'admin' && u.premium_aktif).length
  const menunggu = requests.filter(r => r.status === 'menunggu').length

  // Yang menunggu selalu paling atas, lalu yang terbaru.
  const daftarRequest = [...requests].sort((a, b) =>
    (b.status === 'menunggu') - (a.status === 'menunggu') || new Date(b.created_at) - new Date(a.created_at))

  const kata = cari.trim().toLowerCase()
  const daftarUser = users.filter(u => {
    if (kata && !(u.username || '').toLowerCase().includes(kata)) return false
    if (saring === 'gratis') return statusUser(u) === 'Gratis'
    if (saring === 'premium') return statusUser(u) === 'Premium'
    return true
  })

  return (
    <>
      <div className="summary">
        <div><small>Jumlah pengguna</small><b>{users.length}</b></div>
        <div><small>Premium aktif</small><b className="in">{premiumAktif}</b></div>
        <div><small>Menunggu konfirmasi</small><b className="out">{menunggu}</b></div>
      </div>

      <div className="tabs">
        <button className={menu === 'pembayaran' ? 'on' : ''} onClick={() => setMenu('pembayaran')}>
          Konfirmasi Pembayaran{menunggu > 0 ? ` (${menunggu})` : ''}
        </button>
        <button className={menu === 'user' ? 'on' : ''} onClick={() => setMenu('user')}>Pengawasan User</button>
      </div>

      {error && <p className="alert danger">{error}</p>}

      {menu === 'pembayaran' && (
        <div className="card">
          <div className="row between"><h2>Konfirmasi Pembayaran</h2><button className="secondary" onClick={load}>Muat ulang</button></div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Username</th><th>Paket</th><th className="num">Nominal</th><th>Nama pengirim</th><th>Transfer dari</th><th>Waktu</th><th>Status / Aksi</th></tr></thead>
              <tbody>
                {daftarRequest.length === 0 && <tr><td colSpan="7" className="muted">Belum ada permintaan.</td></tr>}
                {daftarRequest.map(r => (
                  <tr key={r.id}>
                    <td>{r.username || '–'}</td>
                    <td>{planName(r.plan)}</td>
                    <td className="num">{rupiah(r.amount)}</td>
                    <td>{r.sender_name}</td>
                    <td>{r.sender_via}</td>
                    <td>{waktu(r.created_at)}</td>
                    <td>
                      {r.status === 'menunggu' ? (
                        <div className="actions">
                          <button className="small" disabled={busy === r.id} onClick={() => decide(r, true)}>Diterima</button>
                          <button className="small danger" disabled={busy === r.id} onClick={() => decide(r, false)}>Ditolak</button>
                        </div>
                      ) : <span className={`status ${r.status}`}>{STATUS[r.status] || r.status}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {menu === 'user' && (
        <div className="card">
          <div className="row between"><h2>Pengawasan User</h2><button className="secondary" onClick={load}>Muat ulang</button></div>
          <div className="filterbar">
            <label>Cari username
              <input type="search" value={cari} onChange={e => setCari(e.target.value)} placeholder="Ketik username…" />
            </label>
            <label>Status
              <select value={saring} onChange={e => setSaring(e.target.value)}>
                <option value="semua">Semua</option>
                <option value="gratis">Gratis</option>
                <option value="premium">Premium</option>
              </select>
            </label>
          </div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Username</th><th>Status</th><th>Paket</th><th>Sisa masa aktif</th><th>Tanggal daftar</th><th>Aksi</th></tr></thead>
              <tbody>
                {daftarUser.length === 0 && <tr><td colSpan="6" className="muted">Tidak ada pengguna yang cocok.</td></tr>}
                {daftarUser.map(u => {
                  const status = statusUser(u)
                  const isAdmin = status === 'Admin'
                  const gratis = status === 'Gratis'
                  return (
                    <tr key={u.id}>
                      <td>{u.username}{u.id === myId ? ' (kamu)' : ''}</td>
                      <td><span className={`badge ${gratis ? '' : 'gold'}`}>{status}</span></td>
                      <td>{!gratis && u.premium_plan ? planName(u.premium_plan) : '–'}</td>
                      <td>{gratis ? '–' : sisaMasaAktif(u)}</td>
                      <td>{waktu(u.created_at)}</td>
                      <td>{isAdmin ? '' : <button className="small danger" disabled={busy === u.id} onClick={() => ban(u)}>Ban</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
