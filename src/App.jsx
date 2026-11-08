import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseReady } from './supabase.js'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  const loadProfile = useCallback(async () => {
    if (!userId) { setProfile(null); return }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) setProfileError('Profil akun belum bisa dimuat. Fitur premium dinonaktifkan sementara.')
    else setProfileError('')
    setProfile(data || null)
  }, [userId])
  useEffect(() => { loadProfile() }, [loadProfile])

  if (!supabaseReady) {
    return <main className="wrap"><p className="error">Konfigurasi Supabase belum terbaca. Periksa secret VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.</p></main>
  }
  if (loading) return <main className="wrap"><p>Memuat…</p></main>

  return (
    <main className="wrap">
      <h1>Catatku</h1>
      {session
        ? <Dashboard key={userId} session={session} profile={profile} profileError={profileError} reloadProfile={loadProfile} />
        : <div className="narrow"><Login /></div>}
    </main>
  )
}
