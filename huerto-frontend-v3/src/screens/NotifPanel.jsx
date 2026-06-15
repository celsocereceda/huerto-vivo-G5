import { useState } from "react";
import { api } from "../api";
import "./NotifPanel.css";

const TIPO_ICON  = { riego: "💧", cosecha: "🌾", alerta: "⚠️", info: "ℹ️" };
const TIPO_COLOR = { riego: "#2563eb", cosecha: "#2d6a4f", alerta: "#d97706", info: "#6b7280" };

function ModalNuevaNotif({ onClose, onSaved, showToast }) {
  const [form, setForm]    = useState({ titulo: "", cuerpo: "", tipo: "info" });
  const [loading, setLoad] = useState(false);
  const tipos = [["info","ℹ️ Info"],["riego","💧 Riego"],["cosecha","🌾 Cosecha"],["alerta","⚠️ Alerta"]];

  async function enviar() {
    if (!form.titulo || !form.cuerpo) { showToast("Completa título y mensaje"); return; }
    setLoad(true);
    try {
      await api.crearNotificacion(form);
      showToast("📣 Notificación enviada a todos");
      onSaved(); onClose();
    } catch (e) {
      showToast("Error: " + e.message);
    }
    setLoad(false);
  }

  return (
    <div className="notif-modal-overlay" onClick={onClose}>
      <div className="notif-modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h3 className="modal-title">Nueva Notificación 📣</h3>
        <p className="modal-sub">Envía un aviso importante a todos los vecinos del huerto.</p>
        <label className="form-label">Tipo de aviso</label>
        <div className="tipo-grid">
          {tipos.map(([v, lb]) => (
            <button key={v} className={`tipo-btn ${form.tipo === v ? "sel" : ""}`}
              onClick={() => setForm(p => ({ ...p, tipo: v }))}>{lb}</button>
          ))}
        </div>
        <label className="form-label" style={{ marginTop: 12 }}>Título</label>
        <input className="form-input" placeholder="Ej: Reunión comunitaria este sábado"
          value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} />
        <label className="form-label" style={{ marginTop: 12 }}>Mensaje</label>
        <textarea className="form-input" rows={3} style={{ resize: "none" }}
          placeholder="Escribe el mensaje completo aquí..."
          value={form.cuerpo} onChange={e => setForm(p => ({ ...p, cuerpo: e.target.value }))} />
        <button className="btn-primary" style={{ marginTop: 14 }} onClick={enviar} disabled={loading}>
          {loading ? "Enviando..." : "📣 Enviar a todos"}
        </button>
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

export default function NotifPanel({ notifs, onClose, onMarcarLeida, onMarcarTodas, esCoord, showToast, onNotifsChange }) {
  const [showModal, setShowModal] = useState(false);
  const noLeidas = notifs.filter(n => !n.leida).length;

  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <div>
          <h2 className="notif-panel-title">Notificaciones</h2>
          <p className="notif-panel-sub">{noLeidas} sin leer</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {esCoord && (
            <button className="btn-nueva-notif" onClick={() => setShowModal(true)}>＋ Nuevo aviso</button>
          )}
          <button className="notif-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      {noLeidas > 0 && (
        <div style={{ padding: "6px 20px 0", display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-marcar-todas" onClick={onMarcarTodas}>Marcar todas leídas</button>
        </div>
      )}

      <div className="notif-list">
        {notifs.length === 0 && (
          <div className="notif-empty">
            <p style={{ fontSize: 36 }}>🔔</p>
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 8, color: "var(--text-muted)" }}>Sin notificaciones</p>
          </div>
        )}
        {notifs.map(n => (
          <div
            key={n.id}
            className={`notif-item ${!n.leida ? "no-leida" : ""}`}
            style={{ borderLeftColor: TIPO_COLOR[n.tipo] || "#6b7280" }}
            onClick={() => onMarcarLeida(n.id)}
          >
            <div className="notif-item-header">
              <span className="notif-tipo-icon">{TIPO_ICON[n.tipo] || "ℹ️"}</span>
              <span className="notif-titulo">{n.titulo}</span>
              {!n.leida && <span className="notif-dot" />}
            </div>
            <p className="notif-cuerpo">{n.cuerpo}</p>
            <p className="notif-hora">
              {new Date(n.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ))}
      </div>

      {showModal && (
        <ModalNuevaNotif
          onClose={() => setShowModal(false)}
          onSaved={onNotifsChange}
          showToast={showToast}
        />
      )}
    </div>
  );
}
