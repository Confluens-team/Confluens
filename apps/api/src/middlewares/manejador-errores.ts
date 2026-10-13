import { CODIGOS_ERROR, type RespuestaError } from '@confluens/shared';
import { randomUUID } from 'node:crypto';

import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { ErrorApi } from '../lib/errores.js';

export const rutaNoEncontrada: RequestHandler = (req, _res, next) => {
  next(ErrorApi.noEncontrado(`No existe la ruta ${req.method} ${req.path}`));
};

export const manejadorErrores: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  let status = 500;
  let cuerpo: RespuestaError = {
    error: { code: CODIGOS_ERROR.INTERNO, message: 'Error interno del servidor' },
  };

  if (error instanceof ErrorApi) {
    status = error.status;
    cuerpo = { error: { code: error.codigo, message: error.message, details: error.detalles } };
  } else if (error instanceof ZodError) {
    status = 400;
    cuerpo = {
      error: {
        code: CODIGOS_ERROR.VALIDACION,
        message: 'Los datos enviados no son válidos',
        details: error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      },
    };
  } else if (esJsonInvalido(error)) {
    status = 400;
    cuerpo = {
      error: {
        code: CODIGOS_ERROR.VALIDACION,
        message: 'El cuerpo de la solicitud no es JSON válido',
      },
    };
  } else {
    // H8 de la auditoría de seguridad (OWASP A09): antes el 500 se registraba con un
    // console.error pelado, imposible de cruzar con el reporte de quien lo sufrió. Ahora cada
    // error no previsto lleva un id de correlación que va al log y al usuario: con ese id se
    // encuentra la traza exacta, y el mensaje sigue sin exponer nada interno (§4 de AGENTS.md).
    const idError = randomUUID();
    console.error(
      JSON.stringify({
        nivel: 'error',
        idError,
        metodo: req.method,
        ruta: req.originalUrl,
        usuarioId: req.usuario?.id ?? null,
        momento: new Date().toISOString(),
        mensaje: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );
    cuerpo = {
      error: {
        code: CODIGOS_ERROR.INTERNO,
        message: `Error interno del servidor. Si el problema sigue, pasale este código a soporte: ${idError}`,
      },
    };
  }

  res.status(status).json(cuerpo);
};

function esJsonInvalido(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  );
}
