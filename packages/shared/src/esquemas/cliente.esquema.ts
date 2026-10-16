import { z } from 'zod';

import { esquemaFechaHora, esquemaId, vacioComoAusente } from './comunes.esquema.js';
import { esquemaEtiqueta } from './etiqueta.esquema.js';
import { esquemaCelular } from './telefono.esquema.js';

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

// Body de PATCH /clientes/:id (HU-17): el personal corrige los datos de contacto de un cliente.
// Nombre y teléfono van siempre. El apellido es opcional porque una razón social no tiene. El correo
// es opcional: si falta, no se toca; si viene, tiene que ser válido. Solo se puede cambiar en un
// cliente sin cuenta (en uno con cuenta es su usuario para iniciar sesión), regla que aplica el
// servicio. Sin la restricción de solo letras del registro: `nombre` también guarda razones
// sociales (puntos, «&», números).
export const esquemaModificarCliente = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, { error: 'Ingresá el nombre' })
    .max(100, { error: 'Usá hasta 100 caracteres' }),
  apellido: z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? null : valor),
    z.string().trim().max(100, { error: 'Usá hasta 100 caracteres' }).nullable().optional(),
  ),
  telefono: esquemaCelular,
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Ingresá un correo válido (por ejemplo: nombre@empresa.com)' }))
    .optional(),
});
export type ModificarCliente = z.infer<typeof esquemaModificarCliente>;
