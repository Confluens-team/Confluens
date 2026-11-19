import {
  esquemaActualizarLandingSalon,
  esquemaCambiarEstadoDistribucion,
  esquemaCrearDistribucion,
  esquemaDistribucion,
  esquemaModificarDistribucion,
  esquemaModificarSalon,
  esquemaSalon,
  esquemaSalonConDistribuciones,
  esquemaSalonPublico,
  puedePublicarEnLanding,
  ROLES_QUE_CAMBIAN_FOTOS,
  type ActualizarLandingSalon,
} from '@confluens/shared';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';

import { registroOpenApi } from '../../docs/openapi.js';
import { asincrono } from '../../lib/asincrono.js';
import { ErrorApi } from '../../lib/errores.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar, ROLES_PERSONAL } from '../../middlewares/autorizar.js';
import { validar } from '../../middlewares/validar.js';
import {
  actualizarLanding,
  cambiarEstado,
  crearDistribucion,
  listar,
  listarPublicos,
  modificar,
  editarDistribucion,
} from './salones.controlador.js';

registroOpenApi.registerPath({
  method: 'get',
  path: '/salones',
  tags: ['Salones'],
  summary: 'Lista los salones con sus distribuciones (HU-01)',
  responses: {
    200: {
      description: 'Catálogo completo de salones, ordenado por capacidad máxima descendente',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(esquemaSalonConDistribuciones) }),
        },
      },
    },
    401: { description: 'Sin sesión activa' },
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: '/salones/publicos',
  tags: ['Salones'],
  summary: 'Lista los salones publicados en la landing, sin autenticación (HU-07)',
  responses: {
    200: {
      description:
        'Salones con visibleEnLanding = true, sin precios: el canal público solo expone la ' +
        'información de referencia del salón',
      content: { 'application/json': { schema: z.object({ data: z.array(esquemaSalonPublico) }) } },
    },
  },
});

// El id llega como string en la URL; se coacciona una sola vez acá para que el controlador
// reciba un entero ya validado y un /salones/abc/landing corte en 400 y no en la consulta.
const esquemaParamsId = z.object({ id: z.coerce.number().int().positive() });

