import { Router, Request, Response } from 'express';
import pool from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/dashboard ────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [riegoHoy, cosechasMes, ranking, parcelasEstado, proximos] = await Promise.all([
      pool.query(`SELECT * FROM v_riego_hoy`),

      pool.query(
        `SELECT e.nombre_comun AS especie, SUM(c.cantidad_kg) AS total_kg, COUNT(*) AS veces
         FROM cosechas c
         JOIN siembras s ON s.id = c.siembra_id
         JOIN especies e ON e.id = s.especie_id
         WHERE DATE_TRUNC('month', c.fecha_cosecha) = DATE_TRUNC('month', CURRENT_DATE)
         GROUP BY e.nombre_comun
         ORDER BY total_kg DESC`
      ),

      pool.query(
        `SELECT * FROM v_ranking_vecinos
         WHERE anio = EXTRACT(YEAR FROM CURRENT_DATE)
           AND mes  = EXTRACT(MONTH FROM CURRENT_DATE)`
      ),

      pool.query(`SELECT estado, COUNT(*) AS total FROM parcelas GROUP BY estado`),

      pool.query(
        `SELECT tr.id, tr.fecha_turno,
                p.codigo AS parcela,
                v.nombre || ' ' || v.apellido AS responsable,
                CASE
                  WHEN tr.fecha_turno = CURRENT_DATE + 1 THEN 'Mañana'
                  ELSE UPPER(TO_CHAR(tr.fecha_turno, 'TMDy DD'))
                END AS fecha_turno_label,
                tr.estado
         FROM turnos_riego tr
         JOIN parcelas p ON p.id = tr.parcela_id
         JOIN vecinos  v ON v.id = tr.vecino_id
         WHERE tr.fecha_turno BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 3
         ORDER BY tr.fecha_turno, p.codigo
         LIMIT 5`
      ),
    ]);

    const totalRegadasHoy = riegoHoy.rows.filter((r: any) => r.estado === 'cumplido').length;
    const totalPendientesHoy = riegoHoy.rows.filter((r: any) => r.estado === 'pendiente').length;
    const totalKgMes = cosechasMes.rows.reduce((acc: number, r: any) => acc + parseFloat(r.total_kg || 0), 0);

    res.json({
      ok: true,
      data: {
        kpis: {
          parcelas_regadas_hoy:    totalRegadasHoy,
          parcelas_pendientes_hoy: totalPendientesHoy,
          kg_cosechados_mes:       totalKgMes.toFixed(2),
          fecha:                   new Date().toISOString().split('T')[0],
        },
        riego_hoy:       riegoHoy.rows,
        cosechas_mes:    cosechasMes.rows.map((r: any) => ({
          especie: r.especie,
          total_kg: r.total_kg,
          total_cosechas: r.veces,
        })),
        ranking_vecinos: ranking.rows,
        estado_parcelas: parcelasEstado.rows,
        proximos_turnos: proximos.rows.map((p: any) => ({
          parcela: p.parcela,
          responsable: p.responsable,
          fecha_turno: p.fecha_turno_label,
        })),
      },
    });
  } catch (err) {
    console.error('Error en dashboard:', err);
    res.status(500).json({ ok: false, error: 'Error al cargar el dashboard' });
  }
});

// ── GET /api/dashboard/ranking ────────────────────────────
router.get('/ranking', async (req: Request, res: Response) => {
  const anio = parseInt(req.query.anio as string) || new Date().getFullYear();
  const mes  = parseInt(req.query.mes  as string) || new Date().getMonth() + 1;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM v_ranking_vecinos WHERE anio = $1 AND mes = $2`,
      [anio, mes]
    );
    res.json({ ok: true, data: rows, periodo: { anio, mes } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

// ── GET /api/dashboard/especies ───────────────────────────
router.get('/especies', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM especies ORDER BY nombre_comun`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

export default router;
