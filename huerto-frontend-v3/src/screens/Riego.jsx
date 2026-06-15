import { useState } from "react";
import { useApi }   from "../useApi";
import { api }      from "../api";
import { Spinner, ErrorBox } from "../components";
import "./Riego.css";

export default function Riego({ noLeidas, onBell, showToast, onRecargar }) {
  const { data: turnosResp, loading, error, refetch } = useApi(api.getTurnosHoy);
  const { data: proxResp }  = useApi(api.getProximos);
  const [marcando, setMarcando] = useState(null);

  const vecino = (() => {
    try { return JSON.parse(localStorage.getItem("vecino") || "null"); } catch { return null; }
  })();

  // Normalizar respuesta del backend
  const hoy  = Array.isArray(turnosResp?.data) ? turnosResp.data
    : Array.isArray(turnosResp) ? turnosResp : [];
  const prox = Array.isArray(proxResp?.data) ? proxResp.data
    : Array.isArray(proxResp) ? proxResp : [];

  // Separar mi turno del resto
  const miTurno = hoy.find(t =>
    t.vecino_id === vecino?.id ||
    (t.responsable ?? t.vecino_nombre ?? "")
      .toLowerCase()
      .includes((vecino?.nombre ?? "").toLowerCase())
  );
  const turnosOtros = hoy.filter(t => t.id !== miTurno?.id);

  // Estadísticas del día
  const totalHoy      = hoy.length;
  const cumplidos     = hoy.filter(t => t.estado === "cumplido").length;
  const pendientes    = hoy.filter(t => t.estado === "pendiente").length;
  const incumplidos   = hoy.filter(t => t.estado === "incumplido").length;
  const pctAvance     = totalHoy > 0 ? Math.round((cumplidos / totalHoy) * 100) : 0;

  async function marcar(turno) {
    setMarcando(turno.id);
    try {
      await api.marcarCumplido(turno.id);
      showToast("💧 ¡Turno registrado en la base de datos!");
      refetch();
      onRecargar();
    } catch (e) {
      showToast("Error: " + e.message);
    }
    setMarcando(null);
  }

  const hoyDate = new Date();
  const diasSemana = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

  return (
    <div className="riego-screen">
      {/* HEADER */}
      <div className="screen-header">
        <div className="header-logo"><span>🌿</span><strong>Huerto Vivo</strong></div>
        <button className="header-bell" onClick={onBell} style={{ position:"relative" }}>
          🔔{noLeidas > 0 && <span className="bell-badge">{noLeidas}</span>}
        </button>
      </div>

      <div className="riego-body">

        {/* FECHA Y CLIMA */}
        <div className="riego-fecha-card">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <p className="fecha-txt">
                {diasSemana[hoyDate.getDay()]}, {hoyDate.getDate()} de{" "}
                {hoyDate.toLocaleDateString("es-CL", { month:"long" })}
              </p>
              <div className="clima-row">
                <span className="clima-icon">☀️</span>
                <span className="clima-txt">Mañana soleada · ideal para riego profundo</span>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <p style={{ fontSize:11, color:"var(--text-muted)", fontWeight:700 }}>Avance hoy</p>
              <p style={{ fontSize:22, fontWeight:900, color: pctAvance === 100 ? "var(--green-bright)" : "var(--text-dark)" }}>
                {pctAvance}%
              </p>
            </div>
          </div>

          {/* Barra de progreso del día */}
          {totalHoy > 0 && (
            <div>
              <div style={{ height:8, background:"#e8f0ea", borderRadius:4, overflow:"hidden", marginTop:8 }}>
                <div style={{
                  height:"100%", borderRadius:4, transition:"width .5s ease",
                  width:`${pctAvance}%`,
                  background: pctAvance === 100 ? "var(--green-bright)" : "var(--green-mid)"
                }}/>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
                <span style={{ fontSize:11, fontWeight:700, color:"var(--green-mid)" }}>✅ {cumplidos} regadas</span>
                <span style={{ fontSize:11, fontWeight:700, color:"#92400e" }}>⏳ {pendientes} pendientes</span>
                {incumplidos > 0 && (
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--red-soft)" }}>❌ {incumplidos} sin regar</span>
                )}
              </div>
            </div>
          )}
        </div>

        {loading && <Spinner />}
        {error   && <ErrorBox message={error} onRetry={refetch} />}

        {/* MI TURNO — destacado */}
        {miTurno && (
          <div className="mi-turno-card">
            <div className="mi-turno-header">
              <span className="mi-turno-label">💧 Tu turno hoy</span>
              <span className={`estado-chip estado-${miTurno.estado}`}>
                {miTurno.estado === "cumplido" ? "✅" : miTurno.estado === "incumplido" ? "❌" : "⏳"} {miTurno.estado}
              </span>
            </div>

            <div className="mi-turno-info">
              <div className="mi-turno-parcela">
                <span className="parcela-icono">🌿</span>
                <div>
                  <p className="parcela-cod">{miTurno.parcela_codigo ?? `Parcela ${miTurno.parcela_id}`}</p>
                  <p className="parcela-desc">{miTurno.parcela_desc ?? "Parcela del huerto comunitario"}</p>
                </div>
              </div>
              <div className="mi-turno-hora">
                <p style={{ fontSize:11, color:"var(--text-muted)", fontWeight:700 }}>Horario sugerido</p>
                <p style={{ fontSize:14, fontWeight:800, color:"var(--text-dark)" }}>18:00 – 19:30 hrs</p>
                {miTurno.hora_cumplido && (
                  <p style={{ fontSize:11, color:"var(--green-mid)", fontWeight:700, marginTop:2 }}>
                    ✓ Regado a las {new Date(miTurno.hora_cumplido).toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" })}
                  </p>
                )}
              </div>
            </div>

            <button
              className={`btn-riego ${miTurno.estado === "cumplido" ? "marcado" : ""}`}
              onClick={() => miTurno.estado !== "cumplido" && marcar(miTurno)}
              disabled={miTurno.estado === "cumplido" || marcando === miTurno.id}
            >
              {marcando === miTurno.id
                ? "Guardando en BD..."
                : miTurno.estado === "cumplido"
                ? "✅ Ya regaste hoy — ¡Gracias!"
                : "💧 Marcar como Regado"}
            </button>
          </div>
        )}

        {/* Sin turno asignado hoy */}
        {!loading && !miTurno && hoy.length >= 0 && (
          <div className="sin-turno-card">
            <span style={{ fontSize:36 }}>🌱</span>
            <div>
              <p style={{ fontWeight:800, color:"var(--text-dark)", fontSize:14 }}>Sin turno asignado hoy</p>
              <p style={{ fontSize:12, color:"var(--text-soft)", marginTop:3 }}>
                Puedes ayudar a un vecino si lo necesita
              </p>
            </div>
          </div>
        )}

        {/* ESTADO DEL RIEGO HOY — todos los vecinos */}
        {hoy.length > 0 && (
          <div className="estado-hoy-card">
            <p className="section-title" style={{ marginBottom:12 }}>Estado del Riego Hoy</p>

            {/* Resumen visual rápido */}
            <div className="resumen-chips">
              <div className="resumen-chip verde">
                <span className="chip-num">{cumplidos}</span>
                <span className="chip-lbl">Regaron</span>
              </div>
              <div className="resumen-chip amarillo">
                <span className="chip-num">{pendientes}</span>
                <span className="chip-lbl">Pendientes</span>
              </div>
              <div className="resumen-chip rojo">
                <span className="chip-num">{incumplidos}</span>
                <span className="chip-lbl">No regaron</span>
              </div>
            </div>

            {/* Lista detallada */}
            <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
              {hoy.map((t, i) => {
                const esMio = t.id === miTurno?.id;
                return (
                  <div key={t.id || i} className={`vecino-turno-row ${esMio ? "mio" : ""}`}>
                    <div className="vt-avatar"
                      style={{ background: t.estado === "cumplido" ? "var(--green-mid)"
                        : t.estado === "incumplido" ? "var(--red-soft)" : "var(--amber)" }}>
                      {(t.responsable ?? t.vecino_nombre ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="vt-info">
                      <p className="vt-nombre">
                        {t.responsable ?? t.vecino_nombre ?? "—"}
                        {esMio && <span className="vt-yo"> (tú)</span>}
                      </p>
                      <p className="vt-parcela">{t.parcela_codigo ?? `Parcela ${t.parcela_id}`}</p>
                    </div>
                    <div className="vt-derecha">
                      <span className={`estado-chip estado-${t.estado}`}>
                        {t.estado === "cumplido" ? "✅" : t.estado === "incumplido" ? "❌" : "⏳"} {t.estado}
                      </span>
                      {t.hora_cumplido && (
                        <p className="vt-hora">
                          {new Date(t.hora_cumplido).toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PRÓXIMOS TURNOS */}
        {prox.length > 0 && (
          <div>
            <p className="section-title">Próximos Turnos</p>
            <div className="proximos-list">
              {prox.map((t, i) => {
                const d = new Date(t.fecha_turno);
                const dias = ["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"];
                const esMioProx = (t.vecino_id === vecino?.id) ||
                  (t.responsable ?? t.vecino_nombre ?? "").toLowerCase()
                    .includes((vecino?.nombre ?? "").toLowerCase());
                return (
                  <div className={`proximo-item ${esMioProx ? "proximo-mio" : ""}`} key={t.id || i}>
                    <div className="proximo-fecha">
                      <span className="proximo-dia">{dias[d.getDay()]}</span>
                      <span className="proximo-num">{d.getDate()}</span>
                    </div>
                    <span className="proximo-icon">💧</span>
                    <div className="proximo-info">
                      <p className="proximo-desc">
                        {t.parcela_codigo ?? "Parcela"}
                        {esMioProx && <span style={{ marginLeft:6, fontSize:10, background:"var(--green-pale)", color:"var(--green-mid)", padding:"2px 6px", borderRadius:8, fontWeight:800 }}>Tu turno</span>}
                      </p>
                      <p className="proximo-sub">👤 {t.responsable ?? t.vecino_nombre ?? "—"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sin turnos en absoluto */}
        {!loading && hoy.length === 0 && (
          <div style={{ textAlign:"center", padding:"32px 20px" }}>
            <p style={{ fontSize:40 }}>💧</p>
            <p style={{ fontWeight:800, color:"var(--text-dark)", marginTop:8 }}>No hay turnos asignados hoy</p>
            <p style={{ fontSize:12, color:"var(--text-soft)", marginTop:4 }}>
              El coordinador aún no ha asignado los turnos de hoy
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
