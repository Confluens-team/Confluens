import { esquemaCrearSolicitud, esquemaSolicitud } from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { crear, listar } from './solicitudes.controlador.js';

registroOpenApi.registerPath({
  method: 'get',
  path: '/solicitudes',
  tags: ['Solicitudes'],
  summary: 'Lista las solicitudes del canal público, sin filtrar (HU-14)',
  responses: {
    200: {
      description: 'Solicitudes ordenadas por fecha de creación',
      content: { 'application/json': { schema: z.object({ data: z.array(esquemaSolicitud) }) } },
    },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/solicitudes',
  tags: ['Solicitudes'],
  summary: 'Registra una solicitud desde el canal público; requiere sesión (HU-14, HU-48)',
  request: { body: { content: { 'application/json': { schema: esquemaCrearSolicitud } } } },
  responses: {
    201: {
      description: 'Solicitud creada',
      content: { 'application/json': { schema: z.object({ data: esquemaSolicitud }) } },
    },
    400: { description: 'Faltan datos de contacto o la fecha deseada' },
    401: { description: 'Sin sesión activa' },
  },
});

export const rutasSolicitudes = Router();

// El listado tiene los datos de contacto de todos los clientes: solo el personal (C6 de HU-48).
rutasSolicitudes.get('/', autenticar, autorizar(...ROLES_PERSONAL), asincrono(listar));
// Desde HU-07 consultar exige cuenta, así que crear una solicitud pide sesión. Qué roles pueden
// hacerlo y cómo se asocia al cliente de la sesión lo define HU-49.
rutasSolicitudes.post('/', autenticar, validar({ body: esquemaCrearSolicitud }), asincrono(crear));
