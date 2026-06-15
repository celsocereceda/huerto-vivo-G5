import { Router, Request, Response } from 'express';
import pool from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/parcelas ─────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, 
              s.id AS siembra_id,
              e.nombre_comun AS cultivo_actual,
              s.fecha_siembra,
              s.fecha_cosecha_estimada,
              v.nombre || ' ' || v.apellido AS responsable_siembra
       FROM parcelas p
       LEFT JOIN siembras s ON s.parcela_id = p.id AND s.activa = TRUE
       LEFT JOIN especies e ON e.id = s.especie_id
       LEFT JOIN vecinos  v ON v.id = s.vecino_id
       ORDER BY p.ubicacion_fila, p.ubicacion_col`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al obtener parcelas' });
  }
});

// ── GET /api/parcelas/disponibles ─────────────────────────
router.get('/disponibles', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, codigo, descripcion, area_m2, ubicacion_fila, ubicacion_col
       FROM parcelas WHERE estado = 'disponible'
       ORDER BY codigo`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

export default router;
