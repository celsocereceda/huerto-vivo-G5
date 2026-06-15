import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db';
import { authenticate, soloCoordinador } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── POST /api/rotacion/generar ────────────────────────────
// Coordinador genera turnos del mes entero con rotación automática
// Patrón: cada vecino riega cada N días, rotando entre parcelas activas
const GenerarRotacionSchema = z.object({
  dias_intervalo:  z.number().int().min(1).max(7).default(3),  // cada cuántos días le toca a cada vecino
  fecha_inicio:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  parcelas_ids:    z.array(z.string().uuid()).optional(),       // si vacío usa todas las ocupadas
  solo_activos:    z.boolean().default(true),
});

router.post('/generar', soloCoordinador, async (req: Request, res: Response) => {
  const parse = GenerarRotacionSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ ok: false, error: parse.error.flatten().fieldErrors });
    return;
  }

  const { dias_intervalo, fecha_inicio, fecha_fin, parcelas_ids, solo_activos } = parse.data;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener vecinos activos
    const vecinosRes = await client.query(
      `SELECT id, nombre, apellido FROM vecinos
       WHERE activo = $1
       ORDER BY nombre ASC`,
      [solo_activos]
    );
    const vecinos = vecinosRes.rows;

    if (vecinos.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ ok: false, error: 'No hay vecinos activos' });
      return;
    }

    // 2. Obtener parcelas con siembras activas (o las especificadas)
    let parcelasRes;
    if (parcelas_ids && parcelas_ids.length > 0) {
      parcelasRes = await client.query(
        `SELECT id, codigo FROM parcelas WHERE id = ANY($1::uuid[]) ORDER BY codigo`,
        [parcelas_ids]
      );
    } else {
      parcelasRes = await client.query(
        `SELECT DISTINCT p.id, p.codigo
         FROM parcelas p
         JOIN siembras s ON s.parcela_id = p.id AND s.activa = TRUE
         ORDER BY p.codigo`
      );
    }
    const parcelas = parcelasRes.rows;

    if (parcelas.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ ok: false, error: 'No hay parcelas con siembras activas' });
      return;
    }

    // 3. Generar turnos día por día
    const inicio = new Date(fecha_inicio + 'T12:00:00Z');
    const fin    = new Date(fecha_fin    + 'T12:00:00Z');
    let turnosCreados = 0;
    let turnosOmitidos = 0;
    let vecinoIdx = 0;

    const fechaActual = new Date(inicio);
    while (fechaActual <= fin) {
      const fechaStr = fechaActual.toISOString().split('T')[0];

      // Para cada parcela, asignar el siguiente vecino en rotación
      for (const parcela of parcelas) {
        const vecino = vecinos[vecinoIdx % vecinos.length];

        // Intentar insertar — si ya existe ese turno (parcela+fecha), omitir
        const result = await client.query(
          `INSERT INTO turnos_riego (parcela_id, vecino_id, fecha_turno)
           VALUES ($1, $2, $3)
           ON CONFLICT (parcela_id, fecha_turno) DO NOTHING
           RETURNING id`,
          [parcela.id, vecino.id, fechaStr]
        );

        if (result.rows.length > 0) {
          turnosCreados++;
          // Crear notificación de recordatorio para el vecino
          await client.query(
            `INSERT INTO notificaciones (vecino_id, titulo, cuerpo, tipo)
             VALUES ($1, $2, $3, 'riego')`,
            [
              vecino.id,
              `💧 Turno de riego: ${fechaStr}`,
              `Tienes turno de riego en la parcela ${parcela.codigo} el ${fechaStr}. ¡No olvides marcarlo cuando termines!`,
            ]
          );
        } else {
          turnosOmitidos++;
        }

        vecinoIdx++;
      }

      // Avanzar N días
      fechaActual.setDate(fechaActual.getDate() + dias_intervalo);
    }

    await client.query('COMMIT');

    res.status(201).json({
      ok: true,
      message: `Rotación generada exitosamente`,
      data: {
        turnos_creados:  turnosCreados,
        turnos_omitidos: turnosOmitidos,
        vecinos:         vecinos.length,
        parcelas:        parcelas.length,
        periodo:         `${fecha_inicio} al ${fecha_fin}`,
        intervalo:       `cada ${dias_intervalo} días`,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error generando rotación:', err);
    res.status(500).json({ ok: false, error: 'Error al generar rotación' });
  } finally {
    client.release();
  }
});

