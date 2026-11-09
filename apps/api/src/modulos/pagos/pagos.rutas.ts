import {
  esquemaCrearMedioPago,
  esquemaCrearPago,
  esquemaCuentaEvento,
  esquemaFiltrosMediosPago,
  esquemaMedioPago,
  esquemaModificarMedioPago,
  esquemaResultadoAnulacion,
  esquemaResultadoPago,
} from '@confluens/shared';
import { Router } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import {
  anular,
  crearMedio,
  listarCuenta,
  listarMedios,
  modificarMedio,
  registrar,
} from './pagos.controlador.js';

// Detalle de la capa HTTP, no se comparte con el frontend (igual que en eventos.rutas.ts).
const esquemaIdParam = z.object({ id: z.coerce.number().int().positive() });
const esquemaPagoParam = esquemaIdParam.extend({ pagoId: z.coerce.number().int().positive() });

// HU-14 C7: la lista de roles es una decisión explícita del PO, no se hereda de ROLES_PERSONAL.
// Hoy coincide en contenido, pero si mañana se agrega un rol al personal no debería poder cobrar
// solo por eso.
const ROLES_QUE_COBRAN = [
  'RESPONSABLE_EVENTOS',
  'RESPONSABLE_FINANZAS',
  'GERENTE_GENERAL',
  'ADMINISTRADOR_SISTEMA',
] as const;

