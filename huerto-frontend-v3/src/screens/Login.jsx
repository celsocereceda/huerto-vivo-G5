import { useState } from "react";
import { api } from "../api";
import "./Login.css";

export default function Login({ onLogin }) {
  const [form, setForm]    = useState({ email: "", password: "" });
  const [loading, setLoad] = useState(false);
  const [error, setError]  = useState("");

  async function entrar() {
    setLoad(true);
    setError("");
    try {
      const res = await api.login(form.email, form.password);
      localStorage.setItem("token",  res.data.token);
      localStorage.setItem("vecino", JSON.stringify(res.data.vecino));
      onLogin();
    } catch (e) {
      setError(e.message || "Credenciales incorrectas");
    }
    setLoad(false);
  }

  return (
    <div className="login-wrap">
      <div className="login-logo">
        <div className="login-icon">🌱</div>
        <h1 className="login-brand">Huerto Vivo</h1>
        <p className="login-tagline">Tu comunidad crece junta</p>
      </div>
      <div className="login-card">
        <h2 className="login-title">Bienvenido de vuelta</h2>
        {error && <div className="login-error">{error}</div>}

        <label className="form-label">Email</label>
        <input
          className="form-input" type="email" placeholder="carmen@huerto.cl"
          value={form.email}
          onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
        />

        <label className="form-label" style={{ marginTop: 12 }}>Contraseña</label>
        <input
          className="form-input" type="password" placeholder="••••••"
          value={form.password}
          onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
          onKeyDown={e => e.key === "Enter" && entrar()}
        />

        <button
          className="btn-primary" style={{ marginTop: 16 }}
          onClick={entrar} disabled={loading}
        >
          {loading ? "Ingresando..." : "Ingresar al Huerto"}
        </button>

        <p className="login-hint">
          Contraseña de prueba: <strong>1234</strong> para cualquier vecino
        </p>
      </div>
    </div>
  );
}
