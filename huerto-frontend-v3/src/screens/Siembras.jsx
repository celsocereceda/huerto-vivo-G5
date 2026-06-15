import { useState } from "react";
import { useApi }   from "../useApi";
import { api }      from "../api";
import { Spinner, ErrorBox } from "../components";
import "./Siembras.css";

const iconMap = {
  tomate:"🍅", lechuga:"🥬", zanahoria:"🥕", pepino:"🥒",
  espinaca:"🥬", albahaca:"🌿", rabanito:"🌿", cilantro:"🌿", default:"🌱"
};
function getIcon(nombre) {
  if (!nombre) return "🌱";
  const n = nombre.toLowerCase();
  for (const k of Object.keys(iconMap)) if (n.includes(k)) return iconMap[k];
  return iconMap.default;
}

export default function Siembras({ noLeidas, onBell, showToast }) {
  const { data: siembrasResp, loading, error, refetch } = useApi(api.getSiembras);
  const { data: parcelasResp }  = useApi(api.getParcelasDisponibles);
  const { data: especiesResp }  = useApi(api.getEspecies);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    parcela_id:"", especie_id:"",
    fecha_siembra: new Date().toISOString().split("T")[0],
    cantidad_plantas:""
  });
  const [saving, setSaving] = useState(false);

  // Normalizar respuestas — el backend puede devolver { ok, data: [...] } o directamente [...]
  const siembras = Array.isArray(siembrasResp?.data) ? siembrasResp.data
    : Array.isArray(siembrasResp) ? siembrasResp : [];

  const parcelasLibres = Array.isArray(parcelasResp?.data) ? parcelasResp.data
    : Array.isArray(parcelasResp) ? parcelasResp : [];

  const especies = Array.isArray(especiesResp?.data) ? especiesResp.data
    : Array.isArray(especiesResp) ? especiesResp : [];

  async function handleCrear() {
    if (!form.parcela_id || !form.especie_id || !form.fecha_siembra) {
      showToast("Completa parcela, especie y fecha"); return;
    }
    setSaving(true);
    try {
      await api.crearSiembra({
        parcela_id:       form.parcela_id,
        especie_id:       form.especie_id,
        fecha_siembra:    form.fecha_siembra,
        cantidad_plantas: form.cantidad_plantas ? parseInt(form.cantidad_plantas) : undefined,
      });
      showToast("✅ Siembra registrada correctamente");
      setShowModal(false);
      setForm({ parcela_id:"", especie_id:"", fecha_siembra: new Date().toISOString().split("T")[0], cantidad_plantas:"" });
      refetch();
    } catch (e) {
      showToast("Error: " + e.message);
    }
    setSaving(false);
  }

  return (
    <div className="siembras-screen">
      <div className="screen-header">
        <div className="header-logo"><span>🌿</span><strong>Huerto Vivo</strong></div>
        <button className="header-bell" onClick={onBell} style={{ position:"relative" }}>
          🔔{noLeidas > 0 && <span className="bell-badge">{noLeidas}</span>}
        </button>
      </div>

      <div className="siembras-body">
        <div className="siembras-top">
          <h2 className="siembras-title">Registro de Siembra</h2>
          <p className="siembras-sub">Gestiona qué cultivos están en crecimiento y quién es responsable.</p>
          <button className="btn-nueva" onClick={() => setShowModal(true)}>+ Nueva Siembra</button>
        </div>

        {loading && <Spinner />}
        {error   && <ErrorBox message={error} onRetry={refetch} />}

        <div className="parcelas-list">
          {siembras.map((s) => (
            <div className="parcela-card" key={s.id}>
              <div className="parcela-header">
                <span className="parcela-id">{s.parcela_codigo ?? `Parcela ${s.parcela_id}`}</span>
                {s.progreso >= 100 && <span className="parcela-alert-badge">🌾 Lista</span>}
              </div>
              <div className="parcela-cultivo">
                <span className="cultivo-icon">{getIcon(s.especie_nombre)}</span>
                <span className="cultivo-name">{s.especie_nombre}</span>
              </div>
              <div className="parcela-meta">📅 {s.fecha_siembra
                ? new Date(s.fecha_siembra).toLocaleDateString("es-CL", { day:"numeric", month:"long", year:"numeric" })
                : "—"}</div>
              <div className="parcela-meta">👤 {s.responsable ?? s.vecino_nombre ?? "—"}</div>
              {s.fecha_cosecha_estimada && (
                <div className="parcela-meta">
                  🎯 Cosecha est: {new Date(s.fecha_cosecha_estimada).toLocaleDateString("es-CL", { day:"numeric", month:"long" })}
                </div>
              )}
              <div className="parcela-estado">
                <span className="estado-label">{s.estado ?? "Crecimiento"}</span>
                <span className="progreso-pct">{s.progreso ?? 0}%</span>
              </div>
              <div className="progress-wrap">
                <div className="progress-bar" style={{
                  width:`${Math.min(s.progreso ?? 0, 100)}%`,
                  background: s.progreso >= 100 ? "var(--amber)" : "var(--green-bright)"
                }} />
              </div>
            </div>
          ))}

          {parcelasLibres.map((p) => (
            <div className="parcela-card" key={`libre-${p.id}`}>
              <div className="parcela-header">
                <span className="parcela-id">{p.codigo ?? `Parcela ${p.id}`}</span>
                <span className="disponible-dot">⚪</span>
              </div>
              <div className="parcela-vacia">
                <span className="vacia-icon">🌱</span>
                <p className="vacia-txt">Disponible para siembra</p>
              </div>
            </div>
          ))}

          {!loading && siembras.length === 0 && parcelasLibres.length === 0 && (
            <div style={{ textAlign:"center", padding:"32px 0" }}>
              <p style={{ fontSize:36 }}>🌱</p>
              <p style={{ fontSize:13, color:"var(--text-muted)", fontWeight:700, marginTop:8 }}>No hay siembras registradas</p>
            </div>
          )}
        </div>

        <div className="asistente-card">
          <div className="asistente-avatar">🤖</div>
          <div className="asistente-content">
            <p className="asistente-title">Consejos de tu Asistente</p>
            <p className="asistente-intro">Tips para esta temporada en el huerto.</p>
            <div className="asistente-tip">
              <span className="tip-icon">💡</span>
              <div>
                <p className="tip-title">Tip de Temporada</p>
                <p className="tip-txt">Es el momento perfecto para sembrar remolacha y zanahorias. ¡Crecen muy rápido!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🌱 Nueva Siembra</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="form-label">Parcela disponible</label>
              <select className="form-input" value={form.parcela_id}
                onChange={e => setForm(f => ({ ...f, parcela_id: e.target.value }))}>
                <option value="">Selecciona una parcela...</option>
                {parcelasLibres.map(p => (
                  <option key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</option>
                ))}
              </select>

              <label className="form-label" style={{ marginTop:12 }}>Especie / Cultivo</label>
              <select className="form-input" value={form.especie_id}
                onChange={e => setForm(f => ({ ...f, especie_id: e.target.value }))}>
                <option value="">Selecciona un cultivo...</option>
                {especies.map(e => (
                  <option key={e.id} value={e.id}>
                    {getIcon(e.nombre_comun)} {e.nombre_comun} ({e.dias_cosecha} días)
                  </option>
                ))}
              </select>

              <label className="form-label" style={{ marginTop:12 }}>Fecha de siembra</label>
              <input className="form-input" type="date" value={form.fecha_siembra}
                onChange={e => setForm(f => ({ ...f, fecha_siembra: e.target.value }))} />

              <label className="form-label" style={{ marginTop:12 }}>Cantidad de plantas (opcional)</label>
              <input className="form-input" type="number" placeholder="Ej: 6"
                value={form.cantidad_plantas}
                onChange={e => setForm(f => ({ ...f, cantidad_plantas: e.target.value }))} />

              <button className="btn-primary" style={{ marginTop:14 }} onClick={handleCrear} disabled={saving}>
                {saving ? "Registrando en BD..." : "🌱 Registrar Siembra"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
