import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

import { ErrorApi } from '../lib/errores.js';

// H2 de la auditoría de seguridad (OWASP A04): sin límite de peticiones, /auth/login y
// /auth/contrasena/olvido habilitan fuerza bruta de credenciales, y los endpoints de escritura,
// spam automatizado. El límite es por IP y por ventana.
//
// En producción la API corre detrás del proxy de Render, así que app.ts setea trust proxy: sin
// eso, express-rate-limit ve la IP del proxy en todos los requests y limitaría a todo el mundo
// junto. Los tests de Supertest entran como ::ffff:127.0.0.1 y nunca llegan al tope.
const MINUTO = 60 * 1000;

// El 429 sale por el manejador de errores como cualquier otro error de la API (§4 de AGENTS.md),
// con un code estable que la web puede distinguir. No se usa el body por defecto de la librería,
// que es texto plano y rompe el contrato { error: { code, message } }.
function excedido(mensaje: string) {
  return (): never => {
    throw ErrorApi.demasiadasPeticiones(mensaje);
  };
}

/**
 * Crea un limitador por IP. Exportada para poder probar el 429 y su formato de error con una
 * ventana chica, sin que el test dependa de los topes reales de cada ruta.
 *
 * Los tests de ruta (Supertest) entran todos como la misma IP y disparan decenas de requests
 * seguidos contra el mismo endpoint, así que en NODE_ENV=test el limitador se saltea: si no, el
 * tope de una ruta convertiría en 429 los tests de la de al lado, y el orden de ejecución
 * cambiaría el resultado. Vitest setea NODE_ENV=test por su cuenta.
 */
export function crearLimitador(
  maximo: number,
  ventanaMs: number,
  mensaje: string,
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: ventanaMs,
    limit: maximo,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: excedido(mensaje),
    skip: () => process.env['NODE_ENV'] === 'test',
  });
}

/**
 * Login y recupero de contraseña: el más estricto. 10 intentos cada 15 minutos alcanzan de sobra
 * para alguien que se equivoca al tipear y cortan cualquier barrido automatizado de contraseñas.
 */
export const limitadorCredenciales: RateLimitRequestHandler = crearLimitador(
  10,
  15 * MINUTO,
  'Demasiados intentos. Esperá unos minutos y volvé a probar.',
);

/**
 * Registro de clientes: evita el alta masiva de cuentas desde una misma IP.
 */
export const limitadorRegistro: RateLimitRequestHandler = crearLimitador(
  5,
  60 * MINUTO,
  'Se alcanzó el límite de registros por ahora. Probá más tarde.',
);

/**
 * Escrituras del canal público (el cotizador de HU-09 y la consulta social del ADR 0008): son las
 * que crean Cliente, Evento y Presupuesto en la base, así que son las que más conviene acotar
 * aunque ya pidan sesión.
 */
export const limitadorEscrituras: RateLimitRequestHandler = crearLimitador(
  30,
  15 * MINUTO,
  'Demasiadas solicitudes seguidas. Esperá unos minutos y volvé a probar.',
);
