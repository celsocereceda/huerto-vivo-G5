import { useState } from "react";
import { api }      from "../api";
import "./Rotacion.css";

export default function Rotacion({ noLeidas, onBell, showToast }) {
  const hoy = new Date().toISOString().split("T")[0];
  const finMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split("T")[0];

  const [form, setForm] = useState({
    fecha_inicio:   hoy,
    fecha_fin:      finMes,
    dias_intervalo: 3,
  });
  const [preview,    setPreview]    = useState(null);
  const [resultado,  setResultado]  = useState(null);
  const [cargando,   setCargando]   = useState(false);
  const [paso,       setPaso]       = useState(1); // 1=config, 2=preview, 3=resultado

  async function verPreview() {
    setCargando(true);
    try {
      const res = await api.previewRotacion(form);
      setPreview(res.data);
      setPaso(2);
    } catch (e) {
      showToast("Error: " + e.message);
    }
    setCargando(false);
  }

  async function confirmarRotacion() {
    setCargando(true);
    try {
      const res = await api.generarRotacion({
        fecha_inicio:   form.fecha_inicio,
        fecha_fin:      form.fecha_fin,
        dias_intervalo: form.dias_intervalo,
        solo_activos:   true,
      });
      setResultado(res.data);
      setPaso(3);
      showToast("✅ Rotación generada en la base de datos");
    } catch (e) {
      showToast("Error: " + e.message);
    }
    setCargando(false);
  }

  async function enviarRecordatorios() {
    setCargando(true);
    try {
      const res = await api.enviarRecordatorios();
      showToast(`🔔 ${res.message}`);
    } catch (e) {
      showToast("Error: " + e.message);
    }
    setCargando(false);
  }

  async function limpiarTurnos() {
    setCargando(true);
    try {
      const res = await api.limpiarTurnos(form.fecha_inicio);
      showToast(`🗑 ${res.message}`);
      setPaso(1);
      setPreview(null);
      setResultado(null);
    } catch (e) {
      showToast("Error: " + e.message);
    }
    setCargando(false);
  }

  return (
    <div className="rot-screen">
      <div className="screen-header">
        <div className="header-logo"><span>🌿</span><strong>Rotación de Turnos</strong></div>
        <button className="header-bell" onClick={onBell} style={{ position:"relative" }}>
          🔔{noLeidas > 0 && <span className="bell-badge">{noLeidas}</span>}
        </button>
      </div>

      <div className="rot-body">
        {/* INDICADOR DE PASOS */}
        <div className="rot-pasos">
          {["Configurar","Vista previa","Confirmado"].map((lb, i) => (
            <div key={i} className={`rot-paso ${paso === i+1 ? "activo" : paso > i+1 ? "done" : ""}`}>
              <div className="paso-circulo">{paso > i+1 ? "✓" : i+1}</div>
              <span className="paso-label">{lb}</span>
            </div>
          ))}
        </div>

        {/* PASO 1: CONFIGURACIÓN */}
        {paso === 1 && (
          <div className="rot-card">
            <h2 className="rot-titulo">Configurar Rotación</h2>
            <p className="rot-sub">
              El sistema distribuirá los turnos de riego entre todos los vecinos activos,
              rotando automáticamente entre las parcelas con siembras activas.
            </p>

            <div className="rot-form">
              <div className="rot-field">
                <label className="form-label">Fecha de inicio</label>
                <input className="form-input" type="date" value={form.fecha_inicio}
                  onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
              <div className="rot-field">
                <label className="form-label">Fecha de fin</label>
                <input className="form-input" type="date" value={form.fecha_fin}
                  onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
              </div>
            </div>

            <div className="rot-field" style={{ marginTop:14 }}>
              <label className="form-label">Intervalo de rotación</label>
              <div className="intervalo-btns">
                {[1,2,3,4,5].map(n => (
                  <button key={n}
                    className={`intervalo-btn ${form.dias_intervalo === n ? "sel" : ""}`}
                    onClick={() => setForm(f => ({ ...f, dias_intervalo: n }))}>
                    {n}d
                  </button>
                ))}
              </div>
              <p className="rot-hint">
                Cada vecino recibirá un turno cada {form.dias_intervalo} día{form.dias_intervalo > 1 ? "s" : ""}
              </p>
            </div>

            <button className="btn-primary" style={{ marginTop:20 }}
              onClick={verPreview} disabled={cargando}>
              {cargando ? "Calculando..." : "👁 Ver Vista Previa"}
            </button>

            <div className="rot-acciones-extra">
              <button className="btn-extra" onClick={enviarRecordatorios} disabled={cargando}>
                🔔 Enviar recordatorios de mañana
              </button>
              <button className="btn-extra danger" onClick={limpiarTurnos} disabled={cargando}>
                🗑 Limpiar turnos pendientes futuros
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: VISTA PREVIA */}
        {paso === 2 && preview && (
          <div className="rot-card">
            <div className="preview-header">
              <div>
                <h2 className="rot-titulo">Vista Previa</h2>
                <p className="rot-sub">Revisa antes de confirmar</p>
              </div>
              <button className="btn-volver" onClick={() => setPaso(1)}>← Volver</button>
            </div>

            <div className="preview-stats">
              <div className="pstat">
                <span className="pstat-num">{preview.total_estimado}</span>
                <span className="pstat-lbl">Turnos a crear</span>
              </div>
              <div className="pstat">
                <span className="pstat-num">{preview.vecinos}</span>
                <span className="pstat-lbl">Vecinos</span>
              </div>
              <div className="pstat">
                <span className="pstat-num">{preview.parcelas}</span>
                <span className="pstat-lbl">Parcelas</span>
              </div>
            </div>

            <p className="form-label" style={{ marginBottom:8 }}>Primeros 30 turnos generados:</p>
            <div className="preview-lista">
              {preview.preview.map((t, i) => (
                <div key={i} className="preview-row">
                  <span className="prev-fecha">{t.fecha}</span>
                  <span className="prev-parcela">{t.parcela}</span>
                  <span className="prev-vecino">👤 {t.vecino}</span>
                </div>
              ))}
            </div>

            {preview.total_estimado > 30 && (
              <p style={{ fontSize:11, color:"var(--text-muted)", textAlign:"center", marginTop:8 }}>
                ... y {preview.total_estimado - 30} turnos más
              </p>
            )}

            <button className="btn-primary" style={{ marginTop:16 }}
              onClick={confirmarRotacion} disabled={cargando}>
              {cargando ? "Guardando en BD..." : "✅ Confirmar y Guardar en BD"}
            </button>
          </div>
        )}

        {/* PASO 3: RESULTADO */}
        {paso === 3 && resultado && (
          <div className="rot-card">
            <div style={{ textAlign:"center", padding:"16px 0" }}>
              <p style={{ fontSize:48 }}>🎉</p>
              <h2 className="rot-titulo" style={{ textAlign:"center", marginTop:8 }}>
                ¡Rotación Creada!
              </h2>
              <p className="rot-sub" style={{ textAlign:"center" }}>
                Los turnos fueron guardados exitosamente en la base de datos
              </p>
            </div>

            <div className="resultado-stats">
              {[
                { emoji:"📅", num: resultado.turnos_creados,  lbl:"Turnos creados" },
                { emoji:"⏭",  num: resultado.turnos_omitidos, lbl:"Ya existían" },
                { emoji:"👥", num: resultado.vecinos,          lbl:"Vecinos" },
                { emoji:"🌱", num: resultado.parcelas,         lbl:"Parcelas" },
              ].map((s, i) => (
                <div key={i} className="res-stat">
                  <span className="res-emoji">{s.emoji}</span>
                  <span className="res-num">{s.num}</span>
                  <span className="res-lbl">{s.lbl}</span>
                </div>
              ))}
            </div>

            <div className="resultado-info">
              <p>📆 Período: <strong>{resultado.periodo}</strong></p>
              <p>🔄 Intervalo: <strong>{resultado.intervalo}</strong></p>
            </div>

            <button className="btn-primary" style={{ marginTop:16 }}
              onClick={() => { setPaso(1); setPreview(null); setResultado(null); }}>
              Crear otra rotación
            </button>

            <button className="btn-extra" style={{ marginTop:8 }}
              onClick={enviarRecordatorios} disabled={cargando}>
              🔔 Enviar recordatorios de mañana ahora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
