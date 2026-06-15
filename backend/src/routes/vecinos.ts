import { Router, Request, Response } from 'express';
import pool from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/vecinos ──────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, apellido, telefono, email, rol, activo, fecha_ingreso
       FROM vecinos
       WHERE activo = TRUE
       ORDER BY nombre ASC`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al obtener vecinos' });
  }
});

// ── GET /api/vecinos/:id ──────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, apellido, telefono, email, rol, activo, fecha_ingreso
       FROM vecinos WHERE id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Vecino no encontrado' });
      return;
    }
    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

export default router;
