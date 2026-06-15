import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  id: string;
  email: string;
  rol: string;
  nombre?: string;
}

declare global {
  namespace Express {
    interface Request {
      vecino?: JwtPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Token no proporcionado' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.vecino = payload;
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
};

export const soloCoordinador = (req: Request, res: Response, next: NextFunction): void => {
  if (req.vecino?.rol !== 'coordinador') {
    res.status(403).json({ ok: false, error: 'Acceso restringido a coordinadores' });
    return;
  }
  next();
};
