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
  // Baja lógica (HU-31 del backlog): inactivo no inicia sesión. Se puede reactivar.
  activo: z.boolean(),
  creadoEn: esquemaFechaHora,
  actualizadoEn: esquemaFechaHora,
});
export type Usuario = z.infer<typeof esquemaUsuario>;

// Estado de conexión del personal, para la luz de Personal (ver dominio/conexion-del-personal.ts).
export const esquemaEstadoDeConexion = z.enum(['EnLinea', 'Ausente', 'SinSesion']);

// Un usuario del listado de Personal (GET /usuarios): además trae su última actividad y el estado de
// conexión que la API calcula con su reloj, para que la pantalla no dependa del reloj del navegador.
export const esquemaUsuarioDelListado = esquemaUsuario.extend({
  ultimaActividad: esquemaFechaHora.nullable(),
  conexion: esquemaEstadoDeConexion,
});
export type UsuarioDelListado = z.infer<typeof esquemaUsuarioDelListado>;

// Los roles del personal: los que se asignan desde Personal (HU-30 del Sprint 4). CLIENTE queda
// afuera: el cliente se registra solo en la landing (dominio.md, «Roles»).
export const esquemaRolPersonal = z.enum(
  ['RESPONSABLE_EVENTOS', 'RESPONSABLE_FINANZAS', 'GERENTE_GENERAL', 'ADMINISTRADOR_SISTEMA'],
  { error: 'Elegí el rol del usuario' },
);
export type RolPersonal = z.infer<typeof esquemaRolPersonal>;

// Query de GET /usuarios (HU-31 del Sprint 4): el filtro por rol es opcional.
export const esquemaFiltrosUsuarios = z.object({ rol: esquemaRolPersonal.optional() });
export type FiltrosUsuarios = z.infer<typeof esquemaFiltrosUsuarios>;

// Body de PATCH /usuarios/:id/estado (HU-31 del backlog): `false` lo da de baja y `true` lo
// reactiva.
export const esquemaCambiarEstadoUsuario = z.object({
  activo: z.boolean('Indicá si el usuario queda activo o dado de baja'),
});
export type CambiarEstadoUsuario = z.infer<typeof esquemaCambiarEstadoUsuario>;
