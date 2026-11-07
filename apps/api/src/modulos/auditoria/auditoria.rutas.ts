import {
  esquemaFiltrosAuditoria,
  esquemaRegistroAuditoria,
  ROLES_QUE_VEN_AUDITORIA,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import { campos, listar } from './auditoria.controlador.js';

const esquemaMeta = z.object({ page: z.number(), pageSize: z.number(), total: z.number() });

registroOpenApi.registerPath({
  method: 'get',
  path: '/auditoria',
  tags: ['Auditoría'],
  summary: 'Lista los cambios auditados, del más reciente al más antiguo (HU-25 del backlog)',
  request: { query: esquemaFiltrosAuditoria },
  responses: {
    200: {
      description: 'Una página de cambios. usuario null es el Sistema',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(esquemaRegistroAuditoria), meta: esquemaMeta }),
        },
      },
    },
    400: { description: 'Filtros inválidos' },
    401: { description: 'Sin sesión' },
    403: { description: 'Solo el Gerente General y el Administrador del Sistema' },
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
    401: { description: 'Sin sesión' },
    403: { description: 'Solo el Gerente General y el Administrador del Sistema' },
  },
});

export const rutasAuditoria = Router();

// La auditoría la ven solo el GG y el ADM (dominio.md, «Roles»).
const soloGerencia = [autenticar, autorizar(...ROLES_QUE_VEN_AUDITORIA)] as const;

rutasAuditoria.get(
  '/',
  ...soloGerencia,
  validar({ query: esquemaFiltrosAuditoria }),
  asincrono(listar),
);
rutasAuditoria.get('/campos', ...soloGerencia, asincrono(campos));
