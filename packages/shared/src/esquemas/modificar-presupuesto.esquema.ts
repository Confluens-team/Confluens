import { z } from 'zod';

import { esquemaFecha, esquemaFechaHora, esquemaId, esquemaImporte } from './comunes.esquema.js';
import { esquemaTipoJornada } from './crear-presupuesto.esquema.js';
import { esquemaEstadoEvento } from './evento.esquema.js';
import { esquemaLineaPresupuesto } from './linea-presupuesto.esquema.js';
import { esquemaEstadoPresupuesto } from './presupuesto.esquema.js';

// Tipo de cada línea: el salón (siempre la primera), un servicio del catálogo o un adicional que el
// personal escribió a mano. El salón y los adicionales no tienen servicioId.
export const esquemaTipoLinea = z.enum(['salon', 'servicio', 'adicional']);
export type TipoLinea = z.infer<typeof esquemaTipoLinea>;

// Respuesta de GET /presupuestos/:id: lo que necesita la pantalla de una consulta para mostrarla y
// editarla (HU-12). Importes sin IVA (RN-05). `tipoJornada` sale de la línea del salón.
export const esquemaConsultaDetallada = z.object({
  id: esquemaId,
  estado: esquemaEstadoPresupuesto,
  fechaEmision: esquemaFechaHora,
  venceEn: esquemaFechaHora,
  total: esquemaImporte,
  requiereFactura: z.boolean(),
  tipoJornada: esquemaTipoJornada,
  evento: z.object({
    id: esquemaId,
    estado: esquemaEstadoEvento,
    fecha: esquemaFecha,
    cantidadPersonas: z.number().int().positive(),
    // HU-11: se completan al agendar el evento; hasta entonces son null.
    distribucion: z.object({ id: esquemaId, nombre: z.string() }).nullable(),
    inicio: esquemaFechaHora.nullable(),
    fin: esquemaFechaHora.nullable(),
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
  lineas: z.array(
    esquemaLineaPresupuesto.extend({ tipo: esquemaTipoLinea, tercerizado: z.boolean() }),
  ),
  // HU-11: todos los presupuestos del evento, este incluido, para navegar entre ellos.
  presupuestosDelEvento: z.array(
    z.object({
      id: esquemaId,
      estado: esquemaEstadoPresupuesto,
      fechaEmision: esquemaFechaHora,
      total: esquemaImporte,
    }),
  ),
});
export type ConsultaDetallada = z.infer<typeof esquemaConsultaDetallada>;

// Un servicio del presupuesto modificado. Sin `precioUnitario` conserva el precio congelado si ya
// estaba en el presupuesto, o toma el vigente si es nuevo; con él es un ajuste comercial (RN-03).
// Un tercerizado a cotizar sin `precioUnitario` sigue a cotizar; con él, queda con ese precio.
export const esquemaServicioModificado = z.object({
  servicioId: esquemaId,
  cantidad: z.number().int().positive(),
  precioUnitario: esquemaImporte.optional(),
});
export type ServicioModificado = z.infer<typeof esquemaServicioModificado>;

// Un adicional que no está en el catálogo: el personal escribe qué es y cuánto cuesta (sin IVA).
export const esquemaAdicional = z.object({
  descripcion: z.string().trim().min(1).max(120),
  cantidad: z.number().int().positive(),
  precioUnitario: esquemaImporte,
});
export type Adicional = z.infer<typeof esquemaAdicional>;

// Body de PATCH /presupuestos/:id (HU-12): el estado completo de la consulta, no un parche parcial.
// `precioSalon` ajusta a mano el precio de la línea del salón.
export const esquemaModificarPresupuesto = z.object({
  fecha: esquemaFecha,
  salonId: esquemaId,
  cantidadPersonas: z.number().int().positive(),
  tipoJornada: esquemaTipoJornada,
  precioSalon: esquemaImporte.optional(),
  // RN-01: si el cliente pide factura, la base de cobro de la seña y el saldo incluye el IVA. Sin
  // el campo, se mantiene lo que estaba.
  requiereFactura: z.boolean().optional(),
  servicios: z
    .array(esquemaServicioModificado)
    .default([])
    .refine(
      (servicios) => new Set(servicios.map((s) => s.servicioId)).size === servicios.length,
      'Un servicio no puede aparecer dos veces',
    ),
  adicionales: z.array(esquemaAdicional).default([]),
});
export type ModificarPresupuesto = z.infer<typeof esquemaModificarPresupuesto>;
