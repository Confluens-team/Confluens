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
  // Columna del Sprint 1 que quedó sin escribirse: la vigencia de los 10 días es del presupuesto,
  // no del evento (RN-06, RN-08), y un evento puede tener varios presupuestos (dominio.md:55).
  senaVenceEn: esquemaFechaHora.nullable(),
  // Instante en que el acumulado de pagos cruzó el 20% de la base de cobro y el salón quedó
  // reservado (HU-13). Lo escribe el módulo de pagos, no una acción manual.
  senaRegistradaEn: esquemaFechaHora.nullable(),
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
    apellido: z.string().nullable(),
    telefono: z.string(),
    correo: z.string(),
  }),
  salon: z.object({ id: esquemaId, nombre: z.string() }),
  distribucion: z.object({ id: esquemaId, nombre: z.string() }).nullable(),
  totalPresupuesto: esquemaImporte.nullable(),
});
export type EventoAgenda = z.infer<typeof esquemaEventoAgenda>;
