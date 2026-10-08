import { esquemaFirmaSubida, esquemaPedidoFirma } from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { firmar } from './fotos.controlador.js';

registroOpenApi.registerPath({
  method: 'post',
  path: '/fotos/firma',
  tags: ['Fotos'],
  summary: 'Firma la subida de una foto de la landing directo a Cloudinary (ADR 0009)',
  request: { body: { content: { 'application/json': { schema: esquemaPedidoFirma } } } },
  responses: {
    200: {
      description: 'Parámetros firmados para subir el archivo a Cloudinary',
      content: { 'application/json': { schema: z.object({ data: esquemaFirmaSubida }) } },
    },
    400: { description: 'Destino inválido' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
    422: { description: 'Cloudinary no está configurado' },
  },
});

// Mismos roles que el PATCH /:id/landing de salones y servicios, que es donde termina la URL.
export const rutasFotos = Router();

rutasFotos.post(
  '/firma',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ body: esquemaPedidoFirma }),
  // Síncrono: Express 4 ya pasa al manejador de errores lo que se lance acá.
  firmar,
);
