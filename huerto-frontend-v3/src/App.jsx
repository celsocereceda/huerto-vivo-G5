import { useState, useEffect, useCallback } from "react";
import Inicio     from "./screens/Inicio";
import Siembras   from "./screens/Siembras";
import Riego      from "./screens/Riego";
import Cosecha    from "./screens/Cosecha";
import Chat       from "./screens/Chat";
import Login      from "./screens/Login";
import NotifPanel from "./screens/NotifPanel";
import MapaHuerto from "./screens/MapaHuerto";
import Rotacion   from "./screens/Rotacion";
import { api }    from "./api";
import "./index.css";

// ── TABS ─────────────────────────────────────────────────
const TABS_MIEMBRO = [
  { id:"inicio",   label:"Inicio",  icon:"🏠" },
  { id:"siembras", label:"Siembras",icon:"🌱" },
  { id:"riego",    label:"Riego",   icon:"💧" },
  { id:"cosecha",  label:"Cosecha", icon:"🍅" },
  { id:"chat",     label:"Chat",    icon:"💬" },
];
const TABS_COORD = [
  { id:"inicio",   label:"Inicio",  icon:"🏠" },
  { id:"riego",    label:"Riego",   icon:"💧" },
  { id:"mapa",     label:"Mapa",    icon:"🗺️" },
  { id:"rotacion", label:"Turnos",  icon:"🔄" },
  { id:"chat",     label:"Chat",    icon:"💬" },
];

// ── MODO OFFLINE ─────────────────────────────────────────
// Cola de acciones pendientes cuando no hay conexión
const COLA_KEY = "huerto_cola_offline";

function cargarCola() {
  try { return JSON.parse(localStorage.getItem(COLA_KEY) || "[]"); } catch { return []; }
}
function guardarCola(cola) {
  localStorage.setItem(COLA_KEY, JSON.stringify(cola));
}

async function procesarCola(showToast) {
  const cola = cargarCola();
  if (cola.length === 0) return;
  const pendientes = [];
  let procesados = 0;

  for (const accion of cola) {
    try {
      if (accion.tipo === "marcarTurno") {
        await api.marcarCumplido(accion.turnoId);
        procesados++;
      } else if (accion.tipo === "enviarMensaje") {
        await api.enviarMensaje(accion.texto);
        procesados++;
      }
    } catch {
      pendientes.push(accion); // Si falla, queda en la cola
    }
  }
  guardarCola(pendientes);
  if (procesados > 0) showToast(`📡 ${procesados} acción${procesados > 1 ? "es" : ""} sincronizada${procesados > 1 ? "s" : ""}`);
}

// ── TOAST ─────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, []);
  return <div className="toast">{msg}</div>;
}

// ── BANNER OFFLINE ─────────────────────────────────────────
function BannerOffline({ cola }) {
  return (
    <div className="banner-offline">
      <span>📵 Sin conexión</span>
      {cola > 0 && <span className="offline-cola">{cola} acción{cola > 1 ? "es" : ""} en cola</span>}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────
export default function App() {
  const [active,    setActive]   = useState("inicio");
  const [logueado,  setLogueado] = useState(!!localStorage.getItem("token"));
  const [notifs,    setNotifs]   = useState([]);
  const [showNotif, setShowNotif]= useState(false);
  const [toast,     setToast]    = useState(null);
  const [dash,      setDash]     = useState(null);
  const [online,    setOnline]   = useState(navigator.onLine);
  const [colaSize,  setColaSize] = useState(cargarCola().length);

  const vecino = (() => {
    try { return JSON.parse(localStorage.getItem("vecino") || "null"); } catch { return null; }
  })();
  const esCoord = vecino?.rol === "coordinador";
  const tabs    = esCoord ? TABS_COORD : TABS_MIEMBRO;

  const showToast = useCallback((msg) => setToast(msg), []);

  // ── Detectar conectividad ───────────────────────────────
  useEffect(() => {
    const goOnline = async () => {
      setOnline(true);
      await procesarCola(showToast);
      setColaSize(cargarCola().length);
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [showToast]);

  // ── Función para acciones offline-safe ─────────────────
  const accionOfflineSafe = useCallback(async (tipo, payload, apiFn) => {
    if (navigator.onLine) {
      return apiFn();
    } else {
      const cola = cargarCola();
      cola.push({ tipo, ...payload, ts: Date.now() });
      guardarCola(cola);
      setColaSize(cola.length);
      showToast(`📵 Sin conexión — se sincronizará cuando vuelvas a conectarte`);
      return null;
    }
  }, [showToast]);

  // ── Cargar datos ────────────────────────────────────────
  const cargarNotifs = useCallback(() => {
    if (!navigator.onLine) return;
    api.getNotificaciones()
      .then(r => setNotifs(r.data || []))
      .catch(() => {});
  }, []);

  const cargarDash = useCallback(() => {
    if (!navigator.onLine) return;
    api.getDashboard()
      .then(r => { if (r.ok) setDash(r.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (logueado) { cargarNotifs(); cargarDash(); }
  }, [logueado]);

  // Recargar datos cada 60s si está online
  useEffect(() => {
    if (!logueado) return;
    const iv = setInterval(() => {
      if (navigator.onLine) { cargarDash(); cargarNotifs(); }
    }, 60000);
    return () => clearInterval(iv);
  }, [logueado, cargarDash, cargarNotifs]);

  const noLeidas = notifs.filter(n => !n.leida).length;

  const cerrarSesion = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("vecino");
    setLogueado(false);
    setDash(null);
    setNotifs([]);
    setActive("inicio");
  };

  const marcarLeida = async (id) => {
    await api.marcarLeida(id).catch(() => {});
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  };
  const marcarTodas = async () => {
    await api.marcarTodasLeidas().catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
  };

  if (!logueado) {
    return <div className="app-shell"><Login onLogin={() => setLogueado(true)} /></div>;
  }

  const sharedProps = {
    noLeidas, onBell: () => setShowNotif(true),
    showToast, dash, onRecargar: cargarDash,
    accionOfflineSafe,
  };

  const screens = {
    inicio:   <Inicio   {...sharedProps} />,
    siembras: <Siembras {...sharedProps} />,
    riego:    <Riego    {...sharedProps} />,
    cosecha:  <Cosecha  {...sharedProps} />,
    chat:     <Chat     {...sharedProps} />,
    mapa:     <MapaHuerto {...sharedProps} />,
    rotacion: <Rotacion {...sharedProps} />,
  };

  return (
    <div className="app-shell">
      {/* Banner offline */}
      {!online && <BannerOffline cola={colaSize} />}

      {/* Barra de sesión */}
      <div className="session-bar">
        <span className="sesion-nombre">
          {vecino?.nombre} {vecino?.apellido}
          {esCoord && " 🌿"}
          {!online && " 📵"}
        </span>
        <button className="btn-sesion" onClick={cerrarSesion}>← Cerrar sesión</button>
      </div>

      <div className="screen-content">{screens[active] ?? screens["inicio"]}</div>

      <nav className="bottom-nav">
        {tabs.map(t => (
          <button key={t.id}
            className={`nav-btn ${active === t.id ? "active" : ""}`}
            onClick={() => setActive(t.id)}>
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {showNotif && (
        <NotifPanel notifs={notifs} onClose={() => setShowNotif(false)}
          onMarcarLeida={marcarLeida} onMarcarTodas={marcarTodas}
          esCoord={esCoord} showToast={showToast} onNotifsChange={cargarNotifs} />
      )}

      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
