import { CODIGOS_ERROR, type CodigoError, type DetalleError } from '@confluens/shared';

/**
 * Error esperado de la API. Lanzarlo desde servicios o controladores:
 * el middleware manejadorErrores lo convierte en una RespuestaError.
 */
export class ErrorApi extends Error {
  readonly status: number;
  readonly codigo: CodigoError;
  readonly detalles?: DetalleError[];

  constructor(status: number, codigo: CodigoError, mensaje: string, detalles?: DetalleError[]) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }

  static noEncontrado(mensaje = 'Recurso no encontrado'): ErrorApi {
    return new ErrorApi(404, CODIGOS_ERROR.NO_ENCONTRADO, mensaje);
  }

  static conflicto(mensaje: string): ErrorApi {
    return new ErrorApi(409, CODIGOS_ERROR.CONFLICTO, mensaje);
  }

  static reglaNegocio(mensaje: string, detalles?: DetalleError[]): ErrorApi {
    return new ErrorApi(422, CODIGOS_ERROR.REGLA_NEGOCIO, mensaje, detalles);
  }

  // HU-27, criterio 2: el mensaje por defecto es deliberadamente genérico. Se usa
  // tanto cuando el email no existe como cuando la contraseña no matchea, para no
  // filtrar cuál de los dos datos falló.
  static noAutenticado(mensaje = 'Credenciales inválidas'): ErrorApi {
    return new ErrorApi(401, CODIGOS_ERROR.NO_AUTENTICADO, mensaje);
  }

  static noAutorizado(mensaje = 'No tenés permiso para esta acción'): ErrorApi {
    return new ErrorApi(403, CODIGOS_ERROR.NO_AUTORIZADO, mensaje);
  }

  // H2 de la auditoría de seguridad: lo lanzan los limitadores de peticiones de
  // middlewares/limitadores.ts cuando una IP pasa el tope de su ventana.
  static demasiadasPeticiones(mensaje: string): ErrorApi {
    return new ErrorApi(429, CODIGOS_ERROR.LIMITE_PETICIONES, mensaje);
  }
}
