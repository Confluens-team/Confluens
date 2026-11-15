import {
  esquemaFiltrosAuditoria,
  esquemaFiltrosResumenAuditoria,
  esquemaMetaAuditoria,
  esquemaRegistroAuditoria,
  esquemaResumenAuditoria,
  esquemaRevisionAuditoria,
  ROL_QUE_REVISA_AUDITORIA,
  ROLES_QUE_VEN_AUDITORIA,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { campos, exportar, historial, listar, resumen, revisar } from './auditoria.controlador.js';

// Detalle de la capa HTTP, no se comparte con el frontend.
const esquemaIdParam = z.object({ id: z.coerce.number().int().positive() });

const sinPermiso = {
  401: { description: 'Sin sesión' },
  403: { description: 'Solo el Gerente General y el Administrador del Sistema' },
};

registroOpenApi.registerPath({
  method: 'get',
  path: '/auditoria',
  tags: ['Auditoría'],
  summary: 'Lista los cambios auditados, del más reciente al más antiguo (HU-25 del backlog)',
  request: { query: esquemaFiltrosAuditoria },
  responses: {
    200: {
      description:
        'Una página de cambios (usuario null es el Sistema), con cuántos hay de cada tipo con los mismos filtros',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(esquemaRegistroAuditoria), meta: esquemaMetaAuditoria }),
        },
      },
    },
    400: { description: 'Filtros inválidos' },
    ...sinPermiso,
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/auditoria/campos',
  tags: ['Auditoría'],
  summary: 'Los campos que aparecen en la auditoría, para el filtro por campo',
  responses: {
    200: {
      description: 'Campos en orden alfabético',
      content: { 'application/json': { schema: z.object({ data: z.array(z.string()) }) } },
    },
    ...sinPermiso,
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/auditoria/resumen',
  tags: ['Auditoría'],
  summary:
    'Resumen para el Gerente General: lo que pasó en los últimos días y lo que falta revisar',
  request: { query: esquemaFiltrosResumenAuditoria },
  responses: {
    200: {
      description: 'Indicadores del período, por persona y por parte del sistema',
      content: { 'application/json': { schema: z.object({ data: esquemaResumenAuditoria }) } },
    },
    ...sinPermiso,
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/auditoria/evento/{id}',
  tags: ['Auditoría'],
  summary: 'Historial de un evento: sus cambios y los de sus presupuestos, pagos y solicitud',
  request: { params: esquemaIdParam },
  responses: {
    200: {
      description: 'Cambios del más nuevo al más viejo',
      content: {
        'application/json': { schema: z.object({ data: z.array(esquemaRegistroAuditoria) }) },
      },
    },
    404: { description: 'El evento no existe' },
    ...sinPermiso,
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/auditoria/{id}/revision',
  tags: ['Auditoría'],
  summary: 'El Gerente General marca como revisado un cambio sensible de otro usuario',
  request: { params: esquemaIdParam },
  responses: {
    201: {
      description: 'La revisión',
      content: { 'application/json': { schema: z.object({ data: esquemaRevisionAuditoria }) } },
    },
    401: { description: 'Sin sesión' },
    403: { description: 'Solo el Gerente General' },
    404: { description: 'El cambio no existe' },
    409: { description: 'Ya estaba revisado' },
    422: { description: 'No es sensible, o lo hizo la gerencia o el Sistema' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/auditoria/exportar',
  tags: ['Auditoría'],
  summary: 'Los cambios con los filtros del registro, en CSV (hasta 5000)',
  request: { query: esquemaFiltrosAuditoria },
  responses: {
    200: { description: 'Archivo CSV', content: { 'text/csv': { schema: z.string() } } },
    400: { description: 'Filtros inválidos' },
    ...sinPermiso,
  },
});

export const rutasAuditoria = Router();

// La auditoría la ven solo el GG y el ADM (dominio.md, «Roles»); revisa solo el GG.
const soloGerencia = [autenticar, autorizar(...ROLES_QUE_VEN_AUDITORIA)] as const;

rutasAuditoria.get(
  '/',
  ...soloGerencia,
  validar({ query: esquemaFiltrosAuditoria }),
  asincrono(listar),
);
rutasAuditoria.get('/campos', ...soloGerencia, asincrono(campos));
rutasAuditoria.get(
  '/resumen',
  ...soloGerencia,
  validar({ query: esquemaFiltrosResumenAuditoria }),
  asincrono(resumen),
);
rutasAuditoria.get(
  '/exportar',
  ...soloGerencia,
  validar({ query: esquemaFiltrosAuditoria }),
  asincrono(exportar),
);
rutasAuditoria.get(
  '/evento/:id',
  ...soloGerencia,
  validar({ params: esquemaIdParam }),
  asincrono(historial),
);
rutasAuditoria.post(
  '/:id/revision',
  autenticar,
  autorizar(ROL_QUE_REVISA_AUDITORIA),
  validar({ params: esquemaIdParam }),
  asincrono(revisar),
);
