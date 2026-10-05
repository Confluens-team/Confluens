import {
  esquemaEventoAgenda,
  esquemaEventoDetallado,
  esquemaReservarEvento,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { cancelar, listar, marcarSena, obtener, reservar } from './eventos.controlador.js';

// Detalle de la capa HTTP, no se comparte con el frontend (a diferencia de los esquemas de body).
const esquemaIdParam = z.object({ id: z.coerce.number().int().positive() });

const respuestaEvento = {
  'application/json': { schema: z.object({ data: esquemaEventoDetallado }) },
};

registroOpenApi.registerPath({
  method: 'get',
  path: '/eventos',
  tags: ['Eventos'],
  summary: 'Agenda: eventos Reservado y Cobrado, por fecha (panel del Administrador del Sistema)',
  responses: {
    200: {
      description: 'Eventos que ocupan un salón',
      content: { 'application/json': { schema: z.object({ data: z.array(esquemaEventoAgenda) }) } },
    },
    401: { description: 'Sin sesión' },
    403: { description: 'El rol no es Administrador del Sistema' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/eventos/{id}',
  tags: ['Eventos'],
  summary: 'Obtiene el detalle completo de un evento (HU-15)',
  request: { params: esquemaIdParam },
  responses: {
    200: { description: 'Detalle del evento', content: respuestaEvento },
    404: { description: 'No existe el evento' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/eventos/{id}/reservar',
  tags: ['Eventos'],
  summary:
    'Confirma el presupuesto Estimado y reserva el salón en un solo paso (HU-15, criterios 1-3 y 7)',
  request: {
    params: esquemaIdParam,
    body: { content: { 'application/json': { schema: esquemaReservarEvento } } },
  },
  responses: {
    200: { description: 'Evento reservado', content: respuestaEvento },
    400: { description: 'Datos inválidos' },
    404: { description: 'No existe el evento o la distribución indicada' },
    409: {
      description:
        'El evento no está EnConsulta, no tiene presupuesto Estimado, o el salón ya está reservado en ese horario (criterio 2)',
    },
    422: {
      description: 'La cantidad de personas supera la capacidad de la distribución (criterio 3)',
    },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/eventos/{id}/registrar-sena',
  tags: ['Eventos'],
  summary: 'Marca la seña del evento como cobrada (HU-15, RN-06)',
  request: { params: esquemaIdParam },
  responses: {
    200: { description: 'Seña registrada', content: respuestaEvento },
    404: { description: 'No existe el evento' },
    409: { description: 'El evento no está Reservado' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/eventos/{id}/cancelar',
  tags: ['Eventos'],
  summary: 'Cancela el evento y libera el salón (HU-15, criterio 5 / RN-07)',
  request: { params: esquemaIdParam },
  responses: {
    200: { description: 'Evento cancelado', content: respuestaEvento },
    404: { description: 'No existe el evento' },
    409: { description: 'El evento no admite cancelación (estado Cobrado o ya Cancelado)' },
    422: { description: 'Faltan menos de 48 horas para el inicio del evento (RN-07)' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
  },
});

export const rutasEventos = Router();

rutasEventos.get('/', autenticar, autorizar('ADMINISTRADOR_SISTEMA'), asincrono(listar));
// Detalle y acciones de estado: funciones del panel interno, solo el personal (C6 de HU-48).
rutasEventos.get(
  '/:id',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaIdParam }),
  asincrono(obtener),
);
rutasEventos.post(
  '/:id/reservar',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaIdParam, body: esquemaReservarEvento }),
  asincrono(reservar),
);
rutasEventos.post(
  '/:id/registrar-sena',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaIdParam }),
  asincrono(marcarSena),
);
rutasEventos.post(
  '/:id/cancelar',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaIdParam }),
  asincrono(cancelar),
);