registroOpenApi.registerPath({
  method: 'post',
  path: '/eventos/{id}/pagos',
  tags: ['Pagos'],
  summary:
    'Registra un pago del evento. Al cruzar el 20% de la base de cobro confirma el presupuesto y reserva el salón (HU-13); al 100% pasa a Cobrado',
  request: {
    params: esquemaIdParam,
    body: { content: { 'application/json': { schema: esquemaCrearPago } } },
  },
  responses: {
    201: {
      description: 'Pago registrado, con el saldo recalculado y el estado resultante del evento',
      content: { 'application/json': { schema: z.object({ data: esquemaResultadoPago }) } },
    },
    400: { description: 'Datos inválidos (monto menor o igual a cero, fecha mal formada)' },
    404: { description: 'No existe el evento, o el medio de pago no existe o está inactivo' },
    409: {
      description:
        'El evento está Cancelado o Cobrado, no tiene un presupuesto vigente, su presupuesto está Expirado (RN-06), o el salón ya está ocupado en esa franja por otro evento (RN-12)',
    },
    422: {
      description:
        'El importe supera el saldo, o el pago cruza el 20% y el evento todavía no tiene distribución ni horario agendados',
    },
    401: { description: 'Sin sesión activa' },
    403: { description: 'El rol no tiene permiso para registrar cobros' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/eventos/{id}/pagos/{pagoId}/anular',
  tags: ['Pagos'],
  summary:
    'Anula un pago sin borrarlo (HU-35): queda en la cuenta con la fecha y quién lo anuló, y deja de sumar. Un Cobrado que queda por debajo del total vuelve a Reservado; por debajo de la seña sigue Reservado y saldo.cubreSena lo avisa',
  request: { params: esquemaPagoParam },
  responses: {
    200: {
      description: 'Pago anulado, con el saldo recalculado y el estado resultante del evento',
      content: { 'application/json': { schema: z.object({ data: esquemaResultadoAnulacion }) } },
    },
    404: { description: 'No existe el evento, o el pago no es de ese evento' },
    409: { description: 'El pago ya está anulado, o el evento está Cancelado' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'El rol no tiene permiso para anular cobros' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/eventos/{id}/pagos',
  tags: ['Pagos'],
  summary:
    'Estado de cuenta del evento (HU-21): los pagos, con el que completó la seña y el que completó el total, y el saldo con la seña. Un evento Cancelado conserva sus pagos y su base',
  request: { params: esquemaIdParam },
  responses: {
    200: {
      description: 'Pagos y saldo',
      content: { 'application/json': { schema: z.object({ data: esquemaCuentaEvento }) } },
    },
    404: { description: 'No existe el evento' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/medios-pago',
  tags: ['Pagos'],
  summary:
    'Medios de pago con su habilitación con o sin factura (RN-14), en orden alfabético. Sin parámetros, solo los activos (formulario de cobro); con incluirInactivos=true, también los dados de baja (HU-20)',
  request: { query: esquemaFiltrosMediosPago },
  responses: {
    200: {
      description: 'Medios de pago',
      content: { 'application/json': { schema: z.object({ data: z.array(esquemaMedioPago) }) } },
    },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
  },
});

// Los pagos son un recurso anidado del evento, así que este router se monta también en `/eventos`
// (ver rutas.ts): las rutas que no matchean en rutasEventos caen acá.
export const rutasPagos = Router();

rutasPagos.post(
  '/:id/pagos',
  autenticar,
  autorizar(...ROLES_QUE_COBRAN),
  validar({ params: esquemaIdParam, body: esquemaCrearPago }),
  asincrono(registrar),
);
// HU-35: anula cualquier rol del personal, los mismos que registran pagos (PO, 06/11/2026).
rutasPagos.post(
  '/:id/pagos/:pagoId/anular',
  autenticar,
  autorizar(...ROLES_QUE_COBRAN),
  validar({ params: esquemaPagoParam }),
  asincrono(anular),
);
rutasPagos.get(
  '/:id/pagos',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaIdParam }),
  asincrono(listarCuenta),
);

registroOpenApi.registerPath({
  method: 'post',
  path: '/medios-pago',
  tags: ['Pagos'],
  summary:
    'Da de alta un medio de pago, eligiendo si se puede usar con factura, sin factura o en los dos casos (HU-19, RN-14)',
  request: { body: { content: { 'application/json': { schema: esquemaCrearMedioPago } } } },
  responses: {
    201: {
      description: 'Medio de pago creado, activo',
      content: { 'application/json': { schema: z.object({ data: esquemaMedioPago }) } },
    },
    400: { description: 'Nombre vacío o de más de 40 caracteres, o sin habilitar en ningún caso' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
    409: { description: 'Ya existe un medio con ese nombre (sin distinguir mayúsculas)' },
  },
});

registroOpenApi.registerPath({
  method: 'patch',
  path: '/medios-pago/{id}',
  tags: ['Pagos'],
  summary: 'Modifica el nombre de un medio de pago y en qué cobros se puede usar (HU-33, RN-14)',
  request: {
    params: esquemaIdParam,
    body: { content: { 'application/json': { schema: esquemaModificarMedioPago } } },
  },
  responses: {
    200: {
      description:
        'Medio modificado; los pagos ya registrados lo muestran con el nombre nuevo y la ' +
        'habilitación nueva vale desde el próximo cobro',
      content: { 'application/json': { schema: z.object({ data: esquemaMedioPago }) } },
    },
    400: { description: 'Nombre vacío o de más de 40 caracteres, o sin habilitar en ningún caso' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
    404: { description: 'No existe el medio de pago indicado' },
    409: { description: 'Otro medio ya tiene ese nombre (sin distinguir mayúsculas)' },
  },
});

export const rutasMediosPago = Router();

rutasMediosPago.get(
  '/',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ query: esquemaFiltrosMediosPago }),
  asincrono(listarMedios),
);
// HU-19: el actor es el Responsable de Finanzas, pero mientras no se dividan las funciones por rol
// todo el personal ve y hace todo (decisión del PO, 06/10/2026).
rutasMediosPago.post(
  '/',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ body: esquemaCrearMedioPago }),
  asincrono(crearMedio),
);

// HU-33: mismo criterio de roles que el alta (HU-19).
rutasMediosPago.patch(
  '/:id',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaIdParam, body: esquemaModificarMedioPago }),
  asincrono(modificarMedio),
);
