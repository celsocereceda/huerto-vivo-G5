import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api";
import "./Chat.css";

export default function Chat({ noLeidas, onBell }) {
  const [msgs,     setMsgs]     = useState([]);
  const [input,    setInput]    = useState("");
  const [enviando, setEnviando] = useState(false);
  const bottomRef = useRef(null);

  const vecino = (() => {
    try { return JSON.parse(localStorage.getItem("vecino") || "null"); } catch { return null; }
  })();

  const cargar = useCallback(() => {
    api.getMensajes()
      .then(r => { if (r.ok) setMsgs(r.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
    const iv = setInterval(cargar, 8000);
    return () => clearInterval(iv);
  }, [cargar]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function send() {
    if (!input.trim() || enviando) return;
    const txt = input.trim();
    setInput(""); setEnviando(true);
    // Optimistic
    setMsgs(prev => [...prev, {
      id: Date.now(), vecino_id: vecino?.id, autor: `${vecino?.nombre} ${vecino?.apellido}`,
      nombre: vecino?.nombre, texto: txt, created_at: new Date().toISOString(), _propio: true
    }]);
    try {
      await api.enviarMensaje(txt);
      cargar();
    } catch { cargar(); }
    setEnviando(false);
  }

  const miId = vecino?.id;

  return (
    <div className="chat-screen">
      <div className="screen-header">
        <div className="header-logo"><span>🌿</span><strong>Huerto Vivo</strong></div>
        <button className="header-bell" onClick={onBell} style={{ position:"relative" }}>
          🔔{noLeidas > 0 && <span className="bell-badge">{noLeidas}</span>}
        </button>
      </div>

      <div className="chat-subheader">
        <span className="chat-group-icon">🌾</span>
        <span className="chat-group-name">Chat Comunitario</span>
        <span className="chat-online">● Mensajes guardados en BD</span>
      </div>

      <div className="chat-messages">
        {msgs.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-muted)" }}>
            <p style={{ fontSize:32, marginBottom:8 }}>💬</p>
            <p style={{ fontSize:13, fontWeight:600 }}>Sé el primero en escribir</p>
          </div>
        )}
        {msgs.map((m) => {
          const esPropio = m._propio || m.vecino_id === miId;
          const inicial = (m.nombre || m.autor || "?")[0]?.toUpperCase();
          const hora = new Date(m.created_at).toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" });

          if (esPropio) return (
            <div key={m.id} className="msg-wrap yo">
              <div className="msg-yo-wrap">
                <div className="msg-bubble yo">{m.texto}</div>
                <p className="msg-hora yo">{hora}</p>
              </div>
            </div>
          );

          return (
            <div key={m.id} className="msg-wrap otro">
              <div className="msg-otro-wrap">
                <div className="avatar" style={{ alignSelf:"flex-end" }}>{inicial}</div>
                <div>
                  <p className="msg-meta">{m.autor || m.nombre}</p>
                  <div className="msg-bubble otro">{m.texto}</div>
                  <p className="msg-hora">{hora}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <input className="chat-input" placeholder="Escribe un mensaje..."
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()} />
        <button className="chat-send" onClick={send} disabled={enviando}>▶</button>
      </div>
    </div>
  );
}
