import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db';
import { authenticate, soloCoordinador } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/cosechas/mes-actual ──────────────────────────
router.get('/mes-actual', async (_req: Request, res: Response) => {
  try {
    const { rows: detalle } = await pool.query(
      `SELECT c.id, c.cantidad_kg, c.fecha_cosecha, c.estado, c.notas,
              e.nombre_comun AS especie,
              p.codigo       AS parcela,
              v.nombre || ' ' || v.apellido AS cosechador,
              v.nombre AS vecino_nombre
       FROM cosechas c
       JOIN siembras s ON s.id = c.siembra_id
       JOIN especies e ON e.id = s.especie_id
       JOIN parcelas p ON p.id = s.parcela_id
       JOIN vecinos  v ON v.id = c.vecino_id
       WHERE DATE_TRUNC('month', c.fecha_cosecha) = DATE_TRUNC('month', CURRENT_DATE)
       ORDER BY c.fecha_cosecha DESC`
    );

    const { rows: resumen } = await pool.query(
      `SELECT e.nombre_comun AS especie, SUM(c.cantidad_kg) AS total_kg, COUNT(*) AS num_cosechas
       FROM cosechas c
       JOIN siembras s ON s.id = c.siembra_id
       JOIN especies e ON e.id = s.especie_id
       WHERE DATE_TRUNC('month', c.fecha_cosecha) = DATE_TRUNC('month', CURRENT_DATE)
       GROUP BY e.nombre_comun
       ORDER BY total_kg DESC`
    );

    res.json({
      ok: true,
      data: {
        detalle,
        resumen,
        total_kg: resumen.reduce((a: number, r: any) => a + parseFloat(r.total_kg || 0), 0),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

// ── GET /api/cosechas ─────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, e.nombre_comun AS especie, p.codigo AS parcela,
              v.nombre || ' ' || v.apellido AS cosechador
       FROM cosechas c
       JOIN siembras s ON s.id = c.siembra_id
       JOIN especies e ON e.id = s.especie_id
       JOIN parcelas p ON p.id = s.parcela_id
       JOIN vecinos  v ON v.id = c.vecino_id
       ORDER BY c.fecha_cosecha DESC
       LIMIT 50`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

// ── POST /api/cosechas ────────────────────────────────────
const CreateCosechaSchema = z.object({
  siembra_id:    z.string().uuid(),
  fecha_cosecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cantidad_kg:   z.number().positive(),
  notas:         z.string().optional(),
});

router.post('/', async (req: Request, res: Response) => {
  const parse = CreateCosechaSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ ok: false, error: parse.error.flatten().fieldErrors });
    return;
  }

  const { siembra_id, fecha_cosecha, cantidad_kg, notas } = parse.data;
  const vecino_id = req.vecino!.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO cosechas (siembra_id, vecino_id, fecha_cosecha, cantidad_kg, notas)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [siembra_id, vecino_id, fecha_cosecha, cantidad_kg, notas ?? null]
    );

    const fecha = new Date(fecha_cosecha);
    await client.query(
      `INSERT INTO actividad_vecinos (vecino_id, anio, mes, cosechas_reportadas, kg_cosechados)
       VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (vecino_id, anio, mes) DO UPDATE
       SET cosechas_reportadas = actividad_vecinos.cosechas_reportadas + 1,
           kg_cosechados = actividad_vecinos.kg_cosechados + $4,
           updated_at = NOW()`,
      [vecino_id, fecha.getFullYear(), fecha.getMonth() + 1, cantidad_kg]
    );

    await client.query('COMMIT');
    res.status(201).json({ ok: true, data: rows[0], message: `Cosecha de ${cantidad_kg}kg registrada` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al registrar cosecha' });
  } finally {
    client.release();
  }
});

// ── POST /api/cosechas/:id/distribuir ─────────────────────
router.post('/:id/distribuir', soloCoordinador, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cosecha = await client.query(
      `SELECT * FROM cosechas WHERE id = $1 FOR UPDATE`, [req.params.id]
    );
    if (cosecha.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ ok: false, error: 'Cosecha no encontrada' });
      return;
    }
    if (cosecha.rows[0].estado === 'distribuida') {
      await client.query('ROLLBACK');
      res.status(409).json({ ok: false, error: 'Esta cosecha ya fue distribuida' });
      return;
    }

    const vecinos = await client.query(`SELECT id FROM vecinos WHERE activo = TRUE`);
    const numVecinos = vecinos.rows.length;
    const porcion = parseFloat((cosecha.rows[0].cantidad_kg / numVecinos).toFixed(3));

    for (const v of vecinos.rows) {
      await client.query(
        `INSERT INTO distribuciones_cosecha (cosecha_id, vecino_id, cantidad_kg)
         VALUES ($1, $2, $3)
         ON CONFLICT (cosecha_id, vecino_id) DO NOTHING`,
        [req.params.id, v.id, porcion]
      );
    }

    await client.query(
      `UPDATE cosechas SET estado = 'distribuida' WHERE id = $1`, [req.params.id]
    );

    await client.query('COMMIT');
    res.json({
      ok: true,
      message: `${cosecha.rows[0].cantidad_kg}kg distribuidos entre ${numVecinos} vecinos (${porcion}kg c/u)`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  } finally {
    client.release();
  }
});

export default router;
