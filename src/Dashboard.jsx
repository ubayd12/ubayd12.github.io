import { useState } from 'react'
import { supabase } from './supabase.js'
import { isPremium, planName } from './lib.js'
import Catatan from './Catatan.jsx'
import Rekap from './Rekap.jsx'
import Tabungan from './Tabungan.jsx'
import ProfilKeuangan from './ProfilKeuangan.jsx'
import AI from './AI.jsx'
import Langganan from './Langganan.jsx'
import Admin from './Admin.jsx'

export default function Dashboard({ session, profile, profileError, reloadProfile }) {
  const [tab, setTab] = useState('catatan')
  const premium = isPremium(profile)
  const admin = profile?.role === 'admin'
  const username = profile?.username || session.user.user_metadata?.username || ''
  const goSubscribe = () => setTab('langganan')

  const tabs = [
    { id: 'catatan', label: 'Catatan' },
    { id: 'rekap', label: 'Rekap', premium: true },
    { id: 'tabungan', label: 'Tabungan', premium: true },
    { id: 'profil', label: 'Profil Keuangan', premium: true },
    { id: 'ai', label: 'AI' },
    !admin && { id: 'langganan', label: premium ? 'Langganan' : '⭐ Berlangganan' },
    admin && { id: 'admin', label: 'Admin' },
  ].filter(Boolean)

  let status = 'Gratis'
  if (admin) status = 'Admin'
  else if (premium) status = `Premium · ${planName(profile.premium_plan)}`

  return (
    <>
      <div className="topbar">
        <span>Halo, <b>{username}</b> <span className={`badge ${premium ? 'gold' : ''}`}>{status}</span></span>
        <button className="link" onClick={() => supabase.auth.signOut()}>Keluar</button>
      </div>
      {profileError && <p className="alert warn">{profileError}</p>}

      <nav className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.premium && !premium ? '🔒 ' : ''}{t.label}
          </button>
        ))}
      </nav>

      {tab === 'catatan' && <Catatan premium={premium} onSubscribe={goSubscribe} />}
      {tab === 'rekap' && <Rekap premium={premium} onSubscribe={goSubscribe} />}
      {tab === 'tabungan' && <Tabungan premium={premium} onSubscribe={goSubscribe} />}
      {tab === 'profil' && <ProfilKeuangan premium={premium} onSubscribe={goSubscribe} />}
      {tab === 'ai' && <AI premium={premium || profile?.role === 'admin'} onSubscribe={goSubscribe} />}
      {tab === 'langganan' && !admin && <Langganan profile={profile} premium={premium} reloadProfile={reloadProfile} />}
      {tab === 'admin' && admin && <Admin myId={session.user.id} />}
    </>
  )
}
