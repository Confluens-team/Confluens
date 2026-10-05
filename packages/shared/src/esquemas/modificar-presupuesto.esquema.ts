import { z } from 'zod';

import { esquemaFecha, esquemaFechaHora, esquemaId, esquemaImporte } from './comunes.esquema.js';
import { esquemaTipoJornada } from './crear-presupuesto.esquema.js';
import { esquemaEstadoEvento } from './evento.esquema.js';
import { esquemaLineaPresupuesto } from './linea-presupuesto.esquema.js';
import { esquemaEstadoPresupuesto } from './presupuesto.esquema.js';

// Respuesta de GET /presupuestos/:id: lo que necesita la pantalla de una consulta para mostrarla y
// editarla (HU-12). Importes sin IVA (RN-05). La línea del salón es la que tiene servicioId null;
// `tipoJornada` sale de ella.
export const esquemaConsultaDetallada = z.object({
  id: esquemaId,
  estado: esquemaEstadoPresupuesto,
  fechaEmision: esquemaFechaHora,
  venceEn: esquemaFechaHora,
  total: esquemaImporte,
  tipoJornada: esquemaTipoJornada,
  evento: z.object({
    id: esquemaId,
    estado: esquemaEstadoEvento,
    fecha: esquemaFecha,
    cantidadPersonas: z.number().int().positive(),
  }),
  // Solo lectura: los datos de contacto los mantiene el cliente desde su cuenta.
  cliente: z.object({
    id: esquemaId,
    nombre: z.string(),
    apellido: z.string().nullable(),
    correo: z.string(),
    telefono: z.string(),
  }),
  salon: z.object({ id: esquemaId, nombre: z.string(), capacidadMaxima: z.number().int() }),
  lineas: z.array(esquemaLineaPresupuesto.extend({ tercerizado: z.boolean() })),
});
export type ConsultaDetallada = z.infer<typeof esquemaConsultaDetallada>;

// Un servicio del presupuesto modificado. Sin `precioUnitario` conserva el precio congelado si ya
// estaba en el presupuesto, o toma el vigente si es nuevo; con él es un ajuste comercial (RN-03).
export const esquemaServicioModificado = z.object({
  servicioId: esquemaId,
  cantidad: z.number().int().positive(),
  precioUnitario: esquemaImporte.optional(),
});
export type ServicioModificado = z.infer<typeof esquemaServicioModificado>;

// Body de PATCH /presupuestos/:id (HU-12): el estado completo de la consulta, no un parche parcial.
// `precioSalon` ajusta a mano el precio de la línea del salón.
export const esquemaModificarPresupuesto = z.object({
  fecha: esquemaFecha,
  salonId: esquemaId,
  cantidadPersonas: z.number().int().positive(),
  tipoJornada: esquemaTipoJornada,
  precioSalon: esquemaImporte.optional(),
  servicios: z
    .array(esquemaServicioModificado)
    .default([])
    .refine(
      (servicios) => new Set(servicios.map((s) => s.servicioId)).size === servicios.length,
      'Un servicio no puede aparecer dos veces',
    ),
});
export type ModificarPresupuesto = z.infer<typeof esquemaModificarPresupuesto>;