registroOpenApi.registerPath({
  method: 'patch',
  path: '/salones/{id}/landing',
  tags: ['Salones'],
  summary: 'Publica o despublica un salón de la landing y le asigna la foto (HU-08)',
  request: {
    params: esquemaParamsId,
    body: { content: { 'application/json': { schema: esquemaActualizarLandingSalon } } },
  },
  responses: {
    200: {
      description: 'Salón actualizado; el cambio queda registrado en audit_log',
      content: { 'application/json': { schema: z.object({ data: esquemaSalon }) } },
    },
    401: { description: 'Sin sesión activa' },
    403: {
      description:
        'Solo el Gerente General y el Administrador del Sistema; publicar un salón, solo el Administrador del Sistema',
    },
    404: { description: 'No existe el salón indicado' },
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/salones/{id}/distribuciones',
  tags: ['Salones'],
  summary: 'Registra una distribución posible de un salón (HU-25)',
  request: {
    params: esquemaParamsId,
    body: { content: { 'application/json': { schema: esquemaCrearDistribucion } } },
  },
  responses: {
    201: {
      description: 'Distribución creada; queda disponible al presupuestar y al agendar',
      content: { 'application/json': { schema: z.object({ data: esquemaDistribucion }) } },
    },
    400: { description: 'Nombre o capacidad inválidos' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
    404: { description: 'No existe el salón indicado' },
    409: {
      description: 'El salón ya tiene una distribución con ese nombre (sin distinguir mayúsculas)',
    },
    422: { description: 'La capacidad supera la capacidad máxima del salón' },
  },
});

registroOpenApi.registerPath({
  method: 'patch',
  path: '/salones/{id}',
  tags: ['Salones'],
  summary: 'Modifica los precios de un salón (HU-26 del Sprint 4)',
  request: {
    params: esquemaParamsId,
    body: { content: { 'application/json': { schema: esquemaModificarSalon } } },
  },
  responses: {
    200: {
      description:
        'Salón modificado, con sus distribuciones. La capacidad máxima y la superficie no se ' +
        'modifican. Los presupuestos ya emitidos conservan su precio congelado (RN-03)',
      content: {
        'application/json': { schema: z.object({ data: esquemaSalonConDistribuciones }) },
      },
    },
    400: { description: 'Precios inválidos' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
    404: { description: 'No existe el salón indicado' },
  },
});

const esquemaParamsDistribucion = z.object({
  id: z.coerce.number().int().positive(),
  distribucionId: z.coerce.number().int().positive(),
});

registroOpenApi.registerPath({
  method: 'patch',
  path: '/salones/{id}/distribuciones/{distribucionId}',
  tags: ['Salones'],
  summary: 'Modifica el nombre y la capacidad de una distribución (HU-26 del Sprint 4)',
  request: {
    params: esquemaParamsDistribucion,
    body: { content: { 'application/json': { schema: esquemaModificarDistribucion } } },
  },
  responses: {
    200: {
      description: 'Distribución modificada; el cambio se ve en los eventos que ya la usan',
      content: { 'application/json': { schema: z.object({ data: esquemaDistribucion }) } },
    },
    400: { description: 'Nombre o capacidad inválidos' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
    404: { description: 'No existe el salón o la distribución no es de ese salón' },
    409: {
      description: 'Otra distribución del salón ya tiene ese nombre (sin distinguir mayúsculas)',
    },
    422: { description: 'La capacidad supera la capacidad máxima del salón' },
  },
});

registroOpenApi.registerPath({
  method: 'patch',
  path: '/salones/{id}/distribuciones/{distribucionId}/estado',
  tags: ['Salones'],
  summary:
    'Da de baja (activo: false) o reactiva (activo: true) una distribución (HU-25 del Sprint 4). Dada de baja no se ofrece al presupuestar ni al agendar; los eventos que ya la tienen no cambian',
  request: {
    params: esquemaParamsDistribucion,
    body: { content: { 'application/json': { schema: esquemaCambiarEstadoDistribucion } } },
  },
  responses: {
    200: {
      description: 'Distribución con su estado nuevo',
      content: { 'application/json': { schema: z.object({ data: esquemaDistribucion }) } },
    },
    400: { description: 'Falta activo o no es booleano' },
    401: { description: 'Sin sesión activa' },
    403: { description: 'La sesión no es del personal' },
    404: { description: 'No existe el salón o la distribución no es de ese salón' },
  },
});

export const rutasSalones = Router();

// /publicos va antes de cualquier ruta con parámetro: si en el futuro se agrega un GET /:id,
// Express matchearía "publicos" como id.
rutasSalones.get('/publicos', asincrono(listarPublicos));
// H6 de la auditoría de seguridad: revisado y confirmado como intencional. Este listado con
// precios lo necesita el cotizador del cliente (C5 de HU-48), así que exige sesión pero no rol;
// el canal sin sesión tiene /publicos, que no expone precios ni el flag activo.
rutasSalones.get('/', autenticar, asincrono(listar));

// autenticar antes que autorizar (autorizar confía en req.usuario) y validar al final, para que
// un request sin sesión responda 401 y no filtre si el body estaba bien formado.
// HU-56: el GG y el ADM cambian la foto; qué salones se publican (visibleEnLanding) lo decide solo el
// ADM. Va después de validar() para mirar un body ya parseado.
const soloElAdmPublica: RequestHandler = (req, _res, next) => {
  const publica = (req.body as ActualizarLandingSalon).visibleEnLanding !== undefined;
  if (publica && !puedePublicarEnLanding(req.usuario!.rol)) {
    next(ErrorApi.noAutorizado('Solo el Administrador del Sistema decide qué salones se publican'));
    return;
  }
  next();
};

rutasSalones.patch(
  '/:id/landing',
  autenticar,
  autorizar(...ROLES_QUE_CAMBIAN_FOTOS),
  validar({ params: esquemaParamsId, body: esquemaActualizarLandingSalon }),
  soloElAdmPublica,
  asincrono(actualizarLanding),
);

// HU-25: mismo orden de middlewares que el de arriba. Las distribuciones las administran los cuatro
// roles del personal, como el resto de Salones.
rutasSalones.post(
  '/:id/distribuciones',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaParamsId, body: esquemaCrearDistribucion }),
  asincrono(crearDistribucion),
);

// HU-26: mismo orden de middlewares y la misma decisión provisoria sobre los roles del personal.
rutasSalones.patch(
  '/:id',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaParamsId, body: esquemaModificarSalon }),
  asincrono(modificar),
);

// HU-26: edición de una distribución, con el mismo orden de middlewares.
rutasSalones.patch(
  '/:id/distribuciones/:distribucionId',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaParamsDistribucion, body: esquemaModificarDistribucion }),
  asincrono(editarDistribucion),
);

// HU-25: baja lógica o reactivación de una distribución, con el mismo orden de middlewares.
rutasSalones.patch(
  '/:id/distribuciones/:distribucionId/estado',
  autenticar,
  autorizar(...ROLES_PERSONAL),
  validar({ params: esquemaParamsDistribucion, body: esquemaCambiarEstadoDistribucion }),
  asincrono(cambiarEstado),
);
