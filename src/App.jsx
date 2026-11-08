import { useEffect, useState } from 'react'
import { supabase, supabaseReady } from './supabase.js'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabaseReady) {
    return <main className="wrap"><p className="error">Konfigurasi Supabase belum terbaca. Periksa secret VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.</p></main>
  }
  if (loading) return <main className="wrap"><p>Memuat…</p></main>

  return (
    <main className="wrap">
      <h1>Catatku</h1>
      {session ? <Dashboard session={session} /> : <Login />}
    </main>
  )
}