// ── POST /api/rotacion/recordatorio ──────────────────────
// Genera notificaciones de recordatorio para todos los turnos de mañana
router.post('/recordatorio', soloCoordinador, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Buscar todos los turnos pendientes de mañana
    const { rows: turnosMañana } = await client.query(
      `SELECT tr.id, tr.vecino_id, tr.fecha_turno,
              p.codigo AS parcela,
              v.nombre || ' ' || v.apellido AS vecino_nombre
       FROM turnos_riego tr
       JOIN parcelas p ON p.id = tr.parcela_id
       JOIN vecinos  v ON v.id = tr.vecino_id
       WHERE tr.fecha_turno = CURRENT_DATE + 1
         AND tr.estado = 'pendiente'`
    );

    let creadas = 0;
    for (const t of turnosMañana) {
      await client.query(
        `INSERT INTO notificaciones (vecino_id, titulo, cuerpo, tipo)
         VALUES ($1, $2, $3, 'riego')`,
        [
          t.vecino_id,
          `⏰ Recordatorio: riegas mañana`,
          `Mañana (${t.fecha_turno}) es tu turno de riego en la parcela ${t.parcela}. ¡Prepárate!`,
        ]
      );
      creadas++;
    }

    await client.query('COMMIT');

    res.json({
      ok: true,
      message: `${creadas} recordatorio${creadas !== 1 ? 's' : ''} enviado${creadas !== 1 ? 's' : ''}`,
      data: { turnos: turnosMañana.length, notificaciones_creadas: creadas },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al enviar recordatorios' });
  } finally {
    client.release();
  }
});

// ── GET /api/rotacion/preview ─────────────────────────────
// Preview de la rotación antes de confirmar (sin guardar)
router.get('/preview', soloCoordinador, async (req: Request, res: Response) => {
  const { fecha_inicio, fecha_fin, dias_intervalo = '3' } = req.query as any;

  if (!fecha_inicio || !fecha_fin) {
    res.status(400).json({ ok: false, error: 'Se requieren fecha_inicio y fecha_fin' });
    return;
  }

  try {
    const [vecinosRes, parcelasRes] = await Promise.all([
      pool.query(`SELECT id, nombre, apellido FROM vecinos WHERE activo = TRUE ORDER BY nombre`),
      pool.query(
        `SELECT DISTINCT p.id, p.codigo FROM parcelas p
         JOIN siembras s ON s.parcela_id = p.id AND s.activa = TRUE
         ORDER BY p.codigo`
      ),
    ]);

    const vecinos  = vecinosRes.rows;
    const parcelas = parcelasRes.rows;
    const intervalo = parseInt(dias_intervalo);
    const preview: any[] = [];

    const inicio = new Date(fecha_inicio + 'T12:00:00Z');
    const fin    = new Date(fecha_fin    + 'T12:00:00Z');
    let vecinoIdx = 0;
    const fechaActual = new Date(inicio);

    while (fechaActual <= fin && preview.length < 50) {
      const fechaStr = fechaActual.toISOString().split('T')[0];
      for (const parcela of parcelas) {
        const vecino = vecinos[vecinoIdx % vecinos.length];
        preview.push({
          fecha:   fechaStr,
          parcela: parcela.codigo,
          vecino:  `${vecino.nombre} ${vecino.apellido}`,
        });
        vecinoIdx++;
      }
      fechaActual.setDate(fechaActual.getDate() + intervalo);
    }

    res.json({
      ok: true,
      data: {
        preview: preview.slice(0, 30),
        total_estimado: preview.length,
        vecinos: vecinos.length,
        parcelas: parcelas.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error generando preview' });
  }
});

// ── DELETE /api/rotacion/limpiar ──────────────────────────
// Elimina turnos pendientes futuros (para regenerar)
router.delete('/limpiar', soloCoordinador, async (req: Request, res: Response) => {
  const { desde } = req.query as any;
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM turnos_riego
       WHERE fecha_turno >= $1 AND estado = 'pendiente'`,
      [desde || new Date().toISOString().split('T')[0]]
    );
    res.json({ ok: true, message: `${rowCount} turnos pendientes eliminados`, data: { eliminados: rowCount } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al limpiar turnos' });
  }
});

export default router;
