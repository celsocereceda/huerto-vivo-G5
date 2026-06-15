import { useState } from "react";
import { useApi }   from "../useApi";
import { api }      from "../api";
import { Spinner, ErrorBox } from "../components";
import "./Cosecha.css";

const EMOJIS = {
  tomate:"🍅", lechuga:"🥬", zanahoria:"🥕", calabacin:"🥒",
  espinaca:"🥬", albahaca:"🌿", pepino:"🥒", rabanito:"🌿", default:"🌿"
};
function emoji(nombre) {
  if (!nombre) return "🌿";
  const n = nombre.toLowerCase();
  for (const k of Object.keys(EMOJIS)) if (n.includes(k)) return EMOJIS[k];
  return EMOJIS.default;
}

export default function Cosecha({ noLeidas, onBell, showToast, onRecargar }) {
  // useApi devuelve la respuesta completa: { ok, data: { detalle, resumen, total_kg } }
  const { data: resp, loading, error, refetch } = useApi(api.getCosechas);
  const { data: siembrasResp } = useApi(api.getSiembras);

  // Extraer el array de cosechas del nivel correcto
  const cosechas = Array.isArray(resp?.data?.detalle)
    ? resp.data.detalle
    : Array.isArray(resp?.data)
    ? resp.data
    : [];

  // Extraer siembras activas
  const siembras = Array.isArray(siembrasResp?.data)
    ? siembrasResp.data.filter(s => s.activa !== false)
    : Array.isArray(siembrasResp)
    ? siembrasResp.filter(s => s.activa !== false)
    : [];

  const totalKg = cosechas.reduce((a, c) => a + parseFloat(c.cantidad_kg || 0), 0);

  const [form, setForm]    = useState({ siembra_id:"", calidad:"buena", cantidad_kg:"", fecha:"", nota:"" });
  const [enviando, setEnv] = useState(false);
  const [ok, setOk]        = useState(false);

  async function enviar() {
    if (!form.siembra_id || !form.cantidad_kg || !form.fecha) {
      showToast("Completa cultivo, cantidad y fecha"); return;
    }
    setEnv(true);
    try {
      await api.crearCosecha({
        siembra_id:    form.siembra_id,
        cantidad_kg:   parseFloat(form.cantidad_kg),
        fecha_cosecha: form.fecha,
        notas:         form.nota || undefined,
      });
      setOk(true);
      setForm({ siembra_id:"", calidad:"buena", cantidad_kg:"", fecha:"", nota:"" });
      refetch();
      onRecargar();
      showToast("✅ Cosecha reportada correctamente");
      setTimeout(() => setOk(false), 3000);
    } catch (e) {
      showToast("Error: " + e.message);
    }
    setEnv(false);
  }

  async function distribuir(id) {
    try {
      await api.distribuirCosecha(id);
      showToast("🌾 Cosecha distribuida entre todos los vecinos");
      refetch();
    } catch (e) {
      showToast("Error: " + e.message);
    }
  }

  const [primera, ...resto] = cosechas.slice(0, 6);

  return (
    <div className="cosecha-screen">
      <div className="screen-header">
        <div className="header-logo"><span>🌿</span><strong>Huerto Vivo</strong></div>
        <button className="header-bell" onClick={onBell} style={{ position:"relative" }}>
          🔔{noLeidas > 0 && <span className="bell-badge">{noLeidas}</span>}
        </button>
      </div>

      <div className="cosecha-body">
        {/* Resumen del mes */}
        {totalKg > 0 && (
          <div style={{ margin:"0 0 16px", background:"linear-gradient(135deg,#2d6a4f,#1a3a2a)", borderRadius:16, padding:"18px 20px", color:"#fff" }}>
            <p style={{ fontSize:11, fontWeight:700, opacity:.65, textTransform:"uppercase", letterSpacing:1 }}>Cosecha del Mes</p>
            <p style={{ fontSize:34, fontWeight:900, margin:"4px 0" }}>{totalKg.toFixed(1)} kg</p>
            <p style={{ fontSize:12, opacity:.75 }}>
              {cosechas.length} registros · {cosechas.filter(c => c.estado === "distribuida").length} distribuidos
            </p>
          </div>
        )}

        {/* Formulario desglosado */}
        <div className="reporte-card">
          <h2 className="reporte-title">Reportar Cosecha</h2>
          <p className="reporte-sub">Registra tu recolección. Toda cosecha debe quedar en el sistema — así el reparto es justo para todos.</p>

          <label className="form-label">Siembra / Cultivo cosechado</label>
          <select className="form-input" value={form.siembra_id}
            onChange={e => setForm(f => ({ ...f, siembra_id: e.target.value }))}>
            <option value="">Selecciona un cultivo...</option>
            {siembras.map(s => (
              <option key={s.id} value={s.id}>
                {emoji(s.especie_nombre)} {s.especie_nombre} — {s.parcela_codigo ?? `Parcela ${s.parcela_id}`}
              </option>
            ))}
          </select>

          <label className="form-label" style={{ marginTop:12 }}>Calidad Percibida</label>
          <div className="calidad-btns">
            {[["regular","😐 Regular"],["buena","😊 Buena"],["excelente","🤩 Excelente"]].map(([c, lb]) => (
              <button key={c} className={`calidad-btn ${form.calidad === c ? "selected" : ""}`}
                onClick={() => setForm(f => ({ ...f, calidad: c }))}>
                {lb}
              </button>
            ))}
          </div>

          <label className="form-label" style={{ marginTop:12 }}>Cantidad cosechada (kg)</label>
          <input className="form-input" type="number" step="0.1" min="0.1" placeholder="Ej: 2.5"
            value={form.cantidad_kg}
            onChange={e => setForm(f => ({ ...f, cantidad_kg: e.target.value }))} />

          <label className="form-label" style={{ marginTop:12 }}>Fecha de cosecha</label>
          <input className="form-input" type="date"
            value={form.fecha}
            onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />

          <label className="form-label" style={{ marginTop:12 }}>Notas adicionales (opcional)</label>
          <textarea className="form-input" rows={2}
            placeholder="Ej: Los tomates cherry salieron muy dulces esta vez."
            value={form.nota}
            onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
            style={{ resize:"none" }} />

          <button className="btn-primary" style={{ marginTop:14 }} onClick={enviar}
            disabled={enviando || !form.siembra_id || !form.cantidad_kg || !form.fecha}>
            {ok ? "✅ Reporte Enviado" : enviando ? "Guardando en BD..." : "📥 Enviar Reporte"}
          </button>
        </div>

        {/* Cosechas recientes */}
        <div className="recientes-section">
          <p className="section-title">Cosechas Recientes</p>

          {loading && <Spinner />}
          {error   && <ErrorBox message={error} onRetry={refetch} />}

          {primera && (
            <div className="cosecha-destacada">
              <div className="destacada-img" style={{ fontSize:64 }}>
                {emoji(primera.especie ?? primera.especie_nombre)}
              </div>
              <div className="destacada-overlay">
                <div className="destacada-tags">
                  <span className="badge badge-green">Cosecha</span>
                  {primera.cantidad_kg >= 2 && <span className="badge badge-amber">⭐ Gran cosecha</span>}
                </div>
                <p className="destacada-titulo">{primera.especie ?? primera.especie_nombre ?? "Cosecha registrada"}</p>
                <p className="destacada-autor">
                  ☀ {primera.cosechador ?? primera.vecino_nombre ?? "—"} · {parseFloat(primera.cantidad_kg || 0).toFixed(1)} kg
                </p>
                {primera.estado === "registrada" && (
                  <button onClick={() => distribuir(primera.id)}
                    style={{ marginTop:8, background:"rgba(255,255,255,.2)", border:"1.5px solid rgba(255,255,255,.6)", color:"#fff", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                    Distribuir entre vecinos
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="cosechas-grid">
            {resto.map((c, i) => (
              <div className="cosecha-mini" key={c.id || i}>
                <div className="mini-img" style={{ background: i%2===0 ? "#fff3e0" : "#e8f5e9", fontSize:36 }}>
                  {emoji(c.especie ?? c.especie_nombre)}
                </div>
                <p className="mini-sub">
                  {c.especie ?? c.especie_nombre} {c.cantidad_kg ? `– ${parseFloat(c.cantidad_kg).toFixed(1)} kg` : ""}
                </p>
                {c.estado === "registrada" && (
                  <button onClick={() => distribuir(c.id)}
                    style={{ fontSize:10, background:"var(--green-bright)", border:"none", borderRadius:6, padding:"3px 8px", fontWeight:700, cursor:"pointer", marginTop:4, color:"var(--green-dark)" }}>
                    Distribuir
                  </button>
                )}
              </div>
            ))}
          </div>

          {!loading && cosechas.length === 0 && (
            <div style={{ textAlign:"center", padding:"24px 0" }}>
              <p style={{ fontSize:32 }}>🌱</p>
              <p style={{ fontSize:13, color:"var(--text-muted)", fontWeight:700, marginTop:8 }}>
                Aún no hay cosechas registradas este mes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
