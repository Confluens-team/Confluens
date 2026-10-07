import {
  esquemaActualizarLandingServicio,
  esquemaCrearServicio,
  esquemaServicio,
  esquemaServicioPublico,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { actualizarLanding, crear, listar, listarPublicos } from './servicios.controlador.js';

registroOpenApi.registerPath({
  method: 'get',
  path: '/servicios',
  tags: ['Servicios'],
  summary: 'Lista los servicios activos del catálogo (HU-32)',
  responses: {
    200: {
      description: 'Catálogo de servicios activos, ordenado por nombre',
      content: { 'application/json': { schema: z.object({ data: z.array(esquemaServicio) }) } },
    },
    401: { description: 'Sin sesión activa' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/servicios',
  tags: ['Servicios'],
  summary: 'Registra un servicio nuevo en el catálogo (HU-32)',
  request: { body: { content: { 'application/json': { schema: esquemaCrearServicio } } } },
  responses: {
    201: {
      description: 'Servicio creado',
      content: { 'application/json': { schema: z.object({ data: esquemaServicio }) } },
    },
    409: { description: 'Ya existe un servicio con ese nombre' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/servicios/publicos',
  tags: ['Servicios'],
  summary: 'Lista la oferta gastronómica para la landing, sin autenticación (HU-07)',
  responses: {
    200: {
      description:
        'Servicios activos agrupables por categoría, sin precios: el canal público describe la ' +
        'oferta, no la presupuesta',
      content: {
        'application/json': { schema: z.object({ data: z.array(esquemaServicioPublico) }) },
      },
    },
  },
});

const esquemaParamsId = z.object({ id: z.coerce.number().int().positive() });

registroOpenApi.registerPath({
  method: 'patch',
  path: '/servicios/{id}/landing',
  tags: ['Servicios'],
  summary: 'Asigna o quita la foto del servicio en la landing (HU-08)',
  request: {
    params: esquemaParamsId,
    body: { content: { 'application/json': { schema: esquemaActualizarLandingServicio } } },
  },
  responses: {
    200: {
      description: 'Servicio actualizado; el cambio queda registrado en audit_log',
      content: { 'application/json': { schema: z.object({ data: esquemaServicio }) } },
    },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
    404: { description: 'No existe el servicio indicado' },
  },
});

export const rutasServicios = Router();

// /publicos va antes de cualquier ruta con parámetro (ver salones.rutas.ts).
rutasServicios.get('/publicos', asincrono(listarPublicos));
// H6 de la auditoría de seguridad: revisado y confirmado como intencional. Este listado con
// precios lo necesita el cotizador del cliente (C5 de HU-48), así que exige sesión pero no rol;
// el canal sin sesión tiene /publicos, que no expone precios ni el flag activo.
rutasServicios.get('/', autenticar, asincrono(listar));
rutasServicios.post(
  '/',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ body: esquemaCrearServicio }),
  asincrono(crear),
);
// Provisorio (decisión del PO, 06/10/2026): todo el personal ve y hace todo hasta que se dividan
// las funciones por rol.
rutasServicios.patch(
  '/:id/landing',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaParamsId, body: esquemaActualizarLandingServicio }),
  asincrono(actualizarLanding),
);
