import {
  esquemaActualizarConfiguracionPrecios,
  esquemaConfiguracionPrecios,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { limitadorEscrituras } from '../../middlewares/limitadores.js';
import { validar } from '../../middlewares/validar.js';
import { guardar, obtener } from './configuracion-precios.controlador.js';

const respuesta = {
  'application/json': { schema: z.object({ data: esquemaConfiguracionPrecios }) },
};

registroOpenApi.registerPath({
  method: 'get',
  path: '/configuracion-precios',
  tags: ['Configuración de precios'],
  summary:
    'Porcentaje de incremento mensual con el que se proyectan los precios a la fecha del ' +
    'evento (RN-13)',
  responses: {
    200: { description: 'Configuración vigente', content: respuesta },
    401: { description: 'Sin sesión' },
  },
});

registroOpenApi.registerPath({
  method: 'put',
  path: '/configuracion-precios',
  tags: ['Configuración de precios'],
  summary: 'Cambia el porcentaje de incremento mensual (RN-10). No toca presupuestos emitidos',
  request: {
    body: { content: { 'application/json': { schema: esquemaActualizarConfiguracionPrecios } } },
  },
  responses: {
    200: { description: 'Configuración guardada', content: respuesta },
    400: { description: 'Porcentaje inválido o mayor a 100' },
    401: { description: 'Sin sesión' },
    403: { description: 'La sesión no es del personal' },
  },
});

export const rutasConfiguracionPrecios = Router();

// El porcentaje lo lee también el cotizador del cliente, que proyecta los precios que muestra
// (mismo criterio que GET /servicios: sesión, sin rol). Cambiarlo es del personal.
rutasConfiguracionPrecios.get('/', autenticar, asincrono(obtener));
rutasConfiguracionPrecios.put(
  '/',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  limitadorEscrituras,
  validar({ body: esquemaActualizarConfiguracionPrecios }),
  asincrono(guardar),
);
