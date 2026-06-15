import { useApi } from "../useApi";
import { api }    from "../api";
import { Spinner } from "../components";
import "./Inicio.css";

export default function Inicio({ noLeidas, onBell, dash, onRecargar }) {
  const { data: rankResp, loading: rankLoad } = useApi(
    () => api.getRanking(new Date().getFullYear(), new Date().getMonth() + 1)
  );

  const riegoHoy    = dash?.riego_hoy      ?? [];
  const cosechasMes = dash?.cosechas_mes   ?? [];
  const proximos    = dash?.proximos_turnos ?? [];
  const pendientes  = riegoHoy.filter(t => t.estado === "pendiente" || t.estado === "incumplido");
  const totalKg     = cosechasMes.reduce((a, c) => a + parseFloat(c.total_kg || 0), 0);

  // Normalizar ranking — backend devuelve { ok, data: [...] }
  const ranking = [...(Array.isArray(rankResp?.data) ? rankResp.data : [])].sort(
    (a, b) => b.pct_cumplimiento - a.pct_cumplimiento
  );
  const medals = ["🥇","🥈","🥉"];

  return (
    <div className="inicio-screen">
      <div className="inicio-header">
        <div className="header-logo"><span>🌿</span><strong>Huerto Vivo</strong></div>
        <button className="header-bell" onClick={onBell} style={{ position:"relative" }}>
          🔔{noLeidas > 0 && <span className="bell-badge">{noLeidas}</span>}
        </button>
      </div>

      <div className="inicio-body">
        {/* Saludo */}
        <div className="greeting-card">
          <h1 className="greeting-title">¡Hola, vecino!</h1>
          <p className="greeting-sub">Es un buen día para cuidar el huerto.</p>
          <div className="greeting-stats">
            <div className="stat-box">
              <span className="stat-icon">☀️</span>
              <span className="stat-val">22°C</span>
              <span className="stat-lbl">Soleado</span>
            </div>
            <div className="stat-box highlight">
              <span className="stat-icon">🌱</span>
              <span className="stat-val">{pendientes.length} turnos</span>
              <span className="stat-lbl warn">pendientes hoy</span>
            </div>
            <div className="stat-box">
              <span className="stat-icon">🌾</span>
              <span className="stat-val">{totalKg.toFixed(1)} kg</span>
              <span className="stat-lbl">cosechados</span>
            </div>
          </div>
        </div>

        {/* Alerta turnos */}
        {pendientes.length > 0 && (
          <div className="alert-card">
            <span className="alert-icon">⚠️</span>
            <div>
              <p className="alert-title">Turnos Pendientes</p>
              <p className="alert-sub">
                {pendientes.length} turno{pendientes.length > 1 ? "s" : ""} sin regar hoy. ¡Revisa Riego!
              </p>
            </div>
          </div>
        )}

        {/* Distribución cosechas mes */}
        {cosechasMes.length > 0 && (
          <div className="card section-block">
            <p className="section-title">Cosechas del Mes</p>
            {cosechasMes.map((c, i) => {
              const pct = totalKg > 0 ? (parseFloat(c.total_kg) / totalKg) * 100 : 0;
              const colors = ["var(--green-bright)","var(--amber)","var(--green-lime)","#74c69d"];
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:12, fontWeight:700, width:70, color:"var(--text-dark)", flexShrink:0 }}>
                    {c.especie}
                  </span>
                  <div style={{ flex:1, height:8, background:"#e8ede8", borderRadius:4, overflow:"hidden" }}>
                    <div style={{ width:`${pct}%`, height:"100%", background:colors[i%colors.length], borderRadius:4 }} />
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--text-soft)", width:36, textAlign:"right" }}>
                    {parseFloat(c.total_kg).toFixed(1)}kg
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Ranking — ordenado por pct_cumplimiento DESC */}
        <div className="card section-block">
          <p className="section-title">Vecinos Activos</p>
          {rankLoad && <Spinner />}
          {ranking.slice(0, 5).map((v, i) => (
            <div className="vecino-row" key={i}>
              <span style={{ fontSize:16, width:22, textAlign:"center", flexShrink:0 }}>{medals[i] || `#${i+1}`}</span>
              <div className="avatar">{(v.vecino || "?")[0]}</div>
              <div className="vecino-info" style={{ flex:1, minWidth:0 }}>
                <p className="vecino-name" style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {v.vecino}
                </p>
                <div style={{ height:4, background:"#e8ede8", borderRadius:2, marginTop:4 }}>
                  <div style={{ width:`${v.pct_cumplimiento}%`, height:"100%", background:"var(--green-bright)", borderRadius:2 }} />
                </div>
              </div>
              <span style={{ fontSize:13, fontWeight:800, color:"var(--green-mid)", flexShrink:0 }}>
                {v.pct_cumplimiento}%
              </span>
            </div>
          ))}
          {ranking.length === 0 && !rankLoad && (
            <p style={{ fontSize:12, color:"var(--text-muted)", textAlign:"center", padding:"12px 0" }}>
              Sin datos de actividad este mes
            </p>
          )}
        </div>

        {/* Próximos turnos */}
        {proximos.length > 0 && (
          <div className="card section-block">
            <p className="section-title">Próximos Turnos</p>
            {proximos.map((t, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0",
                borderBottom: i < proximos.length-1 ? "1px solid var(--green-light)" : "none" }}>
                <div style={{ background:"#d8f3dc", borderRadius:8, padding:"4px 8px", fontSize:11, fontWeight:800, color:"var(--green-mid)", flexShrink:0 }}>
                  {t.fecha_turno}
                </div>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:"var(--text-dark)" }}>{t.responsable}</p>
                  <p style={{ fontSize:11, color:"var(--text-muted)" }}>{t.parcela}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comunidad */}
        <div className="section-block">
          <p className="section-title">Comunidad</p>
          <div className="comunidad-grid">
            <div className="comunidad-card">
              <div className="comunidad-img">🪱</div>
              <div className="comunidad-info">
                <span className="badge badge-green">Gratis</span>
                <p className="comunidad-title">Clase de Composta</p>
                <p className="comunidad-desc">Sábado 10 AM. Aprende a nutrir tu parcela.</p>
              </div>
            </div>
            <div className="comunidad-card">
              <div className="comunidad-img">🌻</div>
              <div className="comunidad-info">
                <span className="badge badge-amber">Recomendado</span>
                <p className="comunidad-title">Feria de Semillas</p>
                <p className="comunidad-desc">Trae tus semillas locales este domingo.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
