import { z } from 'zod';

import { esquemaFecha, esquemaFechaHora, esquemaId, esquemaImporte } from './comunes.esquema.js';
import { esquemaEstadoEvento } from './evento.esquema.js';
import { esquemaLineaPresupuesto } from './linea-presupuesto.esquema.js';
import { esquemaEstadoPresupuesto } from './presupuesto.esquema.js';
import {
  esquemaHoraEstimada,
  esquemaTipoEvento,
  esquemaTipoEventoSocial,
  esquemaTipoJornada,
  esquemaTipoSocialDetalle,
  exigirDetalleDeOtro,
} from './tipo-evento.esquema.js';

// Tipo de cada línea: el salón (siempre la primera), un servicio del catálogo o un adicional que el
// personal escribió a mano. El salón y los adicionales no tienen servicioId.
export const esquemaTipoLinea = z.enum(['salon', 'servicio', 'adicional']);
export type TipoLinea = z.infer<typeof esquemaTipoLinea>;

// Respuesta de GET /presupuestos/:id: lo que necesita la pantalla de una consulta para mostrarla y
// editarla (HU-12). Importes sin IVA (RN-05). `tipoJornada` es la que eligió el cliente o, en los
// eventos anteriores a ADR 0008, la de la línea del salón. Una consulta social puede no tener salón
// y, hasta que el personal arma su presupuesto, tampoco vencimiento (`venceEn` null).
export const esquemaConsultaDetallada = z.object({
  id: esquemaId,
  estado: esquemaEstadoPresupuesto,
  fechaEmision: esquemaFechaHora,
  venceEn: esquemaFechaHora.nullable(),
  total: esquemaImporte,
  requiereFactura: z.boolean(),
  tipoJornada: esquemaTipoJornada,
  evento: z.object({
    id: esquemaId,
    estado: esquemaEstadoEvento,
    fecha: esquemaFecha,
    cantidadPersonas: z.number().int().positive(),
    tipo: esquemaTipoEvento,
    tipoSocial: esquemaTipoEventoSocial.nullable(),
    tipoSocialDetalle: z.string().nullable(),
    horaInicioEstimada: esquemaHoraEstimada.nullable(),
    // Notas de la comanda de cocina: la pantalla de la comanda las muestra y las edita.
    observacionesComanda: z.string().nullable(),
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
  salon: z
    .object({ id: esquemaId, nombre: z.string(), capacidadMaxima: z.number().int() })
    .nullable(),
  lineas: z.array(
    esquemaLineaPresupuesto.extend({ tipo: esquemaTipoLinea, tercerizado: z.boolean() }),
  ),
});
export type ConsultaDetallada = z.infer<typeof esquemaConsultaDetallada>;

// Un servicio del presupuesto modificado. Sin `precioUnitario` conserva el precio congelado si ya
// estaba en el presupuesto, o toma el vigente si es nuevo; con él es un ajuste comercial (RN-03).
// Un tercerizado a cotizar sin `precioUnitario` sigue a cotizar; con él, queda con ese precio.
// Como el PATCH manda el estado completo de la consulta, `horaEstimada` ausente borra la hora que
// tuviera la línea.
export const esquemaServicioModificado = z.object({
  servicioId: esquemaId,
  cantidad: z.number().int().positive(),
  precioUnitario: esquemaImporte.optional(),
  horaEstimada: esquemaHoraEstimada.optional(),
});
export type ServicioModificado = z.infer<typeof esquemaServicioModificado>;

// Un adicional que no está en el catálogo: el personal escribe qué es y cuánto cuesta (sin IVA).
export const esquemaAdicional = z.object({
  descripcion: z.string().trim().min(1).max(120),
  cantidad: z.number().int().positive(),
  precioUnitario: esquemaImporte,
  horaEstimada: esquemaHoraEstimada.optional(),
});
export type Adicional = z.infer<typeof esquemaAdicional>;

// Body de PATCH /presupuestos/:id (HU-12): el estado completo de la consulta, no un parche parcial.
// `precioSalon` ajusta a mano el precio de la línea del salón. `salonId` null solo vale para una
// consulta social (ADR 0008). Sin `tipo` (ni los demás campos del tipo) se mantiene lo que estaba.
export const esquemaModificarPresupuesto = z
  .object({
    fecha: esquemaFecha,
    salonId: esquemaId.nullable(),
    cantidadPersonas: z.number().int().positive(),
    tipoJornada: esquemaTipoJornada,
    tipo: esquemaTipoEvento.optional(),
    tipoSocial: esquemaTipoEventoSocial.nullable().optional(),
    tipoSocialDetalle: esquemaTipoSocialDetalle.nullable().optional(),
    horaInicioEstimada: esquemaHoraEstimada.nullable().optional(),
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
  })
  .superRefine((datos, ctx) => {
    if (datos.tipo === 'Corporativo' && datos.salonId === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['salonId'],
        message: 'Un evento corporativo necesita salón',
      });
    }
    if (datos.tipo === 'Social' && !datos.tipoSocial) {
      ctx.addIssue({
        code: 'custom',
        path: ['tipoSocial'],
        message: 'Elegí qué tipo de evento social es',
      });
    }
    exigirDetalleDeOtro(datos, ctx);
  });
export type ModificarPresupuesto = z.infer<typeof esquemaModificarPresupuesto>;
