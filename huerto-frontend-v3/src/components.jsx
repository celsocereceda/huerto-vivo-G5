// Spinner y ErrorBox reutilizables en todas las pantallas
export function Spinner() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 0', gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, border: '3px solid var(--green-light)',
        borderTopColor: 'var(--green-bright)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>Cargando...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div style={{
      background: 'var(--red-pale)', border: '1.5px solid var(--red-soft)',
      borderRadius: 'var(--radius-sm)', padding: '16px', margin: '12px 0',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--red-soft)' }}>
        ⚠️ Error al cargar datos
      </p>
      <p style={{ fontSize: 12, color: '#c04040', fontWeight: 600 }}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} style={{
          background: 'var(--red-soft)', color: 'white', border: 'none',
          borderRadius: 8, padding: '8px 16px', fontFamily: 'Nunito, sans-serif',
          fontSize: 12, fontWeight: 800, cursor: 'pointer', alignSelf: 'flex-start',
        }}>
          Reintentar
        </button>
      )}
    </div>
  );
}
