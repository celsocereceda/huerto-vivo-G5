import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db';
import { authenticate, soloCoordinador } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/turnos/hoy ───────────────────────────────────
router.get('/hoy', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT tr.id, tr.parcela_id, tr.vecino_id, tr.fecha_turno, tr.estado, tr.hora_cumplido,
              p.codigo AS parcela_codigo, p.descripcion AS parcela_desc,
              v.nombre || ' ' || v.apellido AS responsable,
              v.nombre AS vecino_nombre,
              v.telefono
       FROM turnos_riego tr
       JOIN parcelas p ON p.id = tr.parcela_id
       JOIN vecinos  v ON v.id = tr.vecino_id
       WHERE tr.fecha_turno = CURRENT_DATE
       ORDER BY p.codigo`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

// ── GET /api/turnos/proximos ──────────────────────────────
router.get('/proximos', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT tr.id, tr.fecha_turno, tr.estado,
              p.codigo AS parcela_codigo,
              v.nombre || ' ' || v.apellido AS responsable,
              v.nombre AS vecino_nombre
       FROM turnos_riego tr
       JOIN parcelas p ON p.id = tr.parcela_id
       JOIN vecinos  v ON v.id = tr.vecino_id
       WHERE tr.fecha_turno BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7
       ORDER BY tr.fecha_turno, p.codigo`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

// ── GET /api/turnos (con filtros) ─────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const { fecha, vecino_id, estado } = req.query;
  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  if (fecha)     { conds.push(`tr.fecha_turno = $${i++}`); vals.push(fecha); }
  if (vecino_id) { conds.push(`tr.vecino_id = $${i++}`); vals.push(vecino_id); }
  if (estado)    { conds.push(`tr.estado = $${i++}::estado_turno`); vals.push(estado); }

  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `SELECT tr.*,
              p.codigo AS parcela_codigo,
              v.nombre || ' ' || v.apellido AS responsable,
              v.nombre AS vecino_nombre
       FROM turnos_riego tr
       JOIN parcelas p ON p.id = tr.parcela_id
       JOIN vecinos  v ON v.id = tr.vecino_id
       ${where}
       ORDER BY tr.fecha_turno DESC, p.codigo
       LIMIT 50`,
      vals
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

// ── PATCH /api/turnos/:id/cumplir ─────────────────────────
// El botón "Ya regué hoy" en la app
router.patch('/:id/cumplir', async (req: Request, res: Response) => {
  const { observaciones } = req.body || {};

  try {
    const turno = await pool.query(
      `SELECT vecino_id, fecha_turno, estado FROM turnos_riego WHERE id = $1`,
      [req.params.id]
    );

    if (turno.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Turno no encontrado' });
      return;
    }

    const t = turno.rows[0];

    if (t.vecino_id !== req.vecino!.id && req.vecino!.rol !== 'coordinador') {
      res.status(403).json({ ok: false, error: 'Solo puedes marcar tus propios turnos' });
      return;
    }

    if (t.estado === 'cumplido') {
      res.status(409).json({ ok: false, error: 'Este turno ya fue marcado como cumplido' });
      return;
    }

    const { rows } = await pool.query(
      `UPDATE turnos_riego
       SET estado = 'cumplido', hora_cumplido = NOW(), observaciones = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [observaciones ?? null, req.params.id]
    );

    // Actualizar métricas mensuales
    const fecha = new Date(t.fecha_turno);
    await pool.query(
      `INSERT INTO actividad_vecinos (vecino_id, anio, mes, turnos_asignados, turnos_cumplidos)
       VALUES ($1, $2, $3, 1, 1)
       ON CONFLICT (vecino_id, anio, mes) DO UPDATE
       SET turnos_cumplidos = actividad_vecinos.turnos_cumplidos + 1,
           updated_at = NOW()`,
      [t.vecino_id, fecha.getFullYear(), fecha.getMonth() + 1]
    );

    res.json({ ok: true, data: rows[0], message: '¡Turno registrado!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al marcar turno' });
  }
});

// ── POST /api/turnos (asignar) ────────────────────────────
const CreateTurnoSchema = z.object({
  parcela_id:  z.string().uuid(),
  vecino_id:   z.string().uuid(),
  fecha_turno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post('/', soloCoordinador, async (req: Request, res: Response) => {
  const parse = CreateTurnoSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ ok: false, error: parse.error.flatten().fieldErrors });
    return;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO turnos_riego (parcela_id, vecino_id, fecha_turno)
       VALUES ($1, $2, $3) RETURNING *`,
      [parse.data.parcela_id, parse.data.vecino_id, parse.data.fecha_turno]
    );
    res.status(201).json({ ok: true, data: rows[0] });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ ok: false, error: 'Ya existe un turno para esa parcela y fecha' });
      return;
    }
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

export default router;
