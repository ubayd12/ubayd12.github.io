import { useState } from 'react'
import { supabase } from './supabase.js'
import Catatan from './Catatan.jsx'
import Rekap from './Rekap.jsx'
import Tabungan from './Tabungan.jsx'
import ProfilKeuangan from './ProfilKeuangan.jsx'
import AI from './AI.jsx'
import Admin from './Admin.jsx'

export default function Dashboard({ session, profile, profileError }) {
  const [tab, setTab] = useState('catatan')
  const admin = profile?.role === 'admin'
  const username = profile?.username || session.user.user_metadata?.username || ''

  const tabs = [
    { id: 'catatan', label: 'Catatan' },
    { id: 'rekap', label: 'Rekap' },
    { id: 'tabungan', label: 'Tabungan' },
    { id: 'profil', label: 'Profil Keuangan' },
    { id: 'ai', label: 'AI' },
    admin && { id: 'admin', label: 'Admin' },
  ].filter(Boolean)

  return (
    <>
      <div className="topbar">
        <span>Halo, <b>{username}</b>{admin && <> <span className="badge">Admin</span></>}</span>
        <button className="link" onClick={() => supabase.auth.signOut()}>Keluar</button>
      </div>
      {profileError && <p className="alert warn">{profileError}</p>}

      <nav className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      {tab === 'catatan' && <Catatan />}
      {tab === 'rekap' && <Rekap />}
      {tab === 'tabungan' && <Tabungan />}
      {tab === 'profil' && <ProfilKeuangan />}
      {tab === 'ai' && <AI />}
      {tab === 'admin' && admin && <Admin myId={session.user.id} />}
    </>
  )
}
