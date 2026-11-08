export default function Locked({ title, children, onSubscribe }) {
  return (
    <div className="card locked">
      <div className="lock" aria-hidden="true">🔒</div>
      <h2>{title}</h2>
      <p>{children || 'Fitur ini khusus pengguna Premium.'}</p>
      <button onClick={onSubscribe}>Berlangganan Premium</button>
    </div>
  )
}
