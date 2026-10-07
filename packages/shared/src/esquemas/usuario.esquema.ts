import { z } from 'zod';

import { esquemaFechaHora, esquemaId } from './comunes.esquema.js';

// Valores literales de docs/tecnico/modelo-datos.md. CLIENTE se activa en el Sprint 2.
export const esquemaRol = z.enum([
  'RESPONSABLE_EVENTOS',
  'RESPONSABLE_FINANZAS',
  'GERENTE_GENERAL',
  'ADMINISTRADOR_SISTEMA',
  'CLIENTE',
]);
export type Rol = z.infer<typeof esquemaRol>;

// Nunca incluye el hash de la contraseña.
export const esquemaUsuario = z.object({
  id: esquemaId,
  email: z.email(),
  rol: esquemaRol,
  creadoEn: esquemaFechaHora,
  actualizadoEn: esquemaFechaHora,
});
export type Usuario = z.infer<typeof esquemaUsuario>;
