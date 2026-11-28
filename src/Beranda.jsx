import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Minus, NotebookPen, Plus, Repeat, Target, Wallet } from 'lucide-react'
import { supabase } from './supabase.js'
import { rupiah, pesanError, bulanIni, namaBulan, awalBulan, akhirBulan, ambilTransaksi, jumlahJenis, persen } from './lib.js'
import { Modal, IkonKat, Progres, StatusAnggaran, PeringatanHemat, Skeleton, Kosong, Pas, PasBersama, useAngkaNaik, toast } from './ui.jsx'
import { BarisCatatan, FormTransaksi } from './Catatan.jsx'

export default function Beranda({ kategori, go, versi, onTambah }) {
  const [bulanan, setBulanan] = useState([])
  const [terakhir, setTerakhir] = useState([])
  const [budgets, setBudgets] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)
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
    setLoading(false)
  }
  useEffect(() => { load() }, [versi])

  const masuk = jumlahJenis(bulanan, 'pemasukan')
  const keluar = jumlahJenis(bulanan, 'pengeluaran')
  const rasio = masuk > 0 ? Math.round(keluar / masuk * 100) : null
  const saldoTampil = useAngkaNaik(loading ? 0 : masuk - keluar)

  // Anggaran yang paling mendekati (atau melewati) batas
  const ringkasAnggaran = budgets
    .filter(b => katMap[b.category_id])
    .map(b => {
      const pakai = bulanan.filter(t => t.type === 'pengeluaran' && t.category_id === b.category_id)
        .reduce((s, t) => s + Number(t.amount), 0)
      return { ...b, pakai, pct: persen(pakai, b.batas) }
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3)

  function selesai(aksi) {
    setEdit(null)
    load()
    toast(aksi === 'hapus' ? 'Catatan dihapus' : 'Perubahan disimpan')
  }

  return (
    <>
      <div className="beranda-atas">
        <section className="hero">
          <span className="hero-label"><Wallet size={16} /> Saldo {namaBulan(bulan)}</span>
          {loading ? <span className="sk sk-saldo" /> : <Pas as="div" className="hero-saldo">{rupiah(saldoTampil)}</Pas>}
          {!loading && rasio !== null && (
            <div className="hero-rasio">
              <div className="hero-bar"><span style={{ width: Math.min(100, rasio) + '%' }} /></div>
              <small>{rasio < 1 && keluar > 0 ? 'Kurang dari 1%' : `${rasio}%`} pemasukan bulan ini sudah terpakai</small>
            </div>
          )}
          <PasBersama className="hero-dua">
            <div>
              <small><ArrowDownLeft size={14} /> Pemasukan</small>
              {loading ? <span className="sk sk-kecil" /> : <b className="pas pas-anak">{rupiah(masuk)}</b>}
            </div>
            <div>
              <small><ArrowUpRight size={14} /> Pengeluaran</small>
              {loading ? <span className="sk sk-kecil" /> : <b className="pas pas-anak">{rupiah(keluar)}</b>}
            </div>
          </PasBersama>
        </section>

        <div className="aksi-cepat">
          <button type="button" onClick={() => onTambah('pemasukan')}><span className="bulat tint-hijau"><Plus size={20} /></span>Pemasukan</button>
          <button type="button" onClick={() => onTambah('pengeluaran')}><span className="bulat tint-merah"><Minus size={20} /></span>Pengeluaran</button>
          <button type="button" onClick={() => go('catatan')}><span className="bulat tint-biru"><NotebookPen size={20} /></span>Catatan</button>
          <button type="button" onClick={() => go('rutin')}><span className="bulat tint-ungu"><Repeat size={20} /></span>Rutin</button>
        </div>
      </div>

      {!loading && <PeringatanHemat keluar={keluar} />}
      {error && <p className="alert danger">{error}</p>}

      <div className="grid2">
        <section className="card">
          <div className="kepala-kartu">
            <h2>Catatan terakhir</h2>
            <button type="button" className="link" onClick={() => go('catatan')}>Lihat semua <ChevronRight size={16} /></button>
          </div>
          {loading ? <Skeleton baris={4} /> : terakhir.length === 0 ? (
            <Kosong ikon={<NotebookPen size={28} />} judul="Belum ada catatan" teks="Mulai catat pemasukan dan pengeluaranmu hari ini.">
              <button type="button" onClick={() => onTambah('pengeluaran')}><Plus size={18} /> Tambah catatan</button>
            </Kosong>
          ) : (
            <ul className="daftar">
              {terakhir.map(i => <BarisCatatan key={i.id} item={i} kat={katMap[i.category_id]} onClick={setEdit} />)}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="kepala-kartu">
            <h2>Anggaran bulan ini</h2>
            <button type="button" className="link" onClick={() => go('anggaran')}>Atur <ChevronRight size={16} /></button>
          </div>
          {loading ? <Skeleton baris={3} /> : ringkasAnggaran.length === 0 ? (
            <Kosong ikon={<Target size={28} />} judul="Belum ada anggaran" teks="Tentukan batas belanja per kategori supaya pengeluaran tetap terkendali.">
              <button type="button" className="secondary" onClick={() => go('anggaran')}>Atur anggaran</button>
            </Kosong>
          ) : (
            <ul className="daftar-anggaran">
              {ringkasAnggaran.map(a => (
                <li key={a.category_id}>
                  <div className="anggaran-baris">
                    <IkonKat kat={katMap[a.category_id]} />
                    <span className="anggaran-isi">
                      <span className="anggaran-atas"><b>{katMap[a.category_id].nama}</b><StatusAnggaran pct={a.pct} /></span>
                      <Progres pct={a.pct} />
                      <small>{rupiah(a.pakai)} dari {rupiah(a.batas)}</small>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {edit && (
        <Modal judul="Edit catatan" onClose={() => setEdit(null)}>
          <FormTransaksi kategori={kategori} awal={edit} onSaved={selesai} />
        </Modal>
      )}
    </>
  )
}
