const BASE = '/api';

async function request(method, path, body) {
  const token = localStorage.getItem('token');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'Error en la petición');
  return data;
}

export const api = {
  // ── Auth ─────────────────────────────────────────────
  login:    (email, password) => request('POST', '/auth/login',   { email, password }),
  register: (body)            => request('POST', '/auth/register', body),

  // ── Vecinos ──────────────────────────────────────────
  getVecinos:  ()   => request('GET', '/vecinos'),
  getVecino:   (id) => request('GET', `/vecinos/${id}`),

  // ── Parcelas ─────────────────────────────────────────
  getParcelas:            () => request('GET', '/parcelas'),
  getParcelasDisponibles: () => request('GET', '/parcelas/disponibles'),

  // ── Especies ─────────────────────────────────────────
  getEspecies: () => request('GET', '/dashboard/especies'),

  // ── Siembras ─────────────────────────────────────────
  getSiembras:  ()     => request('GET',  '/siembras'),
  crearSiembra: (body) => request('POST', '/siembras', body),

  // ── Turnos de riego ──────────────────────────────────
  getTurnosHoy:   ()   => request('GET',   '/turnos/hoy'),
  getTurnos:      ()   => request('GET',   '/turnos'),
  getProximos:    ()   => request('GET',   '/turnos/proximos'),
  marcarCumplido: (id) => request('PATCH', `/turnos/${id}/cumplir`, {}),
  crearTurno:     (body) => request('POST', '/turnos', body),

  // ── Rotación automática ───────────────────────────────
  generarRotacion:    (body)  => request('POST',   '/rotacion/generar', body),
  previewRotacion:    (params) => request('GET', `/rotacion/preview?fecha_inicio=${params.fecha_inicio}&fecha_fin=${params.fecha_fin}&dias_intervalo=${params.dias_intervalo}`),
  enviarRecordatorios: ()     => request('POST',   '/rotacion/recordatorio', {}),
  limpiarTurnos:      (desde) => request('DELETE', `/rotacion/limpiar?desde=${desde}`),

  // ── Mapa del huerto ───────────────────────────────────
  getMapa: () => request('GET', '/mapa'),

  // ── Cosechas ─────────────────────────────────────────
  getCosechas:       ()     => request('GET',  '/cosechas/mes-actual'),
  crearCosecha:      (body) => request('POST', '/cosechas', body),
  distribuirCosecha: (id)   => request('POST', `/cosechas/${id}/distribuir`, {}),

  // ── Dashboard ────────────────────────────────────────
  getDashboard: () => request('GET', '/dashboard'),
  getRanking:   (anio, mes) => request('GET', `/dashboard/ranking?anio=${anio}&mes=${mes}`),

  // ── Chat ─────────────────────────────────────────────
  getMensajes:   ()      => request('GET',    '/chat'),
  enviarMensaje: (texto) => request('POST',   '/chat', { texto }),
  borrarMensaje: (id)    => request('DELETE', `/chat/${id}`),

  // ── Notificaciones ───────────────────────────────────
  getNotificaciones:  ()     => request('GET',   '/notificaciones'),
  marcarLeida:        (id)   => request('PATCH', `/notificaciones/${id}/leer`, {}),
  marcarTodasLeidas:  ()     => request('PATCH', '/notificaciones/leer-todas', {}),
  crearNotificacion:  (body) => request('POST',  '/notificaciones', body),
};
