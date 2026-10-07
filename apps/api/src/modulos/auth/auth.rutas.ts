import {
  esquemaCredenciales,
  esquemaPerfilCliente,
  esquemaRegistroCliente,
  esquemaRestablecerContrasena,
  esquemaSesion,
  esquemaSolicitarRestablecimiento,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar } from '../../middlewares/autorizar.js';
import { limitadorCredenciales, limitadorRegistro } from '../../middlewares/limitadores.js';
import { validar } from '../../middlewares/validar.js';
import {
  login,
  logout,
  olvidoContrasena,
  perfil,
  registro,
  restablecer,
  yo,
} from './auth.controlador.js';

registroOpenApi.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Inicia sesión y setea la cookie httpOnly con el JWT',
  request: { body: { content: { 'application/json': { schema: esquemaCredenciales } } } },
  responses: {
    200: {
      description: 'Credenciales válidas',
      content: { 'application/json': { schema: z.object({ data: esquemaSesion }) } },
    },
    401: { description: 'Credenciales inválidas' },
    429: { description: 'Demasiados intentos; el límite es por IP y ventana (H2)' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Auth'],
  summary: 'Cierra la sesión actual (limpia la cookie)',
  responses: { 204: { description: 'Sesión cerrada' } },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/auth/yo',
  tags: ['Auth'],
  summary: 'Devuelve la sesión autenticada actual',
  responses: {
    200: {
      description: 'Sesión vigente',
      content: { 'application/json': { schema: z.object({ data: esquemaSesion }) } },
    },
    401: { description: 'No autenticado' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/auth/registro',
  tags: ['Auth'],
  summary: 'Crea la cuenta de un Cliente desde la landing e inicia su sesión',
  request: { body: { content: { 'application/json': { schema: esquemaRegistroCliente } } } },
  responses: {
    201: {
      description: 'Cuenta creada; la cookie de sesión queda seteada',
      content: { 'application/json': { schema: z.object({ data: esquemaSesion }) } },
    },
    400: { description: 'Datos inválidos' },
    409: { description: 'Ya existe una cuenta con ese email' },
    429: { description: 'Demasiados registros desde la misma IP (H2)' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/auth/perfil',
  tags: ['Auth'],
  summary: 'Devuelve los datos comerciales del Cliente de la sesión',
  responses: {
    200: {
      description: 'Perfil del cliente',
      content: { 'application/json': { schema: z.object({ data: esquemaPerfilCliente }) } },
    },
    401: { description: 'No autenticado' },
    403: { description: 'La sesión no es de un Cliente' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/auth/contrasena/olvido',
  tags: ['Auth'],
  summary: 'Envía por correo el enlace para restablecer la contraseña (C8 de HU-48)',
  request: {
    body: { content: { 'application/json': { schema: esquemaSolicitarRestablecimiento } } },
  },
  responses: {
    204: {
      description:
        'Siempre la misma respuesta, exista o no una cuenta con ese email, para no revelar ' +
        'qué emails están registrados',
    },
    400: { description: 'El email no tiene un formato válido' },
    429: { description: 'Demasiados intentos; el límite es por IP y ventana (H2)' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/auth/contrasena/restablecer',
  tags: ['Auth'],
  summary: 'Cambia la contraseña con el token del enlace e inicia la sesión',
  request: {
    body: { content: { 'application/json': { schema: esquemaRestablecerContrasena } } },
  },
  responses: {
    200: {
      description: 'Contraseña cambiada; la cookie de sesión queda seteada',
      content: { 'application/json': { schema: z.object({ data: esquemaSesion }) } },
    },
    400: { description: 'Datos inválidos' },
    422: { description: 'El enlace venció, fue adulterado o ya se usó' },
    429: { description: 'Demasiados intentos; el límite es por IP y ventana (H2)' },
  },
});

export const rutasAuth = Router();

// H2 de la auditoría de seguridad: los limitadores van antes de validar() para que el tope corte
// el intento sin tocar la base ni el hasheo de bcrypt.
rutasAuth.post(
  '/login',
  limitadorCredenciales,
  validar({ body: esquemaCredenciales }),
  asincrono(login),
);
rutasAuth.post('/logout', logout);
rutasAuth.get('/yo', autenticar, yo);
rutasAuth.post(
  '/registro',
  limitadorRegistro,
  validar({ body: esquemaRegistroCliente }),
  asincrono(registro),
);
rutasAuth.get('/perfil', autenticar, autorizar('CLIENTE'), asincrono(perfil));
rutasAuth.post(
  '/contrasena/olvido',
  limitadorCredenciales,
  validar({ body: esquemaSolicitarRestablecimiento }),
  olvidoContrasena,
);
rutasAuth.post(
  '/contrasena/restablecer',
  limitadorCredenciales,
  validar({ body: esquemaRestablecerContrasena }),
  asincrono(restablecer),
);
