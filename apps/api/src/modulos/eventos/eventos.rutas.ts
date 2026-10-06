import {
  esquemaAgendarEvento,
  esquemaEventoAgenda,
  esquemaEventoDetallado,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { agendar, cancelar, listar, obtener } from './eventos.controlador.js';

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
  path: '/eventos/{id}/agendar',
  tags: ['Eventos'],
  summary:
    'Fija distribución, horario y modalidad del evento. NO lo reserva: eso lo hace el pago del 20% (HU-13)',
  request: {
    params: esquemaIdParam,
    body: { content: { 'application/json': { schema: esquemaAgendarEvento } } },
  },
  responses: {
    200: { description: 'Evento agendado; sigue EnConsulta', content: respuestaEvento },
    400: { description: 'Datos inválidos' },
    404: { description: 'No existe el evento o la distribución indicada' },
    409: {
      description:
        'El evento no está EnConsulta, o el salón ya está ocupado en ese horario por otro evento Reservado o Cobrado (RN-12)',
    },
    422: {
      description:
        'La cantidad de personas supera la capacidad de la distribución, o el fin no es posterior al inicio',
    },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/eventos/{id}/cancelar',
  tags: ['Eventos'],
  summary:
    'Cancela el evento y libera el salón (RN-07). Siempre manual: no hay cancelación automática',
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
  '/:id/agendar',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaIdParam, body: esquemaAgendarEvento }),
  asincrono(agendar),
);
rutasEventos.post(
  '/:id/cancelar',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaIdParam }),
  asincrono(cancelar),
);
