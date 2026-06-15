import { useState } from "react";
import { useApi }   from "../useApi";
import { api }      from "../api";
import { Spinner }  from "../components";
import "./MapaHuerto.css";

const COLORES = {
  ocupada_regada:     { bg:"#d8f3dc", borde:"#52b788", emoji:"✅" },
  ocupada_pendiente:  { bg:"#fef3c7", borde:"#d97706", emoji:"⏳" },
  ocupada_incumplido: { bg:"#fee2e2", borde:"#e53e3e", emoji:"❌" },
  ocupada_sinturno:   { bg:"#e8f5e9", borde:"#95d5b2", emoji:"🌱" },
  disponible:         { bg:"#f8f5f0", borde:"#c8e6c9", emoji:"➕" },
  en_descanso:        { bg:"#f0ece4", borde:"#d4b896", emoji:"😴" },
};

function estadoCelda(p) {
  if (p.estado_parcela === "disponible") return "disponible";
  if (p.estado_parcela === "en_descanso") return "en_descanso";
  if (!p.estado_riego_hoy) return "ocupada_sinturno";
  return `ocupada_${p.estado_riego_hoy}`;
}

function TooltipParcela({ p, onClose }) {
  return (
    <div className="mapa-tooltip" onClick={onClose}>
      <div className="tooltip-card" onClick={e => e.stopPropagation()}>
        <div className="tooltip-header">
          <span className="tooltip-codigo">{p.codigo}</span>
          <button className="tooltip-close" onClick={onClose}>✕</button>
        </div>
        <div className="tooltip-body">
          {p.cultivo ? (
            <>
              <div className="tooltip-row">
                <span className="tooltip-label">🌱 Cultivo</span>
                <span className="tooltip-val">{p.cultivo}</span>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-label">👤 Responsable</span>
                <span className="tooltip-val">{p.responsable_siembra ?? "—"}</span>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-label">📅 Sembrado</span>
                <span className="tooltip-val">
                  {p.fecha_siembra ? new Date(p.fecha_siembra).toLocaleDateString("es-CL", { day:"numeric", month:"short" }) : "—"}
                </span>
              </div>
              {p.fecha_cosecha_estimada && (
                <div className="tooltip-row">
                  <span className="tooltip-label">🎯 Cosecha est.</span>
                  <span className="tooltip-val">
                    {new Date(p.fecha_cosecha_estimada).toLocaleDateString("es-CL", { day:"numeric", month:"short" })}
                  </span>
                </div>
              )}
              {p.progreso !== null && (
                <div className="tooltip-progreso">
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:"var(--text-soft)" }}>Crecimiento</span>
                    <span style={{ fontSize:11, fontWeight:800, color:"var(--green-mid)" }}>{p.progreso}%</span>
                  </div>
                  <div style={{ height:6, background:"#e8f0ea", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ width:`${p.progreso}%`, height:"100%", background:"var(--green-bright)", borderRadius:3 }}/>
                  </div>
                </div>
              )}
              <div className="tooltip-divider" />
              <div className="tooltip-row">
                <span className="tooltip-label">💧 Riego hoy</span>
                <span className={`estado-chip estado-${p.estado_riego_hoy ?? "sinturno"}`}>
                  {p.estado_riego_hoy === "cumplido" ? "✅ Regado"
                    : p.estado_riego_hoy === "incumplido" ? "❌ No regó"
                    : p.estado_riego_hoy === "pendiente" ? "⏳ Pendiente"
                    : "Sin turno"}
                </span>
              </div>
              {p.responsable_riego_hoy && (
                <div className="tooltip-row">
                  <span className="tooltip-label">👤 Responsable</span>
                  <span className="tooltip-val">{p.responsable_riego_hoy}</span>
                </div>
              )}
              {p.hora_regado && (
                <div className="tooltip-row">
                  <span className="tooltip-label">🕐 Regado a las</span>
                  <span className="tooltip-val">
                    {new Date(p.hora_regado).toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" })}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign:"center", padding:"16px 0" }}>
              <p style={{ fontSize:28 }}>
                {p.estado_parcela === "en_descanso" ? "😴" : "➕"}
              </p>
              <p style={{ fontSize:13, fontWeight:700, color:"var(--text-soft)", marginTop:6 }}>
                {p.estado_parcela === "en_descanso" ? "En descanso" : "Disponible para siembra"}
              </p>
              <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:3 }}>
                {p.descripcion ?? ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MapaHuerto({ noLeidas, onBell, showToast }) {
  const { data: mapaResp, loading, refetch } = useApi(api.getMapa);
  const [seleccionada, setSeleccionada] = useState(null);
  const [filtro, setFiltro] = useState("todas");

  const parcelas = Array.isArray(mapaResp?.data?.parcelas)
    ? mapaResp.data.parcelas : [];
  const resumen  = mapaResp?.data?.resumen ?? {};
  const grilla   = mapaResp?.data?.grilla  ?? { filas: 6, columnas: 3 };

  // Construir matriz de la grilla
  const matriz = [];
  for (let f = 1; f <= grilla.filas; f++) {
    const fila = [];
    for (let c = 1; c <= grilla.columnas; c++) {
      const parcela = parcelas.find(p => p.ubicacion_fila === f && p.ubicacion_col === c);
      fila.push(parcela || null);
    }
    matriz.push(fila);
  }

  // Filtrar según selección
  const parcelasVisibles = filtro === "todas" ? parcelas
    : filtro === "pendientes" ? parcelas.filter(p => p.estado_riego_hoy === "pendiente")
    : filtro === "regadas"    ? parcelas.filter(p => p.estado_riego_hoy === "cumplido")
    : filtro === "disponibles"? parcelas.filter(p => p.estado_parcela === "disponible")
    : parcelas;

  const filtrosConfig = [
    { id:"todas",      label:"Todas",       count: parcelas.length },
    { id:"regadas",    label:"✅ Regadas",  count: resumen.regadas_hoy ?? 0 },
    { id:"pendientes", label:"⏳ Pendientes",count: parcelas.filter(p=>p.estado_riego_hoy==="pendiente").length },
    { id:"disponibles",label:"➕ Libres",   count: resumen.disponibles ?? 0 },
  ];

  return (
    <div className="mapa-screen">
      <div className="screen-header">
        <div className="header-logo"><span>🌿</span><strong>Mapa del Huerto</strong></div>
        <button className="header-bell" onClick={onBell} style={{ position:"relative" }}>
          🔔{noLeidas > 0 && <span className="bell-badge">{noLeidas}</span>}
        </button>
      </div>

      <div className="mapa-body">
        {/* KPIs rápidos */}
        <div className="mapa-kpis">
          <div className="mapa-kpi">
            <span className="kpi-num">{resumen.ocupadas ?? 0}</span>
            <span className="kpi-lbl">Ocupadas</span>
          </div>
          <div className="mapa-kpi verde">
            <span className="kpi-num">{resumen.regadas_hoy ?? 0}</span>
            <span className="kpi-lbl">Regadas hoy</span>
          </div>
          <div className="mapa-kpi amarillo">
            <span className="kpi-num">{parcelas.filter(p=>p.estado_riego_hoy==="pendiente").length}</span>
            <span className="kpi-lbl">Pendientes</span>
          </div>
          <div className="mapa-kpi gris">
            <span className="kpi-num">{resumen.disponibles ?? 0}</span>
            <span className="kpi-lbl">Libres</span>
          </div>
        </div>

        {/* Filtros */}
        <div className="mapa-filtros">
          {filtrosConfig.map(f => (
            <button key={f.id}
              className={`filtro-btn ${filtro === f.id ? "activo" : ""}`}
              onClick={() => setFiltro(f.id)}>
              {f.label} <span className="filtro-count">{f.count}</span>
            </button>
          ))}
        </div>

        {loading && <Spinner />}

        {/* GRILLA VISUAL */}
        {!loading && (
          <div className="mapa-container">
            <p className="mapa-instruccion">Toca una parcela para ver detalles</p>
            <div className="mapa-grilla" style={{ gridTemplateColumns: `repeat(${grilla.columnas}, 1fr)` }}>
              {matriz.map((fila, fi) =>
                fila.map((parcela, ci) => {
                  if (!parcela) return (
                    <div key={`vacio-${fi}-${ci}`} className="celda-vacia" />
                  );
                  const estado = estadoCelda(parcela);
                  const color  = COLORES[estado] ?? COLORES["disponible"];
                  const esVisible = filtro === "todas" || parcelasVisibles.some(p => p.id === parcela.id);
                  return (
                    <div key={parcela.id}
                      className={`celda-parcela ${!esVisible ? "opaca" : ""}`}
                      style={{ background: color.bg, borderColor: color.borde }}
                      onClick={() => setSeleccionada(parcela)}>
                      <span className="celda-emoji">{color.emoji}</span>
                      <span className="celda-codigo">{parcela.codigo}</span>
                      {parcela.cultivo && (
                        <span className="celda-cultivo">{parcela.cultivo.slice(0,8)}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Leyenda */}
            <div className="mapa-leyenda">
              {[
                { color:"#d8f3dc", borde:"#52b788", label:"Regada ✅" },
                { color:"#fef3c7", borde:"#d97706", label:"Pendiente ⏳" },
                { color:"#fee2e2", borde:"#e53e3e", label:"No regó ❌" },
                { color:"#e8f5e9", borde:"#95d5b2", label:"Sin turno 🌱" },
                { color:"#f8f5f0", borde:"#c8e6c9", label:"Libre ➕" },
                { color:"#f0ece4", borde:"#d4b896", label:"Descanso 😴" },
              ].map((l, i) => (
                <div key={i} className="leyenda-item">
                  <div className="leyenda-color" style={{ background:l.color, borderColor:l.borde }}/>
                  <span className="leyenda-label">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tooltip al seleccionar parcela */}
      {seleccionada && (
        <TooltipParcela p={seleccionada} onClose={() => setSeleccionada(null)} />
      )}
    </div>
  );
}
