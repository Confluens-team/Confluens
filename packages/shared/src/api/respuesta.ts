// Contrato estándar de respuesta de la API. Ver "Formato de respuesta de la API" en AGENTS.md.

export const CODIGOS_ERROR = {
  VALIDACION: 'VALIDATION_ERROR',
  NO_AUTENTICADO: 'UNAUTHENTICATED',
  NO_AUTORIZADO: 'FORBIDDEN',
  NO_ENCONTRADO: 'NOT_FOUND',
  CONFLICTO: 'CONFLICT',
  REGLA_NEGOCIO: 'BUSINESS_RULE_VIOLATION',
  LIMITE_PETICIONES: 'RATE_LIMITED',
  INTERNO: 'INTERNAL_ERROR',
} as const;

export type CodigoError = (typeof CODIGOS_ERROR)[keyof typeof CODIGOS_ERROR];

export interface MetaPaginacion {
  page: number;
  pageSize: number;
  total: number;
}

export interface RespuestaExito<T> {
  data: T;
  meta?: MetaPaginacion;
}

export interface DetalleError {
  campo?: string;
  mensaje: string;
}

export interface RespuestaError {
  error: {
    code: CodigoError;
    message: string;
    details?: DetalleError[];
  };
}
