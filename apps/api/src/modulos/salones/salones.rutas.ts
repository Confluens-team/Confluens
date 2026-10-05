import {
  esquemaActualizarLandingSalon,
  esquemaSalon,
  esquemaSalonConDistribuciones,
  esquemaSalonPublico,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { actualizarLanding, listar, listarPublicos } from './salones.controlador.js';

registroOpenApi.registerPath({
  method: 'get',
  path: '/salones',
  tags: ['Salones'],
  summary: 'Lista los salones con sus distribuciones (HU-01)',
  responses: {
    200: {
      description: 'Catálogo completo de salones, ordenado por capacidad máxima descendente',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(esquemaSalonConDistribuciones) }),
        },
      },
    },
    401: { description: 'Sin sesión activa' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/salones/publicos',
  tags: ['Salones'],
  summary: 'Lista los salones publicados en la landing, sin autenticación (HU-07)',
  responses: {
    200: {
      description:
        'Salones con visibleEnLanding = true, sin precios: el canal público solo expone la ' +
        'información de referencia del salón',
      content: { 'application/json': { schema: z.object({ data: z.array(esquemaSalonPublico) }) } },
    },
  },
});

// El id llega como string en la URL; se coacciona una sola vez acá para que el controlador
// reciba un entero ya validado y un /salones/abc/landing corte en 400 y no en la consulta.
const esquemaParamsId = z.object({ id: z.coerce.number().int().positive() });

registroOpenApi.registerPath({
  method: 'patch',
  path: '/salones/{id}/landing',
  tags: ['Salones'],
  summary: 'Publica o despublica un salón de la landing y le asigna la foto (HU-08)',
  request: {
    params: esquemaParamsId,
    body: { content: { 'application/json': { schema: esquemaActualizarLandingSalon } } },
  },
  responses: {
    200: {
      description: 'Salón actualizado; el cambio queda registrado en audit_log',
      content: { 'application/json': { schema: z.object({ data: esquemaSalon }) } },
    },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es de un Administrador del Sistema' },
    404: { description: 'No existe el salón indicado' },
  },
});

export const rutasSalones = Router();

// /publicos va antes de cualquier ruta con parámetro: si en el futuro se agrega un GET /:id,
// Express matchearía "publicos" como id.
rutasSalones.get('/publicos', asincrono(listarPublicos));
// Con precios: cualquier sesión, del personal o del cliente (C5 de HU-48). Sin sesión, /publicos.
rutasSalones.get('/', autenticar, asincrono(listar));

// autenticar antes que autorizar (autorizar confía en req.usuario) y validar al final, para que
// un request sin sesión responda 401 y no filtre si el body estaba bien formado.
rutasSalones.patch(
  '/:id/landing',
  autenticar,
  autorizar('ADMINISTRADOR_SISTEMA'),
  validar({ params: esquemaParamsId, body: esquemaActualizarLandingSalon }),
  asincrono(actualizarLanding),
);
