import {
  esquemaAsignarEtiqueta,
  esquemaClienteConResumen,
  esquemaFiltrosClientes,
  esquemaFiltrosHistorialCliente,
  esquemaHistorialCliente,
  esquemaModificarCliente,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { asignarEtiqueta, historial, listar, modificar, obtener } from './clientes.controlador.js';

// Detalle de la capa HTTP, no se comparte con el frontend (a diferencia de los esquemas de body).
const esquemaIdParam = z.object({ id: z.coerce.number().int().positive() });

registroOpenApi.registerPath({
  method: 'get',
  path: '/clientes',
  tags: ['Clientes'],
  summary:
    'Lista los clientes con su cantidad de eventos y solicitudes (HU-16). `busqueda`: cada ' +
    'palabra tiene que aparecer en el nombre, el apellido, el correo, el teléfono o la etiqueta',
  request: { query: esquemaFiltrosClientes },
  responses: {
    200: {
      description: 'Clientes en orden alfabético por apellido y nombre',
      content: {
        'application/json': { schema: z.object({ data: z.array(esquemaClienteConResumen) }) },
      },
    },
    400: { description: 'La búsqueda supera los 100 caracteres' },
    401: { description: 'Sin sesión' },
    403: { description: 'La sesión no es del personal' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/clientes/{id}',
  tags: ['Clientes'],
  summary: 'Ficha de un cliente, con su etiqueta y su cantidad de eventos y solicitudes (HU-16)',
  request: { params: esquemaIdParam },
  responses: {
    200: {
      description: 'El cliente',
      content: { 'application/json': { schema: z.object({ data: esquemaClienteConResumen }) } },
    },
    401: { description: 'Sin sesión' },
    403: { description: 'La sesión no es del personal' },
    404: { description: 'No existe el cliente' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/clientes/{id}/eventos',
  tags: ['Clientes'],
  summary:
    'Historial de eventos de un cliente, en cualquier estado y del más reciente al más antiguo ' +
    '(HU-18), con la cantidad de eventos en cada estado. `estado` admite varios separados por coma',
  request: { params: esquemaIdParam, query: esquemaFiltrosHistorialCliente },
  responses: {
    200: {
      description:
        'Los eventos que cumplen los filtros y el resumen por estado de todos los del cliente',
      content: { 'application/json': { schema: z.object({ data: esquemaHistorialCliente }) } },
    },
    400: { description: 'Un filtro no es válido (estado inexistente o rango de fechas invertido)' },
    401: { description: 'Sin sesión' },
    403: { description: 'La sesión no es del personal' },
    404: { description: 'No existe el cliente' },
  },
});

registroOpenApi.registerPath({
  method: 'patch',
  path: '/clientes/{id}',
  tags: ['Clientes'],
  summary:
    'Modifica los datos de contacto de un cliente (HU-17): nombre, apellido y teléfono de ' +
    'cualquiera; el correo solo si el cliente no tiene cuenta',
  request: {
    params: esquemaIdParam,
    body: { content: { 'application/json': { schema: esquemaModificarCliente } } },
  },
  responses: {
    200: {
      description: 'El cliente con sus datos actualizados',
      content: { 'application/json': { schema: z.object({ data: esquemaClienteConResumen }) } },
    },
    400: { description: 'Falta un dato o es inválido; el detalle indica el campo' },
    401: { description: 'Sin sesión' },
    403: { description: 'La sesión no es del personal' },
    404: { description: 'No existe el cliente' },
    409: { description: 'El correo ya pertenece a otro cliente' },
    422: { description: 'Se intentó cambiar el correo de un cliente con cuenta' },
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
rutasClientes.get(
  '/',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ query: esquemaFiltrosClientes }),
  asincrono(listar),
);
rutasClientes.get(
  '/:id',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaIdParam }),
  asincrono(obtener),
);
rutasClientes.get(
  '/:id/eventos',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaIdParam, query: esquemaFiltrosHistorialCliente }),
  asincrono(historial),
);
rutasClientes.patch(
  '/:id',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaIdParam, body: esquemaModificarCliente }),
  asincrono(modificar),
);
rutasClientes.patch(
  '/:id/etiqueta',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaIdParam, body: esquemaAsignarEtiqueta }),
  asincrono(asignarEtiqueta),
);
