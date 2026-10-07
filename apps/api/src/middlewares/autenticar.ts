import type { RequestHandler } from 'express';

import { ErrorApi } from '../lib/errores.js';
import {
  firmarToken,
  NOMBRE_COOKIE_SESION,
  opcionesCookieSesion,
  verificarToken,
} from '../lib/jwt.js';

/**
 * Exige una sesión válida. Lee el JWT de la cookie httpOnly, lo verifica y, si es
 * válido, lo vuelve a firmar y resetea la cookie con la misma duración (ventana
 * deslizante): así "expira por inactividad" (criterio 5) en vez de expirar a una
 * hora fija desde el login, sin importar cuánto haya usado el sistema el usuario.
 */
export const autenticar: RequestHandler = (req, res, next) => {
  const token = req.cookies?.[NOMBRE_COOKIE_SESION] as string | undefined;
  const sesion = token ? verificarToken(token) : null;

  if (!sesion) {
    next(ErrorApi.noAutenticado());
    return;
  }

  res.cookie(NOMBRE_COOKIE_SESION, firmarToken(sesion), opcionesCookieSesion());
  req.usuario = sesion;
  next();
};
