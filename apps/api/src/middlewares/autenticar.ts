import type { RequestHandler } from 'express';

import { ErrorApi } from '../lib/errores.js';
import {
  firmarToken,
  huellaDelToken,
  NOMBRE_COOKIE_SESION,
  opcionesCookieSesion,
  verificarToken,
} from '../lib/jwt.js';
import { sesionVigente } from '../lib/sesion-vigente.js';

/**
 * Exige una sesión válida. Lee el JWT de la cookie httpOnly, lo verifica y, si es
 * válido, lo vuelve a firmar y resetea la cookie con la misma duración (ventana
 * deslizante): así "expira por inactividad" (criterio 5) en vez de expirar a una
 * hora fija desde el login, sin importar cuánto haya usado el sistema el usuario.
 *
 * Antes de renovar, contrasta la sesión con la base (M2 de la auditoría, ver
 * lib/sesion-vigente.ts): el rol que rige es el actual, y un usuario borrado o con
 * la contraseña cambiada queda afuera.
 */
export const autenticar: RequestHandler = (req, res, next) => {
  const token = req.cookies?.[NOMBRE_COOKIE_SESION] as string | undefined;
  const delToken = token ? verificarToken(token) : null;

  if (!token || !delToken) {
    next(ErrorApi.noAutenticado());
    return;
  }

  const huella = huellaDelToken(token);
  sesionVigente(delToken, huella)
    .then((sesion) => {
      if (!sesion) {
        next(ErrorApi.noAutenticado());
        return;
      }
      res.cookie(
        NOMBRE_COOKIE_SESION,
        firmarToken(sesion, huella ?? undefined),
        opcionesCookieSesion(),
      );
      req.usuario = sesion;
      next();
    })
    .catch(next);
};
