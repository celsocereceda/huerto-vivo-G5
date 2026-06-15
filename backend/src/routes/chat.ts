import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/chat ─────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.texto, m.created_at,
              v.id AS vecino_id,
              v.nombre || ' ' || v.apellido AS autor,
              v.nombre
       FROM mensajes_chat m
       JOIN vecinos v ON v.id = m.vecino_id
       ORDER BY m.created_at ASC
       LIMIT 100`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al obtener mensajes' });
  }
});

// ── POST /api/chat ────────────────────────────────────────
const MensajeSchema = z.object({
  texto: z.string().min(1).max(500),
});

router.post('/', async (req: Request, res: Response) => {
  const parse = MensajeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ ok: false, error: 'Mensaje inválido (1-500 caracteres)' });
    return;
  }

  try {
    const { rows: ins } = await pool.query(
      `INSERT INTO mensajes_chat (vecino_id, texto)
       VALUES ($1, $2)
       RETURNING id`,
      [req.vecino!.id, parse.data.texto]
    );

    const { rows } = await pool.query(
      `SELECT m.id, m.texto, m.created_at,
              v.id AS vecino_id,
              v.nombre || ' ' || v.apellido AS autor,
              v.nombre
       FROM mensajes_chat m
       JOIN vecinos v ON v.id = m.vecino_id
       WHERE m.id = $1`,
      [ins[0].id]
    );

    res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al enviar mensaje' });
  }
});

// ── DELETE /api/chat/:id ──────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT vecino_id FROM mensajes_chat WHERE id = $1`, [req.params.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Mensaje no encontrado' });
      return;
    }
    if (rows[0].vecino_id !== req.vecino!.id && req.vecino!.rol !== 'coordinador') {
      res.status(403).json({ ok: false, error: 'No puedes borrar mensajes de otros' });
      return;
    }
    await pool.query(`DELETE FROM mensajes_chat WHERE id = $1`, [req.params.id]);
    res.json({ ok: true, message: 'Mensaje eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

export default router;
