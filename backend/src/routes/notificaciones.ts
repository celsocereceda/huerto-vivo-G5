import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db';
import { authenticate, soloCoordinador } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/notificaciones ───────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, titulo, cuerpo, tipo, leida, created_at
       FROM notificaciones
       WHERE vecino_id = $1 OR vecino_id IS NULL
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.vecino!.id]
    );
    const noLeidas = rows.filter((n: any) => !n.leida).length;
    res.json({ ok: true, data: rows, no_leidas: noLeidas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

// ── PATCH /api/notificaciones/:id/leer ────────────────────
router.patch('/:id/leer', async (req: Request, res: Response) => {
  try {
    await pool.query(
      `UPDATE notificaciones SET leida = TRUE WHERE id = $1`, [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

// ── PATCH /api/notificaciones/leer-todas ──────────────────
router.patch('/leer-todas', async (req: Request, res: Response) => {
  try {
    await pool.query(
      `UPDATE notificaciones SET leida = TRUE
       WHERE (vecino_id = $1 OR vecino_id IS NULL) AND leida = FALSE`,
      [req.vecino!.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

// ── POST /api/notificaciones (solo coordinador) ───────────
const NotifSchema = z.object({
  titulo:    z.string().min(1).max(100),
  cuerpo:    z.string().min(1),
  tipo:      z.enum(['info', 'riego', 'cosecha', 'alerta']).default('info'),
  vecino_id: z.string().uuid().optional(),
});

router.post('/', soloCoordinador, async (req: Request, res: Response) => {
  const parse = NotifSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ ok: false, error: parse.error.flatten().fieldErrors });
    return;
  }

  const { titulo, cuerpo, tipo, vecino_id } = parse.data;

  try {
    const { rows } = await pool.query(
      `INSERT INTO notificaciones (titulo, cuerpo, tipo, vecino_id)
       VALUES ($1, $2, $3::tipo_notif, $4) RETURNING *`,
      [titulo, cuerpo, tipo, vecino_id ?? null]
    );
    res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al crear notificación' });
  }
});

export default router;
