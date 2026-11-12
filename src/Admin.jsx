import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { waktu } from './lib.js'

function statusUser(u) {
  if (u.banned_at) return 'Di-ban'
  if (u.role === 'admin') return 'Admin'
  return 'Aktif'
}

// Admin hanya melihat data akun, tidak ada transaksi/tabungan/profil keuangan.
export default function Admin({ myId }) {
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [cari, setCari] = useState('')
  const [saring, setSaring] = useState('semua')

  async function load() {
    setError('')
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) setError(error.message)
    setUsers(data || [])
  }
  useEffect(() => { load() }, [])

  async function ban(user) {
    if (!confirm(`Ban ${user.username}? Semua datanya dihapus dan akun ini tidak bisa masuk lagi selamanya.`)) return
    if (prompt(`Ketik username "${user.username}" untuk konfirmasi:`) !== user.username) return
    setBusy(user.id)
    const { error } = await supabase.rpc('admin_ban_user', { p_id: user.id })
    setBusy(null)
    if (error) setError(error.message)
    load()
  }

  const jumlahDiban = users.filter(u => u.banned_at).length

  const kata = cari.trim().toLowerCase()
  const daftarUser = users.filter(u => {
    if (kata && !(u.username || '').toLowerCase().includes(kata)) return false
    if (saring === 'aktif') return statusUser(u) === 'Aktif'
    if (saring === 'admin') return statusUser(u) === 'Admin'
    if (saring === 'diban') return statusUser(u) === 'Di-ban'
    return true
  })

  return (
    <>
      <div className="summary two">
        <div><small>Jumlah pengguna</small><b>{users.length}</b></div>
        <div><small>Di-ban</small><b className="out">{jumlahDiban}</b></div>
      </div>

      {error && <p className="alert danger">{error}</p>}

      <div className="card">
        <div className="row between"><h2>Pengawasan User</h2><button className="secondary" onClick={load}>Muat ulang</button></div>
        <div className="filterbar">
          <label>Cari username
            <input type="search" value={cari} onChange={e => setCari(e.target.value)} placeholder="Ketik username…" />
          </label>
          <label>Status
            <select value={saring} onChange={e => setSaring(e.target.value)}>
              <option value="semua">Semua</option>
              <option value="aktif">Aktif</option>
              <option value="admin">Admin</option>
              <option value="diban">Di-ban</option>
            </select>
          </label>
        </div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Username</th><th>Status</th><th>Tanggal daftar</th><th>Aksi</th></tr></thead>
            <tbody>
              {daftarUser.length === 0 && <tr><td colSpan="4" className="muted">Tidak ada pengguna yang cocok.</td></tr>}
              {daftarUser.map(u => {
                const status = statusUser(u)
                const isAdmin = status === 'Admin'
                const diban = status === 'Di-ban'
                return (
                  <tr key={u.id}>
                    <td>{u.username}{u.id === myId ? ' (kamu)' : ''}</td>
                    <td><span className={`badge ${diban ? 'red' : ''}`}>{status}</span></td>
                    <td>{waktu(u.created_at)}</td>
                    <td>{isAdmin || diban ? '' : <button className="small danger" disabled={busy === u.id} onClick={() => ban(u)}>Ban</button>}</td>
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
