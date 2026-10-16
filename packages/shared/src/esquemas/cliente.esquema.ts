import { z } from 'zod';

import { esquemaFechaHora, esquemaId, vacioComoAusente } from './comunes.esquema.js';
import { esquemaEtiqueta } from './etiqueta.esquema.js';

// Ficha del cliente tal como la ve el personal. Nunca se devuelve al rol Cliente: lleva la etiqueta,
// que es solo interna (el perfil del canal público usa su propio schema, sesion.esquema.ts).
export const esquemaCliente = z.object({
  id: esquemaId,
  nombre: z.string().min(1), // nombre de la persona, o razón social
  apellido: z.string().nullable(), // null para razones sociales y fichas previas al registro
  telefono: z.string().min(1),
  correo: z.email(),
  activo: z.boolean(),
  usuarioId: esquemaId.nullable(),
  etiqueta: esquemaEtiqueta.nullable(),
  creadoEn: esquemaFechaHora,
  actualizadoEn: esquemaFechaHora,
});
export type Cliente = z.infer<typeof esquemaCliente>;

// Listado de clientes del panel del Administrador del Sistema: la ficha más cuántos eventos y
// solicitudes tiene, para ver su historial de un vistazo sin pedirlos uno por uno.
export const esquemaClienteConResumen = esquemaCliente.extend({
  cantidadEventos: z.number().int().nonnegative(),
  cantidadSolicitudes: z.number().int().nonnegative(),
});
export type ClienteConResumen = z.infer<typeof esquemaClienteConResumen>;

// Filtro de GET /clientes (HU-16). Cada palabra de `busqueda` tiene que aparecer en el nombre, el
// apellido, el correo, el teléfono o la etiqueta, sin distinguir mayúsculas. Vacío cuenta como
// ausente, como en los demás listados.
export const esquemaFiltrosClientes = z.object({
  busqueda: z.preprocess(vacioComoAusente, z.string().trim().max(100).optional()),
});
export type FiltrosClientes = z.infer<typeof esquemaFiltrosClientes>;
