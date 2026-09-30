import {
  esquemaCredenciales,
  esquemaPerfilCliente,
  esquemaRegistroCliente,
  esquemaSesion,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { login, logout, perfil, registro, yo } from './auth.controlador.js';

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

export const rutasAuth = Router();

rutasAuth.post('/login', validar({ body: esquemaCredenciales }), asincrono(login));
rutasAuth.post('/logout', logout);
rutasAuth.get('/yo', autenticar, yo);
rutasAuth.post('/registro', validar({ body: esquemaRegistroCliente }), asincrono(registro));
rutasAuth.get('/perfil', autenticar, autorizar('CLIENTE'), asincrono(perfil));
