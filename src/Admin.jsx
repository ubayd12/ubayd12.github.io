import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { rupiah, waktu, planName } from './lib.js'

const STATUS = { menunggu: 'Menunggu', dikonfirmasi: 'Dikonfirmasi', ditolak: 'Ditolak' }

// Admin hanya melihat data akun & langganan, tidak ada transaksi/tabungan/profil keuangan.
export default function Admin({ myId }) {
  const [users, setUsers] = useState([])
  const [requests, setRequests] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)

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
      ? `Konfirmasi pembayaran ${req.username} untuk paket ${planName(req.plan)} (${rupiah(req.amount)})? Premium akan langsung aktif.`
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

  return (
    <>
      <div className="summary">
        <div><small>Jumlah pengguna</small><b>{users.length}</b></div>
        <div><small>Premium aktif</small><b className="in">{premiumAktif}</b></div>
        <div><small>Menunggu konfirmasi</small><b className="out">{menunggu}</b></div>
      </div>
      {error && <p className="alert danger">{error}</p>}

      <div className="card">
        <div className="row between"><h2>Permintaan langganan</h2><button className="secondary" onClick={load}>Muat ulang</button></div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Username</th><th>Paket</th><th className="num">Nominal</th><th>Nama pengirim</th><th>Transfer dari</th><th>Waktu</th><th>Aksi</th></tr></thead>
            <tbody>
              {requests.length === 0 && <tr><td colSpan="7" className="muted">Belum ada permintaan.</td></tr>}
              {requests.map(r => (
                <tr key={r.id}>
                  <td>{r.username || '–'}</td>
                  <td>{planName(r.plan)}</td>
                  <td className="num">{rupiah(r.amount)}</td>
                  <td>{r.sender_name}</td>
                  <td>{r.sender_via}</td>
                  <td>{waktu(r.created_at)}</td>
                  <td className="actions">
                    {r.status === 'menunggu' ? (
                      <>
                        <button className="small" disabled={busy === r.id} onClick={() => decide(r, true)}>Konfirmasi</button>
                        <button className="small danger" disabled={busy === r.id} onClick={() => decide(r, false)}>Tolak</button>
                      </>
                    ) : <span className={`status ${r.status}`}>{STATUS[r.status]}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Daftar pengguna</h2>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Username</th><th>Status</th><th>Paket</th><th>Aktif sampai</th><th>Tanggal daftar</th><th>Aksi</th></tr></thead>
            <tbody>
              {users.map(u => {
                const isAdmin = u.role === 'admin'
                const status = isAdmin ? 'Admin' : u.premium_aktif ? 'Premium' : 'Gratis'
                return (
                  <tr key={u.id}>
                    <td>{u.username}{u.id === myId ? ' (kamu)' : ''}</td>
                    <td><span className={`badge ${isAdmin || u.premium_aktif ? 'gold' : ''}`}>{status}</span></td>
                    <td>{u.premium_plan ? planName(u.premium_plan) : '–'}</td>
                    <td>{u.premium_plan === 'selamanya' ? 'Selamanya' : waktu(u.premium_until)}</td>
                    <td>{waktu(u.created_at)}</td>
                    <td>{isAdmin ? '–' : <button className="small danger" disabled={busy === u.id} onClick={() => ban(u)}>Ban</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
