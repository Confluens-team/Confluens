import { z } from 'zod';

import { esquemaFechaHora, esquemaId } from './comunes.esquema.js';

export const esquemaCliente = z.object({
  id: esquemaId,
  nombre: z.string().min(1), // razón social o nombre
  telefono: z.string().min(1),
  correo: z.email(),
  activo: z.boolean(),
  usuarioId: esquemaId.nullable(),
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
