import { esquemaCrearEtiqueta, esquemaEtiqueta } from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { crear, listar } from './etiquetas.controlador.js';

registroOpenApi.registerPath({
  method: 'get',
  path: '/etiquetas',
  tags: ['Etiquetas'],
  summary: 'Lista las etiquetas que el personal le puede asignar a un cliente',
  responses: {
    200: {
      description: 'Etiquetas ordenadas por nombre',
      content: { 'application/json': { schema: z.object({ data: z.array(esquemaEtiqueta) }) } },
    },
    401: { description: 'Sin sesión' },
    403: { description: 'La sesión no es del personal' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/etiquetas',
  tags: ['Etiquetas'],
  summary: 'Crea una etiqueta. El nombre es único sin distinguir mayúsculas',
  request: { body: { content: { 'application/json': { schema: esquemaCrearEtiqueta } } } },
  responses: {
    201: {
      description: 'Etiqueta creada',
      content: { 'application/json': { schema: z.object({ data: esquemaEtiqueta }) } },
    },
    400: { description: 'Nombre vacío o de más de 40 caracteres' },
    401: { description: 'Sin sesión' },
    403: { description: 'La sesión no es del personal' },
    409: { description: 'Ya existe una etiqueta con ese nombre' },
  },
});

export const rutasEtiquetas = Router();

// Solo el personal: la etiqueta es una nota interna sobre el cliente (dominio.md).
rutasEtiquetas.get('/', autenticar, autorizar(...ROLES_PERSONAL), asincrono(listar));
rutasEtiquetas.post(
  '/',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ body: esquemaCrearEtiqueta }),
  asincrono(crear),
);
