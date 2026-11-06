import type { Rol } from '@confluens/shared';

// Nombres de los roles como se muestran en el panel (dominio.md, «Roles»). Los usan Mi cuenta y
// Personal.
export const NOMBRES_DE_ROL: Record<Rol, string> = {
  RESPONSABLE_EVENTOS: 'Responsable de Eventos',
  RESPONSABLE_FINANZAS: 'Responsable de Finanzas',
  GERENTE_GENERAL: 'Gerente General',
  ADMINISTRADOR_SISTEMA: 'Administrador del Sistema',
  CLIENTE: 'Cliente',
};
