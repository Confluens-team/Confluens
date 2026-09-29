import { z } from 'zod';

import { esquemaFecha, esquemaFechaHora, esquemaId, esquemaImporte } from './comunes.esquema.js';

// Valores literales de la máquina de estados aprobada (docs/producto/dominio.md).
export const esquemaEstadoEvento = z.enum(['EnConsulta', 'Reservado', 'Cobrado', 'Cancelado']);
export type EstadoEvento = z.infer<typeof esquemaEstadoEvento>;

// distribucionId, inicio y fin pueden ser null en EnConsulta (y en Cancelado si viene de ahí).
export const esquemaEvento = z.object({
  id: esquemaId,
  clienteId: esquemaId,
  salonId: esquemaId,
  distribucionId: esquemaId.nullable(),
  fecha: esquemaFecha,
  inicio: esquemaFechaHora.nullable(),
  fin: esquemaFechaHora.nullable(),
  cantidadPersonas: z.number().int().positive(),
  estado: esquemaEstadoEvento,
  senaVenceEn: esquemaFechaHora.nullable(), // plazo de 10 días desde la confirmación (RN-06)
  senaRegistradaEn: esquemaFechaHora.nullable(), // cuándo el RE marcó la seña como cobrada
  modalidadSalonRestaurante: z.boolean(), // opción interna, no visible al cliente
  creadoEn: esquemaFechaHora,
  actualizadoEn: esquemaFechaHora,
});
export type Evento = z.infer<typeof esquemaEvento>;

// Agenda del panel del Administrador del Sistema: los eventos que ocupan un salón (Reservado y
// Cobrado), con lo mínimo de cliente, salón y distribución para listarlos sin pedir el detalle de
// cada uno. totalPresupuesto es el total sin IVA (RN-05) del presupuesto Confirmado, si lo hay.
export const esquemaEventoAgenda = esquemaEvento.extend({
  cliente: z.object({
    id: esquemaId,
    nombre: z.string(),
    telefono: z.string(),
    correo: z.string(),
  }),
  salon: z.object({ id: esquemaId, nombre: z.string() }),
  distribucion: z.object({ id: esquemaId, nombre: z.string() }).nullable(),
  totalPresupuesto: esquemaImporte.nullable(),
});
export type EventoAgenda = z.infer<typeof esquemaEventoAgenda>;
