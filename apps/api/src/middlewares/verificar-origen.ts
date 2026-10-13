import type { RequestHandler } from 'express';

import { ErrorApi } from '../lib/errores.js';

/**
 * H5 de la auditoría de seguridad (OWASP A05). La sesión viaja en cookie y en producción tiene que
 * ser SameSite=none, porque la web (Vercel) y la API (Render) quedan en dominios distintos: el
 * navegador no aporta ninguna defensa CSRF por sí solo.
 *
 * Hasta acá la protección era implícita —CORS acotado a FRONTEND_URL más express.json(), que
 * obliga al preflight en los POST con JSON— y funcionaba, pero dependía de que ningún endpoint
 * aceptara nunca un content-type simple. Esto la hace explícita: toda escritura tiene que venir de
 * un origen conocido.
 *
 * Un request sin Origin ni Referer pasa: así llegan curl, los tests de Supertest y los clientes que
 * no son navegadores, y ninguno de ellos puede ser víctima de CSRF (no hay cookie que el navegador
 * adjunte sin que el atacante la vea). Lo que se corta es el caso real: un formulario o un fetch
 * servido desde otro sitio con la cookie de sesión de la víctima.
 */
const METODOS_DE_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

export function verificarOrigen(origenPermitido: string): RequestHandler {
  return (req, _res, next) => {
    if (METODOS_DE_LECTURA.has(req.method)) {
      next();
      return;
    }

    const declarado = req.get('origin') ?? req.get('referer');
    if (declarado !== undefined && origenDe(declarado) !== origenDe(origenPermitido)) {
      next(ErrorApi.noAutorizado('El origen de la solicitud no está permitido'));
      return;
    }
    next();
  };
}

// Del Referer llega la URL completa, del Origin solo el esquema + host + puerto: se comparan
// siempre normalizados a origen. Una URL malformada no matchea nada y corta.
function origenDe(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
