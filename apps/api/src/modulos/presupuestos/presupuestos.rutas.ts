import {
  esquemaConsultaDetallada,
  esquemaCrearConsultaSocial,
  esquemaCrearPresupuesto,
  esquemaFiltrosPresupuestos,
  esquemaModificarPresupuesto,
  esquemaPresupuestoDetallado,
  esquemaPresupuestoListado,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { limitadorEscrituras } from '../../middlewares/limitadores.js';
import { validar } from '../../middlewares/validar.js';
import {
  crear,
  crearSocial,
  darDeBaja,
  listar,
  modificar,
  obtener,
} from './presupuestos.controlador.js';

const esquemaIdParam = z.object({ id: z.coerce.number().int().positive() });
const respuestaConsulta = {
  'application/json': { schema: z.object({ data: esquemaConsultaDetallada }) },
};
const erroresDeSesion = {
  401: { description: 'Sin sesión activa' },
  403: { description: 'La sesión no es del personal' },
};

registroOpenApi.registerPath({
  method: 'post',
  path: '/presupuestos',
  tags: ['Presupuestos'],
  summary: 'Genera un presupuesto estimado a partir de salón, fecha, personas y servicios (HU-09)',
  request: { body: { content: { 'application/json': { schema: esquemaCrearPresupuesto } } } },
  responses: {
    201: {
      description: 'Presupuesto Estimado creado, con el evento en consulta y el detalle de líneas',
      content: { 'application/json': { schema: z.object({ data: esquemaPresupuestoDetallado }) } },
    },
    400: { description: 'Datos inválidos' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es de un cliente ni del personal' },
    404: { description: 'El salón o alguno de los servicios seleccionados no existe' },
    422: { description: 'Alguno de los servicios seleccionados no está activo' },
    429: { description: 'Se pasó el límite de presupuestos por ventana' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/presupuestos/social',
  tags: ['Presupuestos'],
  summary: 'Registra la consulta de un evento social, sin salón ni presupuesto armado (ADR 0008)',
  request: { body: { content: { 'application/json': { schema: esquemaCrearConsultaSocial } } } },
  responses: {
    201: {
      description:
        'Evento social en consulta, sin salón, con su presupuesto Estimado sin armar (sin líneas ni vencimiento)',
      content: { 'application/json': { schema: z.object({ data: esquemaPresupuestoDetallado }) } },
    },
    400: { description: 'Datos inválidos' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es de un cliente' },
    404: { description: 'La sesión no tiene ficha de cliente, o no existe la solicitud' },
    409: { description: 'La solicitud ya fue tomada' },
    429: { description: 'Se pasó el límite de consultas por ventana' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/presupuestos',
  tags: ['Presupuestos'],
  summary: 'Lista los presupuestos con su estado, del más reciente al más antiguo (HU-10)',
  request: { query: esquemaFiltrosPresupuestos },
  responses: {
    200: {
      description: 'Presupuestos que cumplen los filtros; lista vacía si ninguno los cumple',
      content: {
        'application/json': { schema: z.object({ data: z.array(esquemaPresupuestoListado) }) },
      },
    },
    400: { description: 'Filtros inválidos (estado, fechas o rango desde/hasta)' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/presupuestos/{id}',
  tags: ['Presupuestos'],
  summary: 'Detalle de una consulta para mostrarla y editarla (HU-12)',
  request: { params: esquemaIdParam },
  responses: {
    200: {
      description: 'La consulta con su evento, cliente, salón y líneas',
      content: respuestaConsulta,
    },
    404: { description: 'No existe el presupuesto' },
    ...erroresDeSesion,
  },
});

registroOpenApi.registerPath({
  method: 'patch',
  path: '/presupuestos/{id}',
  tags: ['Presupuestos'],
  summary:
    'Modifica una consulta (Estimado o Expirado, reinicia su vigencia) o el presupuesto de un evento confirmado (HU-12, RN-09)',
  request: {
    params: esquemaIdParam,
    body: { content: { 'application/json': { schema: esquemaModificarPresupuesto } } },
  },
  responses: {
    200: {
      description:
        'Consulta modificada: en Estimado con 10 días de vigencia, o Confirmado con el estado del evento según lo pagado',
      content: respuestaConsulta,
    },
    400: { description: 'Datos inválidos' },
    404: { description: 'No existe el presupuesto, el salón o un servicio' },
    409: {
      description:
        'El presupuesto está Cancelado o su evento no está en un estado que se pueda modificar, o la fecha o el salón nuevos pisan a otro evento reservado (RN-12)',
    },
    422: {
      description:
        'Se agregó un servicio que no está activo, o a un evento confirmado se le sacó el salón',
    },
    ...erroresDeSesion,
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/presupuestos/{id}/dar-de-baja',
  tags: ['Presupuestos'],
  summary: 'Da de baja una consulta: pasa a Cancelado (HU-12, RN-08)',
  request: { params: esquemaIdParam },
  responses: {
    200: { description: 'Consulta cancelada', content: respuestaConsulta },
    404: { description: 'No existe el presupuesto' },
    409: { description: 'El presupuesto no está Estimado ni Expirado' },
    ...erroresDeSesion,
  },
});

export const rutasPresupuestos = Router();

// H1 de la auditoría de seguridad (OWASP A01): este POST estaba montado solo con validar(), sin
// autenticar ni autorizar, y cualquiera sin sesión podía crear Cliente + Evento + Presupuesto en
// la base. El cotizador es de cara al cliente —la web manda a /acceso antes de /cotizar— pero se
// deja abierto también al personal, que cotiza para un cliente que llama por teléfono.
rutasPresupuestos.post(
  '/',
  autenticar,
  autorizar('CLIENTE', ...ROLES_PERSONAL),
  limitadorEscrituras,
  validar({ body: esquemaCrearPresupuesto }),
  asincrono(crear),
);
// ADR 0008: la consulta social la manda el cliente desde su cuenta.
rutasPresupuestos.post(
  '/social',
  autenticar,
  autorizar('CLIENTE'),
  limitadorEscrituras,
  validar({ body: esquemaCrearConsultaSocial }),
  asincrono(crearSocial),
);
// Las consultas (HU-10 y HU-12) las gestiona el personal.
// Provisorio (decisión del PO, 06/10/2026): todo el personal ve y hace todo hasta que se dividan
// las funciones por rol.
const personalDeConsultas = [autenticar, autorizar(...ROLES_PERSONAL)] as const;

rutasPresupuestos.get(
  '/',
  ...personalDeConsultas,
  validar({ query: esquemaFiltrosPresupuestos }),
  asincrono(listar),
);
rutasPresupuestos.get(
  '/:id',
  ...personalDeConsultas,
  validar({ params: esquemaIdParam }),
  asincrono(obtener),
);
rutasPresupuestos.patch(
  '/:id',
  ...personalDeConsultas,
  validar({ params: esquemaIdParam, body: esquemaModificarPresupuesto }),
  asincrono(modificar),
);
rutasPresupuestos.post(
  '/:id/dar-de-baja',
  ...personalDeConsultas,
  validar({ params: esquemaIdParam }),
  asincrono(darDeBaja),
);
