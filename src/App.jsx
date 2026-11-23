import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseReady } from './supabase.js'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'
import { PESAN_BAN } from './lib.js'
import { Logo } from './ui.jsx'
import { ChartPie, PiggyBank, Repeat, ShieldAlert, Target } from 'lucide-react'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [banned, setBanned] = useState(false)

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
    if (error) setProfileError('Profil akun belum bisa dimuat. Coba muat ulang halaman.')
    else setProfileError('')
    setProfile(data || null)
  }, [userId])
  useEffect(() => { loadProfile() }, [loadProfile])

  // Akun yang di-ban: tampilkan layar penuh lalu keluarkan otomatis.
  useEffect(() => {
    if (!profile?.banned_at) return
    setBanned(true)
    supabase.auth.signOut().catch(() => supabase.auth.signOut({ scope: 'local' }))
  }, [profile])

  if (!supabaseReady) {
    return (
      <main className="layar-tengah">
        <div className="card kartu-tengah"><Logo size={48} /><p className="error">Konfigurasi Supabase belum terbaca. Periksa secret VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.</p></div>
      </main>
    )
  }
  if (loading) return <main className="layar-tengah"><div className="memuat"><Logo size={56} /><span>Memuat…</span></div></main>

  if (banned) {
    return (
      <div className="banned-screen" role="alert">
        <div className="banned-kartu">
          <span className="banned-ikon" aria-hidden="true"><ShieldAlert size={30} /></span>
          <p>{PESAN_BAN}</p>
          {!session && <button className="secondary" onClick={() => setBanned(false)}>Kembali ke halaman Masuk</button>}
        </div>
      </div>
    )
  }

  if (session) return <Dashboard key={userId} session={session} profile={profile} profileError={profileError} />

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="auth-merek"><Logo size={44} /><span>Catatku</span></div>
        <div className="auth-teks">
          <h1>Atur uangmu dengan tenang.</h1>
          <p>Catat pemasukan dan pengeluaran, pantau anggaran, dan kumpulkan tabungan — semua di satu tempat.</p>
          <ul className="auth-fitur">
            <li><ChartPie size={18} /> Statistik per kategori</li>
            <li><Target size={18} /> Anggaran tiap bulan</li>
            <li><Repeat size={18} /> Transaksi rutin otomatis</li>
            <li><PiggyBank size={18} /> Target tabungan</li>
          </ul>
        </div>
      </section>
      <main className="auth-form"><Login /></main>
    </div>
  )
}
