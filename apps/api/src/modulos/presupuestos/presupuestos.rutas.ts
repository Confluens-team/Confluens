import {
  esquemaCrearPresupuesto,
  esquemaFiltrosPresupuestos,
  esquemaPresupuestoDetallado,
  esquemaPresupuestoListado,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { crear, listar } from './presupuestos.controlador.js';

registroOpenApi.registerPath({
  method: 'post',
  path: '/presupuestos',
  tags: ['Presupuestos'],
  summary: 'Genera un presupuesto estimado a partir de salón, fecha, personas y servicios (HU-09)',
  request: { body: { content: { 'application/json': { schema: esquemaCrearPresupuesto } } } },
  responses: {
    201: {
      description: 'Presupuesto Estimado creado, con el evento en consulta y el detalle de líneas',
      content: { 'application/json': { schema: z.object({ data: esquemaPresupuestoDetallado }) } },
    },
    400: { description: 'Datos inválidos' },
    404: { description: 'El salón o alguno de los servicios seleccionados no existe' },
    422: { description: 'Alguno de los servicios seleccionados no está activo' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/presupuestos',
  tags: ['Presupuestos'],
  summary: 'Lista los presupuestos con su estado, del más reciente al más antiguo (HU-10)',
  request: { query: esquemaFiltrosPresupuestos },
  responses: {
    200: {
      description: 'Presupuestos que cumplen los filtros; lista vacía si ninguno los cumple',
      content: {
        'application/json': { schema: z.object({ data: z.array(esquemaPresupuestoListado) }) },
      },
    },
    400: { description: 'Filtros inválidos (estado, fechas o rango desde/hasta)' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'El rol no es Responsable de Eventos ni Administrador del Sistema' },
  },
});

export const rutasPresupuestos = Router();

rutasPresupuestos.post('/', validar({ body: esquemaCrearPresupuesto }), asincrono(crear));
rutasPresupuestos.get(
  '/',
  autenticar,
  autorizar('ADMINISTRADOR_SISTEMA', 'RESPONSABLE_EVENTOS'),
  validar({ query: esquemaFiltrosPresupuestos }),
  asincrono(listar),
);
