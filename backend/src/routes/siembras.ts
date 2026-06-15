import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db';
import { authenticate, soloCoordinador } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/siembras ─────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const soloActivas = req.query.activa !== 'false';
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
              p.codigo AS parcela_codigo, p.descripcion AS parcela_desc,
              e.nombre_comun AS especie_nombre, e.dias_cosecha,
              v.nombre || ' ' || v.apellido AS responsable,
              v.nombre AS vecino_nombre,
              CASE 
                WHEN s.fecha_cosecha_estimada IS NULL THEN 0
                WHEN CURRENT_DATE >= s.fecha_cosecha_estimada THEN 100
                ELSE LEAST(100, ROUND(
                  ((CURRENT_DATE - s.fecha_siembra)::NUMERIC / 
                   NULLIF((s.fecha_cosecha_estimada - s.fecha_siembra)::NUMERIC, 0)) * 100
                ))
              END AS progreso,
              CASE
                WHEN CURRENT_DATE >= s.fecha_cosecha_estimada THEN 'Lista'
                ELSE 'Crecimiento'
              END AS estado
       FROM siembras s
       JOIN parcelas p ON p.id = s.parcela_id
       JOIN especies e ON e.id = s.especie_id
       JOIN vecinos  v ON v.id = s.vecino_id
       WHERE s.activa = $1
       ORDER BY s.fecha_siembra DESC`,
      [soloActivas]
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al obtener siembras' });
  }
});

// ── POST /api/siembras ────────────────────────────────────
const CreateSiembraSchema = z.object({
  parcela_id:       z.string().uuid(),
  especie_id:       z.string().uuid(),
  fecha_siembra:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cantidad_plantas: z.number().int().positive().optional(),
  notas:            z.string().optional(),
});

router.post('/', async (req: Request, res: Response) => {
  const parse = CreateSiembraSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ ok: false, error: parse.error.flatten().fieldErrors });
    return;
  }

  const { parcela_id, especie_id, fecha_siembra, cantidad_plantas, notas } = parse.data;
  const vecino_id = req.vecino!.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const parcela = await client.query(
      `SELECT estado FROM parcelas WHERE id = $1 FOR UPDATE`,
      [parcela_id]
    );
    if (parcela.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ ok: false, error: 'Parcela no encontrada' });
      return;
    }
    if (parcela.rows[0].estado !== 'disponible') {
      await client.query('ROLLBACK');
      res.status(409).json({ ok: false, error: `Parcela no disponible (${parcela.rows[0].estado})` });
      return;
    }

    const { rows: especieRows } = await client.query(
      `SELECT dias_cosecha FROM especies WHERE id = $1`, [especie_id]
    );
    const dias = especieRows[0]?.dias_cosecha || 60;

    const { rows } = await client.query(
      `INSERT INTO siembras 
         (parcela_id, especie_id, vecino_id, fecha_siembra, fecha_cosecha_estimada, cantidad_plantas, notas)
       VALUES ($1, $2, $3, $4, $4::DATE + ($5 || ' days')::INTERVAL, $6, $7)
       RETURNING *`,
      [parcela_id, especie_id, vecino_id, fecha_siembra, dias, cantidad_plantas ?? null, notas ?? null]
    );

    await client.query(
      `UPDATE parcelas SET estado = 'ocupada', updated_at = NOW() WHERE id = $1`,
      [parcela_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ ok: true, data: rows[0], message: 'Siembra registrada' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      res.status(409).json({ ok: false, error: 'Esta parcela ya tiene una siembra activa' });
      return;
    }
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al registrar siembra' });
  } finally {
    client.release();
  }
});

// ── DELETE /api/siembras/:id (cosechar/finalizar) ─────────
router.delete('/:id', soloCoordinador, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE siembras SET activa = FALSE, updated_at = NOW()
       WHERE id = $1 RETURNING parcela_id`,
      [req.params.id]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ ok: false, error: 'Siembra no encontrada' });
      return;
    }
    await client.query(
      `UPDATE parcelas SET estado = 'disponible', updated_at = NOW() WHERE id = $1`,
      [rows[0].parcela_id]
    );
    await client.query('COMMIT');
    res.json({ ok: true, message: 'Siembra finalizada' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  } finally {
    client.release();
  }
});

export default router;
