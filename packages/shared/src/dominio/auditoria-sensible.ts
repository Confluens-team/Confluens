import type { Rol } from '../esquemas/usuario.esquema.js';

// HU-25 del backlog, auditoría para Gerencia (Franco, 15/11/2026): qué cambios son «sensibles»,
// cuáles piden que el Gerente General los revise y cómo se clasifica cada cambio (alta,
// modificación o baja). La usan la API (para filtrar y contar en la base) y la web (para mostrar).

/**
 * Lo que vuelve sensible a un cambio, por entidad: tocar plata o permisos. `'todos'` es cualquier
 * cambio de esa entidad; una lista son los campos que lo vuelven sensible.
 */
export const REGLAS_SENSIBLES = {
  // Alta o anulación de un cobro.
  Pago: 'todos',
  // El incremento mensual de los precios.
  ConfiguracionPrecios: 'todos',
  Servicio: ['precio'],
  Salon: ['precioJornadaCompleta', 'precioMediaJornada'],
  Presupuesto: ['total'],
  Usuario: ['rol', 'activo', 'contrasena'],
  MedioPago: ['activo'],
} as const satisfies Record<string, 'todos' | readonly string[]>;

export type EntidadConReglaSensible = keyof typeof REGLAS_SENSIBLES;

/** Si un cambio auditado es sensible, por su entidad y los campos que cambió. */
export function esCambioSensible(cambio: { entidad: string; campos: readonly string[] }): boolean {
  const regla = (REGLAS_SENSIBLES as Record<string, 'todos' | readonly string[]>)[cambio.entidad];
  if (!regla) return false;
  if (regla === 'todos') return true;
  return cambio.campos.some((campo) => regla.includes(campo));
}

/**
 * Si un cambio sensible espera la revisión del Gerente General. No la esperan los que hizo el
 * propio GG ni los del Sistema (usuario null, procesos automáticos): se ven igual como sensibles.
 */
export function requiereRevision(cambio: {
  sensible: boolean;
  usuario: { rol: Rol } | null;
}): boolean {
  return cambio.sensible && cambio.usuario !== null && cambio.usuario.rol !== 'GERENTE_GENERAL';
}

/** Solo el Gerente General marca un cambio como revisado. */
export const ROL_QUE_REVISA_AUDITORIA: Rol = 'GERENTE_GENERAL';

export const TIPOS_DE_ACCION = ['alta', 'modificacion', 'baja'] as const;
export type TipoDeAccion = (typeof TIPOS_DE_ACCION)[number];

/**
 * La acción de un cambio auditado. No hay borrados físicos auditados: una baja es una anulación
 * (`anuladoEn`), un estado que pasa a Cancelado o un `activo` que pasa a false.
 */
export function tipoDeAccion(cambio: {
  campos: readonly string[];
  valorAnterior: unknown;
  valorNuevo: unknown;
}): TipoDeAccion {
  if (cambio.valorAnterior === null || cambio.valorAnterior === undefined) return 'alta';
  const nuevo = (cambio.valorNuevo ?? {}) as Record<string, unknown>;
  if (
    cambio.campos.includes('anuladoEn') ||
    nuevo['estado'] === 'Cancelado' ||
    nuevo['activo'] === false
  ) {
    return 'baja';
  }
  return 'modificacion';
}
