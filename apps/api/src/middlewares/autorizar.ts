import type { Rol } from '@confluens/shared';
import type { RequestHandler } from 'express';

import { ErrorApi } from '../lib/errores.js';

// Los roles del personal: todas las funciones del panel interno. CLIENTE queda afuera siempre
// (C6 de HU-48: el rol Cliente nunca accede al panel interno, tampoco llamando a la API directo).
export const ROLES_PERSONAL: Rol[] = [
  'RESPONSABLE_EVENTOS',
  'RESPONSABLE_FINANZAS',
  'GERENTE_GENERAL',
  'ADMINISTRADOR_SISTEMA',
];

/**
 * Restringe una ruta a los roles indicados (criterio 3: un RE no puede administrar
 * usuarios ni ver reportes de ingresos). Debe montarse SIEMPRE después de
 * `autenticar` en la cadena de middlewares: confía en que `req.usuario` ya está
 * seteado y no vuelve a verificar el JWT.
 */
export function autorizar(...roles: Rol[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      next(ErrorApi.noAutorizado());
      return;
    }
    next();
  };
}
