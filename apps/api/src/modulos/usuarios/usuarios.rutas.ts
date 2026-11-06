import { esquemaRegistrarUsuario, esquemaUsuario } from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { registrar } from './usuarios.controlador.js';

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

rutasUsuarios.post(
  '/',
  ...soloAdministranPersonal,
  validar({ body: esquemaRegistrarUsuario }),
  asincrono(registrar),
);
