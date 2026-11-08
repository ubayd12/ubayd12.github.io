// Menu AI — belum memanggil layanan AI apa pun.
export default function AI({ premium, onSubscribe }) {
  return (
    <div className="grid2">
      <div className="card">
        <h2>🤖 AI Klasik <span className="badge">Gratis</span></h2>
        <p className="soon">AI segera hadir</p>
      </div>
      <div className="card">
        <h2>{premium ? '✨' : '🔒'} AI Eksklusif <span className="badge gold">Premium</span></h2>
        <p className="soon">AI segera hadir</p>
        {!premium && <button onClick={onSubscribe}>Berlangganan Premium</button>}
      </div>
    </div>
  )
}
