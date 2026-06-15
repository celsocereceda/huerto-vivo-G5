import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes           from './routes/auth';
import vecinosRoutes        from './routes/vecinos';
import parcelasRoutes       from './routes/parcelas';
import siembrasRoutes       from './routes/siembras';
import turnosRoutes         from './routes/turnos';
import cosechasRoutes       from './routes/cosechas';
import dashboardRoutes      from './routes/dashboard';
import chatRoutes           from './routes/chat';
import notificacionesRoutes from './routes/notificaciones';
import rotacionRoutes       from './routes/rotacion';
import mapaRoutes           from './routes/mapa';
import pool                 from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares globales ──────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { ok: false, error: 'Demasiadas solicitudes. Espera unos minutos.' },
});
app.use(limiter);

// ── Health check ──────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, status: 'online', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, status: 'db_error', detalle: String(err) });
  }
});

// ── Rutas ─────────────────────────────────────────────────
app.use('/api/auth',           authRoutes);
app.use('/api/vecinos',        vecinosRoutes);
app.use('/api/parcelas',       parcelasRoutes);
app.use('/api/siembras',       siembrasRoutes);
app.use('/api/turnos',         turnosRoutes);
app.use('/api/cosechas',       cosechasRoutes);
app.use('/api/dashboard',      dashboardRoutes);
app.use('/api/chat',           chatRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/rotacion',      rotacionRoutes);
app.use('/api/mapa',          mapaRoutes);

// ── 404 ───────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

// ── Error handler ─────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error no manejado:', err.message);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
});

// ── Iniciar servidor ──────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║   🌱  Huerto Comunitario API  🌱           ║
║                                            ║
║   Corriendo en  http://localhost:${PORT}     ║
║   Health check: http://localhost:${PORT}/health  ║
║                                            ║
╚════════════════════════════════════════════╝
  `);
});

export default app;
