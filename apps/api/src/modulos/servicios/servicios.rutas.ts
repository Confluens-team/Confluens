import {
  esquemaActualizarLandingServicio,
  esquemaCrearServicio,
  esquemaModificarServicio,
  esquemaServicio,
  esquemaServicioPublico,
  ROLES_QUE_CAMBIAN_FOTOS,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import {
  actualizarLanding,
  crear,
  listar,
  listarPublicos,
  modificar,
} from './servicios.controlador.js';

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
    403: { description: 'Solo el Gerente General y el Administrador del Sistema' },
    404: { description: 'No existe el servicio indicado' },
  },
});

registroOpenApi.registerPath({
  method: 'patch',
  path: '/servicios/{id}',
  tags: ['Servicios'],
  summary: 'Modifica los datos de un servicio del catálogo (HU-32 del Sprint 4)',
  request: {
    params: esquemaParamsId,
    body: { content: { 'application/json': { schema: esquemaModificarServicio } } },
  },
  responses: {
    200: {
      description:
        'Servicio modificado; los presupuestos ya emitidos conservan su precio congelado (RN-03)',
      content: { 'application/json': { schema: z.object({ data: esquemaServicio }) } },
    },
    400: { description: 'Datos inválidos, o a cotizar sin ser tercerizado' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
    404: { description: 'No existe el servicio indicado' },
    409: { description: 'El nombre ya es de otro servicio' },
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
// HU-56: lo único que trae es la foto, que cambian el GG y el ADM. El resto de los servicios y
// precios lo administran los cuatro roles del personal.
rutasServicios.patch(
  '/:id/landing',
  autenticar,
  autorizar(...ROLES_QUE_CAMBIAN_FOTOS),
  validar({ params: esquemaParamsId, body: esquemaActualizarLandingServicio }),
  asincrono(actualizarLanding),
);

// HU-32 (Sprint 4). Mismo orden de middlewares que el de la landing.
rutasServicios.patch(
  '/:id',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaParamsId, body: esquemaModificarServicio }),
  asincrono(modificar),
);
