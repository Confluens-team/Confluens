import { CODIGOS_ERROR } from '@confluens/shared';
import type { RequestHandler } from 'express';

import { ErrorApi } from '../lib/errores.js';

/**
 * H3 de la auditoría de seguridad (OWASP A03). Los campos de texto aceptaban HTML y se guardaban
 * crudos (`<b>...</b><img src=x onerror=...>` en el nombre de un cliente, por ejemplo). Hoy la web
 * de React lo escapa sola, así que no hay XSS en el navegador; el riesgo es el mismo dato
 * renderizado en otro contexto sin escape: el PDF del presupuesto, el correo al cliente o un panel
 * futuro. Se rechaza en la entrada, que es el único lugar donde se controla una vez para todos los
 * consumidores.
 *
 * Rechaza en vez de limpiar a propósito: limpiar silenciosamente guardaría un nombre distinto del
 * que la persona escribió, y para los datos del dominio (nombres, teléfonos, observaciones) no hay
 * ningún caso legítimo de marcado.
 */
const ETIQUETA_HTML = /<\s*\/?\s*[a-z][^>]*>?/i;
const ENTIDAD_HTML = /&(?:#\d+|#x[0-9a-f]+|[a-z]+);/i;

export const rechazarHtml: RequestHandler = (req, _res, next) => {
  const campos = camposConHtml(req.body as unknown, '');
  if (campos.length > 0) {
    next(
      new ErrorApi(
        400,
        CODIGOS_ERROR.VALIDACION,
        'Los datos enviados no son válidos',
        campos.map((campo) => ({ campo, mensaje: 'No se admite HTML en este campo' })),
      ),
    );
    return;
  }
  next();
};

// Recorre el body (objetos y arrays anidados: las líneas del presupuesto llegan así) y devuelve la
// ruta de cada string con marcado, para que el 400 diga qué campo corregir.
function camposConHtml(valor: unknown, ruta: string): string[] {
  if (typeof valor === 'string') {
    return ETIQUETA_HTML.test(valor) || ENTIDAD_HTML.test(valor) ? [ruta] : [];
  }
  if (Array.isArray(valor)) {
    return valor.flatMap((item, indice) => camposConHtml(item, `${ruta}[${indice}]`));
  }
  if (typeof valor === 'object' && valor !== null) {
    return Object.entries(valor).flatMap(([clave, item]) =>
      camposConHtml(item, ruta === '' ? clave : `${ruta}.${clave}`),
    );
  }
  return [];
}
