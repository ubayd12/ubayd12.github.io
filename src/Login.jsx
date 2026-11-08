import { useState } from 'react'
import { supabase, usernameToEmail, validUsername } from './supabase.js'
import { PESAN_BAN } from './lib.js'

export default function Login() {
  const [mode, setMode] = useState('masuk')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!validUsername(username)) {
      setError('Username 3–20 karakter: huruf kecil, angka, atau garis bawah.')
      return
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter.')
      return
    }
    setBusy(true)
    const email = usernameToEmail(username)
    const { data, error } = mode === 'daftar'
      ? await supabase.auth.signUp({ email, password, options: { data: { username: username.trim().toLowerCase() } } })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      const pesan = (error.message || '').toLowerCase()
      const kode = error.code || ''
      if (pesan.includes('banned') || kode === 'user_banned') setError(PESAN_BAN)
      else if (pesan.includes('already registered') || pesan.includes('already exists') || kode === 'user_already_exists') setError('Username sudah dipakai.')
      else if (pesan.includes('invalid login')) setError('Username atau password salah.')
      else setError(error.message)
      return
    }
    // Bila konfirmasi email aktif, Supabase tidak memberi error untuk email yang sudah
    // terdaftar (termasuk akun yang di-ban), tetapi mengembalikan user tanpa identities.
    if (mode === 'daftar' && data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError('Username sudah dipakai.')
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>{mode === 'masuk' ? 'Masuk' : 'Daftar akun'}</h2>
      <label>Username
        <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
      </label>
      <label>Password
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'} />
      </label>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Tunggu…' : mode === 'masuk' ? 'Masuk' : 'Daftar'}</button>
      <button type="button" className="link" onClick={() => { setMode(mode === 'masuk' ? 'daftar' : 'masuk'); setError('') }}>
        {mode === 'masuk' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
      </button>
    </form>
  )
}
