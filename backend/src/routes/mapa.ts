import { Router, Request, Response } from 'express';
import pool from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/mapa ─────────────────────────────────────────
// Grilla completa de parcelas con estado de riego del día
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         p.id, p.codigo, p.descripcion, p.area_m2,
         p.estado AS estado_parcela,
         p.ubicacion_fila, p.ubicacion_col,
         -- Cultivo activo
         e.nombre_comun   AS cultivo,
         s.fecha_siembra,
         s.fecha_cosecha_estimada,
         CASE
           WHEN s.fecha_cosecha_estimada IS NULL THEN 0
           WHEN CURRENT_DATE >= s.fecha_cosecha_estimada THEN 100
           ELSE LEAST(100, ROUND(
             ((CURRENT_DATE - s.fecha_siembra)::NUMERIC /
              NULLIF((s.fecha_cosecha_estimada - s.fecha_siembra)::NUMERIC, 0)) * 100
           ))
         END AS progreso,
         vs.nombre || ' ' || vs.apellido AS responsable_siembra,
         -- Turno de hoy
         tr.estado        AS estado_riego_hoy,
         tr.hora_cumplido AS hora_regado,
         vr.nombre || ' ' || vr.apellido AS responsable_riego_hoy
       FROM parcelas p
       LEFT JOIN siembras s  ON s.parcela_id = p.id AND s.activa = TRUE
       LEFT JOIN especies e  ON e.id = s.especie_id
       LEFT JOIN vecinos  vs ON vs.id = s.vecino_id
       LEFT JOIN turnos_riego tr ON tr.parcela_id = p.id AND tr.fecha_turno = CURRENT_DATE
       LEFT JOIN vecinos  vr ON vr.id = tr.vecino_id
       ORDER BY p.ubicacion_fila, p.ubicacion_col`
    );

    // Calcular dimensiones de la grilla
    const maxFila = Math.max(...rows.map((r: any) => r.ubicacion_fila), 0);
    const maxCol  = Math.max(...rows.map((r: any) => r.ubicacion_col), 0);

    res.json({
      ok: true,
      data: {
        parcelas: rows,
        grilla: { filas: maxFila, columnas: maxCol },
        resumen: {
          total:       rows.length,
          ocupadas:    rows.filter((r: any) => r.estado_parcela === 'ocupada').length,
          disponibles: rows.filter((r: any) => r.estado_parcela === 'disponible').length,
          en_descanso: rows.filter((r: any) => r.estado_parcela === 'en_descanso').length,
          regadas_hoy: rows.filter((r: any) => r.estado_riego_hoy === 'cumplido').length,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al cargar el mapa' });
  }
});

export default router;
