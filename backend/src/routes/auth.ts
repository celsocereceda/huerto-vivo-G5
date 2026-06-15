import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import pool from '../db';

const router = Router();

const LoginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

// ── POST /api/auth/login ──────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const parse = LoginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ ok: false, error: 'Datos inválidos' });
    return;
  }

  const { email, password } = parse.data;

  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, apellido, email, rol, password_hash, activo
       FROM vecinos WHERE email = $1`,
      [email]
    );

    if (rows.length === 0) {
      res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
      return;
    }

    const v = rows[0];

    if (!v.activo) {
      res.status(403).json({ ok: false, error: 'Cuenta inactiva. Contacta al coordinador.' });
      return;
    }

    const ok = await bcrypt.compare(password, v.password_hash);
    if (!ok) {
      res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
      return;
    }

    const token = jwt.sign(
      { id: v.id, email: v.email, rol: v.rol, nombre: v.nombre },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      ok: true,
      data: {
        token,
        vecino: { id: v.id, nombre: v.nombre, apellido: v.apellido, email: v.email, rol: v.rol },
      },
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// ── POST /api/auth/register ───────────────────────────────
const RegisterSchema = z.object({
  nombre:   z.string().min(2),
  apellido: z.string().min(2),
  email:    z.string().email(),
  telefono: z.string().optional(),
  password: z.string().min(4),
});

router.post('/register', async (req: Request, res: Response) => {
  const parse = RegisterSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ ok: false, error: parse.error.flatten().fieldErrors });
    return;
  }

  const { nombre, apellido, email, telefono, password } = parse.data;

  try {
    const existe = await pool.query('SELECT id FROM vecinos WHERE email = $1', [email]);
    if (existe.rows.length > 0) {
      res.status(409).json({ ok: false, error: 'El email ya está registrado' });
      return;
    }

    const hash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO vecinos (nombre, apellido, email, telefono, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, apellido, email, rol`,
      [nombre, apellido, email, telefono ?? null, hash]
    );

    res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error('Error en register:', err);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────
// Para verificar el token actual y obtener datos del vecino
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Sin token' });
    return;
  }
  try {
    const payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET!) as any;
    const { rows } = await pool.query(
      'SELECT id, nombre, apellido, email, rol FROM vecinos WHERE id = $1',
      [payload.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Vecino no encontrado' });
      return;
    }
    res.json({ ok: true, data: rows[0] });
  } catch {
    res.status(401).json({ ok: false, error: 'Token inválido' });
  }
});

export default router;
