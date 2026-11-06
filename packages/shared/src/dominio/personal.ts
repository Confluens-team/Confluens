// Reglas de Personal (dominio.md, «Roles» y «Personal»; reunión con el cliente del 05/11/2026). Vive
// en shared porque la aplican los dos lados: la web para ofrecer solo los roles que el usuario de la
// sesión puede asignar y la API para rechazar el resto (403).
import type { Rol, RolPersonal } from '../esquemas/usuario.esquema.js';

// El ADM asigna cualquier rol del personal; el GG asigna GG, RE y RF, pero no ADM. Nadie más
// administra al personal.
const ROLES_QUE_ASIGNA: Record<Rol, readonly RolPersonal[]> = {
  ADMINISTRADOR_SISTEMA: [
    'RESPONSABLE_EVENTOS',
    'RESPONSABLE_FINANZAS',
    'GERENTE_GENERAL',
    'ADMINISTRADOR_SISTEMA',
  ],
  GERENTE_GENERAL: ['RESPONSABLE_EVENTOS', 'RESPONSABLE_FINANZAS', 'GERENTE_GENERAL'],
  RESPONSABLE_EVENTOS: [],
  RESPONSABLE_FINANZAS: [],
  CLIENTE: [],
};

/** Los roles que puede asignar quien tiene el rol `rol`, en el orden en que se ofrecen. */
export function rolesQueAsigna(rol: Rol): readonly RolPersonal[] {
  return ROLES_QUE_ASIGNA[rol];
}

/** Si quien tiene el rol `quien` puede darle el rol `rol` a un usuario del personal. */
export function puedeAsignarRol(quien: Rol, rol: RolPersonal): boolean {
  return ROLES_QUE_ASIGNA[quien].includes(rol);
}

/** Si el rol administra al personal desde la sección Personal: solo el GG y el ADM. */
export function administraPersonal(rol: Rol): boolean {
  return ROLES_QUE_ASIGNA[rol].length > 0;
}
