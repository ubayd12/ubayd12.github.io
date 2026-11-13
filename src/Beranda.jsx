import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'
import { rupiah, pesanError, bulanIni, namaBulan, awalBulan, akhirBulan, ambilTransaksi, jumlahJenis } from './lib.js'
import { Modal, Chip, Progres, PeringatanHemat } from './ui.jsx'
import { BarisCatatan, FormTransaksi } from './Catatan.jsx'

export default function Beranda({ kategori, go }) {
  const [bulanan, setBulanan] = useState([])
  const [terakhir, setTerakhir] = useState([])
  const [budgets, setBudgets] = useState([])
  const [error, setError] = useState('')
  const [tambah, setTambah] = useState(false)
  const bulan = bulanIni()

  const katMap = useMemo(() => Object.fromEntries(kategori.map(k => [k.id, k])), [kategori])

  async function load() {
    try {
      const [list, last, b] = await Promise.all([
        ambilTransaksi(awalBulan(bulan), akhirBulan(bulan)),
        supabase.from('transactions').select('id, type, amount, note, date, category_id, created_at')
          .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(5),
        supabase.from('budgets').select('category_id, batas').eq('bulan', awalBulan(bulan)),
      ])
      if (last.error) throw last.error
      if (b.error) throw b.error
      setBulanan(list); setTerakhir(last.data); setBudgets(b.data); setError('')
    } catch (e) { setError(pesanError(e)) }
  }
  useEffect(() => { load() }, [])

  const masuk = jumlahJenis(bulanan, 'pemasukan')
  const keluar = jumlahJenis(bulanan, 'pengeluaran')

  // Anggaran yang paling mendekati (atau melewati) batas
  const ringkasAnggaran = budgets
    .filter(b => katMap[b.category_id])
    .map(b => {
      const pakai = bulanan.filter(t => t.type === 'pengeluaran' && t.category_id === b.category_id)
        .reduce((s, t) => s + Number(t.amount), 0)
      return { ...b, pakai, pct: Math.round(pakai / Number(b.batas) * 100) }
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3)

  return (
    <>
      <PeringatanHemat keluar={keluar} />
      {error && <p className="alert danger">{error}</p>}

      <div className="card hero">
        <small>Saldo {namaBulan(bulan)}</small>
        <b className={masuk - keluar < 0 ? 'out' : ''}>{rupiah(masuk - keluar)}</b>
        <div className="hero-dua">
          <div><small>Pemasukan</small><b className="in">{rupiah(masuk)}</b></div>
          <div><small>Pengeluaran</small><b className="out">{rupiah(keluar)}</b></div>
        </div>
        <button onClick={() => setTambah(true)}>+ Tambah catatan</button>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="row between nowrap">
            <h2>Catatan terakhir</h2>
            <button className="link small" onClick={() => go('catatan')}>Lihat semua</button>
          </div>
          <ul className="list plain">
            {terakhir.length === 0 && <li className="empty">Belum ada catatan.</li>}
            {terakhir.map(i => <BarisCatatan key={i.id} item={i} kat={katMap[i.category_id]} />)}
          </ul>
        </div>

        <div className="card">
          <div className="row between nowrap">
            <h2>Anggaran</h2>
            <button className="link small" onClick={() => go('anggaran')}>Atur</button>
          </div>
          {ringkasAnggaran.length === 0 && <p className="muted">Belum ada anggaran untuk bulan ini.</p>}
          {ringkasAnggaran.map(a => (
            <div key={a.category_id} className="anggaran-item">
              <div className="row between nowrap">
                <Chip kat={katMap[a.category_id]} />
                <small className="muted">{a.pct}%</small>
              </div>
              <Progres pct={a.pct} />
              <small className="muted">{rupiah(a.pakai)} dari {rupiah(a.batas)}</small>
            </div>
          ))}
        </div>
      </div>

      {tambah && (
        <Modal judul="Tambah catatan" onClose={() => setTambah(false)}>
          <FormTransaksi kategori={kategori} onSaved={() => { setTambah(false); load() }} />
        </Modal>
      )}
    </>
  )
}
