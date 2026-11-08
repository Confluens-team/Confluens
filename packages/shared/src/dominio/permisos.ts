// Permisos por rol de Configuración de negocio (HU-56 del backlog; dominio.md, «Roles»; reunión con
// el cliente del 05/11/2026). Vive en shared porque lo aplican los dos lados: la API rechaza con 403
// lo que el rol no puede hacer y la web ofrece solo lo que sí. Fuera de Configuración de negocio los
// cuatro roles del personal ven todo el panel, así que no hay nada que decidir acá.
import type { Rol } from '../esquemas/usuario.esquema.js';
import { administraPersonal, veAuditoria } from './personal.js';

export type SeccionConfiguracion =
  'salones' | 'servicios' | 'medios' | 'landing' | 'personal' | 'auditoria';

const ROLES_DEL_PERSONAL = [
  'RESPONSABLE_EVENTOS',
  'RESPONSABLE_FINANZAS',
  'GERENTE_GENERAL',
  'ADMINISTRADOR_SISTEMA',
] as const satisfies readonly Rol[];

/** Medios de pago: los administra el RF y los ven el GG y el ADM. El RE no (lo hace el RF). */
export const ROLES_QUE_ADMINISTRAN_MEDIOS_DE_PAGO = [
  'RESPONSABLE_FINANZAS',
  'GERENTE_GENERAL',
  'ADMINISTRADOR_SISTEMA',
] as const satisfies readonly Rol[];

/** Las fotos de la landing las cambian el GG y el ADM. */
export const ROLES_QUE_CAMBIAN_FOTOS = [
  'GERENTE_GENERAL',
  'ADMINISTRADOR_SISTEMA',
] as const satisfies readonly Rol[];

/** Qué salones se publican en la landing lo decide solo el ADM; el GG cambia las fotos, no esto. */
export const ROLES_QUE_PUBLICAN_EN_LANDING = [
  'ADMINISTRADOR_SISTEMA',
] as const satisfies readonly Rol[];

const incluye = (roles: readonly Rol[], rol: Rol) => roles.includes(rol);

/** Si el rol ve la sección de Configuración de negocio. El Cliente no ve ninguna. */
export function veSeccion(rol: Rol, seccion: SeccionConfiguracion): boolean {
  switch (seccion) {
    case 'salones':
    case 'servicios':
      return incluye(ROLES_DEL_PERSONAL, rol);
    case 'medios':
      return incluye(ROLES_QUE_ADMINISTRAN_MEDIOS_DE_PAGO, rol);
    case 'landing':
      return incluye(ROLES_QUE_CAMBIAN_FOTOS, rol);
    case 'personal':
      return administraPersonal(rol);
    case 'auditoria':
      return veAuditoria(rol);
  }
}

/** Si el rol cambia las fotos de la landing (salones y servicios). */
export function puedeCambiarFotos(rol: Rol): boolean {
  return incluye(ROLES_QUE_CAMBIAN_FOTOS, rol);
}

/** Si el rol decide qué salones se publican en la landing. */
export function puedePublicarEnLanding(rol: Rol): boolean {
  return incluye(ROLES_QUE_PUBLICAN_EN_LANDING, rol);
}
