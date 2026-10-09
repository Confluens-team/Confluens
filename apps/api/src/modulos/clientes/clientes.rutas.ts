import { esquemaAsignarEtiqueta, esquemaClienteConResumen } from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { asignarEtiqueta, listar } from './clientes.controlador.js';

// Detalle de la capa HTTP, no se comparte con el frontend (a diferencia de los esquemas de body).
const esquemaIdParam = z.object({ id: z.coerce.number().int().positive() });

registroOpenApi.registerPath({
  method: 'get',
  path: '/clientes',
  tags: ['Clientes'],
  summary: 'Lista los clientes con su cantidad de eventos y solicitudes (panel del administrador)',
  responses: {
    200: {
      description: 'Clientes ordenados por nombre',
      content: {
        'application/json': { schema: z.object({ data: z.array(esquemaClienteConResumen) }) },
      },
    },
    401: { description: 'Sin sesión' },
    403: { description: 'La sesión no es del personal' },
  },
});

registroOpenApi.registerPath({
  method: 'patch',
  path: '/clientes/{id}/etiqueta',
  tags: ['Clientes'],
  summary: 'Le asigna una etiqueta al cliente, o se la quita con etiquetaId null',
  request: {
    params: esquemaIdParam,
    body: { content: { 'application/json': { schema: esquemaAsignarEtiqueta } } },
  },
  responses: {
    200: {
      description: 'El cliente con su etiqueta actualizada',
      content: { 'application/json': { schema: z.object({ data: esquemaClienteConResumen }) } },
    },
    400: { description: 'Datos inválidos' },
    401: { description: 'Sin sesión' },
    403: { description: 'La sesión no es del personal' },
    404: { description: 'No existe el cliente o la etiqueta' },
  },
});

export const rutasClientes = Router();

// Solo para el personal: tiene datos de contacto de los clientes y su etiqueta, que es interna.
// Provisorio (decisión del PO, 06/10/2026): todo el personal ve y hace todo hasta que se dividan
// las funciones por rol.
rutasClientes.get('/', autenticar, autorizar(...ROLES_PERSONAL), asincrono(listar));
rutasClientes.patch(
  '/:id/etiqueta',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaIdParam, body: esquemaAsignarEtiqueta }),
  asincrono(asignarEtiqueta),
);
