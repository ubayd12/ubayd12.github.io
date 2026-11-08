import { createClient } from '@supabase/supabase-js'

// Nilai diisi saat build dari GitHub Secrets (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseReady = Boolean(url && key)
export const supabase = supabaseReady ? createClient(url, key) : null

// Login hanya pakai username. Supabase butuh format email,
// jadi username diubah menjadi alamat internal yang tidak pernah dikirimi email.
export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@users.catatku.app`
}

export function validUsername(username) {
  return /^[a-z0-9_]{3,20}$/.test(username.trim().toLowerCase())
}
