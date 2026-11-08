import { useState } from 'react'
import { supabase, usernameToEmail, validUsername } from './supabase.js'

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
    const { error } = mode === 'daftar'
      ? await supabase.auth.signUp({ email, password, options: { data: { username: username.trim().toLowerCase() } } })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      if (error.message.includes('already registered')) setError('Username sudah dipakai.')
      else if (error.message.includes('Invalid login')) setError('Username atau password salah.')
      else setError(error.message)
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
