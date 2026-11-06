import { esquemaFiltrosUsuarios, esquemaRegistrarUsuario, esquemaUsuario } from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { listar, registrar } from './usuarios.controlador.js';

registroOpenApi.registerPath({
  method: 'get',
  path: '/usuarios',
  tags: ['Usuarios'],
  summary: 'Lista los usuarios del personal, por rol y después por correo (HU-31)',
  request: { query: esquemaFiltrosUsuarios },
  responses: {
    200: {
      description: 'Usuarios del personal, sin los clientes',
      content: { 'application/json': { schema: z.object({ data: z.array(esquemaUsuario) }) } },
    },
    400: { description: 'El rol del filtro no es del personal' },
    401: { description: 'Sin sesión' },
    403: { description: 'La sesión no es del Gerente General ni del Administrador del Sistema' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/usuarios',
  tags: ['Usuarios'],
  summary: 'Da de alta a un usuario del personal con su rol y su contraseña inicial (HU-30)',
  request: { body: { content: { 'application/json': { schema: esquemaRegistrarUsuario } } } },
  responses: {
    201: {
      description: 'Usuario creado. La sesión de quien lo registra no cambia',
      content: { 'application/json': { schema: z.object({ data: esquemaUsuario }) } },
    },
    400: { description: 'Correo inválido, rol que no es del personal o contraseña corta' },
    401: { description: 'Sin sesión' },
    403: {
      description:
        'La sesión no es del GG ni del ADM, o es del GG y pide el rol Administrador del Sistema',
    },
    409: { description: 'Ya existe un usuario con ese correo' },
  },
});

export const rutasUsuarios = Router();

// Solo el GG y el ADM administran al personal (dominio.md, «Personal»).
const soloAdministranPersonal = [
  autenticar,
  autorizar('GERENTE_GENERAL', 'ADMINISTRADOR_SISTEMA'),
] as const;

rutasUsuarios.get(
  '/',
  ...soloAdministranPersonal,
  validar({ query: esquemaFiltrosUsuarios }),
  asincrono(listar),
);
rutasUsuarios.post(
  '/',
  ...soloAdministranPersonal,
  validar({ body: esquemaRegistrarUsuario }),
  asincrono(registrar),
);
