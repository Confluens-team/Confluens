import {
  esquemaConsultaDetallada,
  esquemaCrearPresupuesto,
  esquemaFiltrosPresupuestos,
  esquemaModificarPresupuesto,
  esquemaPresupuestoDetallado,
  esquemaPresupuestoListado,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { crear, darDeBaja, listar, modificar, obtener } from './presupuestos.controlador.js';

const esquemaIdParam = z.object({ id: z.coerce.number().int().positive() });
const respuestaConsulta = {
  'application/json': { schema: z.object({ data: esquemaConsultaDetallada }) },
};
const erroresDeSesion = {
  401: { description: 'Sin sesión activa' },
  403: { description: 'La sesión no es del personal' },
};

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
    403: { description: 'La sesión no es del personal' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/presupuestos/{id}',
  tags: ['Presupuestos'],
  summary: 'Detalle de una consulta para mostrarla y editarla (HU-12)',
  request: { params: esquemaIdParam },
  responses: {
    200: {
      description: 'La consulta con su evento, cliente, salón y líneas',
      content: respuestaConsulta,
    },
    404: { description: 'No existe el presupuesto' },
    ...erroresDeSesion,
  },
});

registroOpenApi.registerPath({
  method: 'patch',
  path: '/presupuestos/{id}',
  tags: ['Presupuestos'],
  summary: 'Modifica o recalcula una consulta Estimado o Expirado y reinicia su vigencia (HU-12)',
  request: {
    params: esquemaIdParam,
    body: { content: { 'application/json': { schema: esquemaModificarPresupuesto } } },
  },
  responses: {
    200: {
      description: 'Consulta modificada, en Estimado y con 10 días de vigencia',
      content: respuestaConsulta,
    },
    400: { description: 'Datos inválidos' },
    404: { description: 'No existe el presupuesto, el salón o un servicio' },
    409: {
      description:
        'El presupuesto no está Estimado ni Expirado, o el evento ya no está en consulta',
    },
    422: { description: 'Se agregó un servicio que no está activo' },
    ...erroresDeSesion,
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/presupuestos/{id}/dar-de-baja',
  tags: ['Presupuestos'],
  summary: 'Da de baja una consulta: pasa a Cancelado (HU-12, RN-08)',
  request: { params: esquemaIdParam },
  responses: {
    200: { description: 'Consulta cancelada', content: respuestaConsulta },
    404: { description: 'No existe el presupuesto' },
    409: { description: 'El presupuesto no está Estimado ni Expirado' },
    ...erroresDeSesion,
  },
});

export const rutasPresupuestos = Router();

rutasPresupuestos.post('/', validar({ body: esquemaCrearPresupuesto }), asincrono(crear));
// Las consultas (HU-10 y HU-12) las gestiona el personal.
// Provisorio (decisión del PO, 06/10/2026): todo el personal ve y hace todo hasta que se dividan
// las funciones por rol.
const personalDeConsultas = [autenticar, autorizar(...ROLES_PERSONAL)] as const;

rutasPresupuestos.get(
  '/',
  ...personalDeConsultas,
  validar({ query: esquemaFiltrosPresupuestos }),
  asincrono(listar),
);
rutasPresupuestos.get(
  '/:id',
  ...personalDeConsultas,
  validar({ params: esquemaIdParam }),
  asincrono(obtener),
);
rutasPresupuestos.patch(
  '/:id',
  ...personalDeConsultas,
  validar({ params: esquemaIdParam, body: esquemaModificarPresupuesto }),
  asincrono(modificar),
);
rutasPresupuestos.post(
  '/:id/dar-de-baja',
  ...personalDeConsultas,
  validar({ params: esquemaIdParam }),
  asincrono(darDeBaja),
);
