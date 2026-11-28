import { useEffect, useState } from 'react'

// Tema tampilan: 'otomatis' (ikut pengaturan HP/laptop), 'terang', atau 'gelap'.
// Pilihan disimpan di perangkat ini saja (localStorage).
const KUNCI = 'catatku-tema'
const WARNA_BILAH = { terang: '#047857', gelap: '#0a1310' }
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function pilihanTema() {
  try { return localStorage.getItem(KUNCI) || 'otomatis' } catch { return 'otomatis' }
}

export function temaAktif(p = pilihanTema()) {
  return p === 'gelap' || (p === 'otomatis' && media?.matches) ? 'gelap' : 'terang'
}

export function terapkanTema(p = pilihanTema()) {
  const t = temaAktif(p)
  document.documentElement.dataset.tema = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', WARNA_BILAH[t])
  window.dispatchEvent(new Event('catatku:tema'))
}

export function setPilihanTema(p) {
  try {
    if (p === 'otomatis') localStorage.removeItem(KUNCI)
    else localStorage.setItem(KUNCI, p)
  } catch { /* penyimpanan tidak tersedia: tetap berlaku sampai halaman ditutup */ }
  terapkanTema(p)
}

// Ikuti perubahan tema HP bila pilihannya otomatis
media?.addEventListener?.('change', () => { if (pilihanTema() === 'otomatis') terapkanTema() })

export function useTema() {
  const [, setN] = useState(0)
  useEffect(() => {
    const f = () => setN(n => n + 1)
    window.addEventListener('catatku:tema', f)
    return () => window.removeEventListener('catatku:tema', f)
  }, [])
  return { pilihan: pilihanTema(), aktif: temaAktif() }
}
