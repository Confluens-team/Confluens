import {
  esquemaCambiarContrasenaUsuario,
  esquemaCambiarEstadoUsuario,
  esquemaFiltrosUsuarios,
  esquemaModificarUsuario,
  esquemaRegistrarUsuario,
  esquemaUsuario,
  esquemaUsuarioDelListado,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import {
  cambiarContrasena,
  cambiarEstado,
  listar,
  modificar,
  registrar,
} from './usuarios.controlador.js';

const esquemaIdParam = z.object({ id: z.coerce.number().int().positive() });

registroOpenApi.registerPath({
  method: 'get',
  path: '/usuarios',
  tags: ['Usuarios'],
  summary:
    'Lista los usuarios del personal, por rol y después por correo (HU-31), con su última actividad y su estado de conexión',
  request: { query: esquemaFiltrosUsuarios },
  responses: {
    200: {
      description: 'Usuarios del personal, sin los clientes',
      content: {
        'application/json': { schema: z.object({ data: z.array(esquemaUsuarioDelListado) }) },
      },
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

registroOpenApi.registerPath({
  method: 'patch',
  path: '/usuarios/{id}',
  tags: ['Usuarios'],
  summary: 'Modifica el correo y el rol de un usuario del personal (HU-30 del backlog)',
  request: {
    params: esquemaIdParam,
    body: { content: { 'application/json': { schema: esquemaModificarUsuario } } },
  },
  responses: {
    200: {
      description: 'Usuario modificado; el rol nuevo rige desde su próximo request',
      content: { 'application/json': { schema: z.object({ data: esquemaUsuario }) } },
    },
    400: { description: 'Correo inválido o rol que no es del personal' },
    401: { description: 'Sin sesión' },
    403: {
      description:
        'La sesión no es del GG ni del ADM, el GG quiere modificar a un ADM o asignar ese rol, o es su propio rol',
    },
    404: { description: 'No existe el usuario del personal' },
    409: { description: 'Ya existe un usuario con ese correo' },
    422: { description: 'El cambio deja sin ningún GG o ADM activo' },
  },
});

registroOpenApi.registerPath({
  method: 'patch',
  path: '/usuarios/{id}/estado',
  tags: ['Usuarios'],
  summary:
    'Da de baja (activo: false) o reactiva (activo: true) a un usuario del personal (HU-31 del backlog). La baja cierra sus sesiones',
  request: {
    params: esquemaIdParam,
    body: { content: { 'application/json': { schema: esquemaCambiarEstadoUsuario } } },
  },
  responses: {
    200: {
      description: 'Usuario con su estado nuevo',
      content: { 'application/json': { schema: z.object({ data: esquemaUsuario }) } },
    },
    400: { description: 'Falta activo o no es booleano' },
    401: { description: 'Sin sesión' },
    403: {
      description:
        'La sesión no es del GG ni del ADM, el GG quiere dar de baja a un ADM, o es su propia cuenta',
    },
    404: { description: 'No existe el usuario del personal' },
    422: { description: 'La baja deja sin ningún GG o ADM activo' },
  },
});

registroOpenApi.registerPath({
  method: 'put',
  path: '/usuarios/{id}/contrasena',
  tags: ['Usuarios'],
  summary:
    'El ADM le carga una contraseña nueva a un usuario del personal (HU-30 del backlog). Cierra sus sesiones',
  request: {
    params: esquemaIdParam,
    body: { content: { 'application/json': { schema: esquemaCambiarContrasenaUsuario } } },
  },
  responses: {
    204: { description: 'Contraseña cambiada' },
    400: {
      description:
        'La contraseña no cumple la política: 8 a 72 bytes, sin ser solo espacios, un carácter repetido ni una contraseña común',
    },
    401: { description: 'Sin sesión' },
    403: { description: 'La sesión no es del Administrador del Sistema' },
    404: { description: 'No existe el usuario del personal' },
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
rutasUsuarios.patch(
  '/:id',
  ...soloAdministranPersonal,
  validar({ params: esquemaIdParam, body: esquemaModificarUsuario }),
  asincrono(modificar),
);
rutasUsuarios.patch(
  '/:id/estado',
  ...soloAdministranPersonal,
  validar({ params: esquemaIdParam, body: esquemaCambiarEstadoUsuario }),
  asincrono(cambiarEstado),
);
// Solo el ADM cambia la contraseña de otro usuario (PO, 06/11/2026).
rutasUsuarios.put(
  '/:id/contrasena',
  autenticar,
  autorizar('ADMINISTRADOR_SISTEMA'),
  validar({ params: esquemaIdParam, body: esquemaCambiarContrasenaUsuario }),
  asincrono(cambiarContrasena),
);
