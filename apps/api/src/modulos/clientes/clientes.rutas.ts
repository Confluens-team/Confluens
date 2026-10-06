import { esquemaClienteConResumen } from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { listar } from './clientes.controlador.js';

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

export const rutasClientes = Router();

// Solo lectura y solo para el personal: tiene datos de contacto de los clientes.
// Provisorio (decisión del PO, 06/10/2026): todo el personal ve y hace todo hasta que se dividan
// las funciones por rol.
rutasClientes.get('/', autenticar, autorizar(...ROLES_PERSONAL), asincrono(listar));
