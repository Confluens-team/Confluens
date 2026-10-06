import { z } from 'zod';

import { esquemaFecha, esquemaFechaHora, esquemaId, esquemaImporte } from './comunes.esquema.js';
import { esquemaEstadoEvento } from './evento.esquema.js';

// Catálogo de medios de pago (Efectivo, Tarjeta, A la habitación). Baja lógica con `activo`: un
// medio dado de baja no se borra, para no romper los pagos históricos que lo referencian.
// El ABM es del Sprint 3 (HU-36 a HU-39); acá solo se leen los activos para poblar el formulario.
export const esquemaMedioPago = z.object({
  id: esquemaId,
  nombre: z.string(),
  activo: z.boolean(),
});
export type MedioPago = z.infer<typeof esquemaMedioPago>;

// OJO: a diferencia del resto de los importes del sistema, `monto` NO es un importe sin IVA
// (RN-05). Es la plata que el cliente entregó, y se mide contra la base de cobro de RN-01, que
// incluye el IVA cuando el presupuesto tiene requiereFactura.
export const esquemaPago = z.object({
  id: esquemaId,
  eventoId: esquemaId,
  fecha: esquemaFecha,
  monto: esquemaImporte,
  medioPagoId: esquemaId,
  medioPago: esquemaMedioPago,
  observacion: z.string().nullable(),
  creadoEn: esquemaFechaHora,
});
export type Pago = z.infer<typeof esquemaPago>;

// Contrato de POST /eventos/:id/pagos (HU-14). El monto viaja como string para no perder precisión
// (Decimal(12,2) de Prisma); esquemaImporte ya acepta "0", así que hace falta exigir que sea > 0.
export const esquemaCrearPago = z.object({
  fecha: esquemaFecha,
  monto: esquemaImporte.refine((valor) => Number(valor) > 0, 'El monto debe ser mayor a cero'),
  medioPagoId: esquemaId,
  observacion: z.string().trim().min(1).max(500).optional(),
});
export type CrearPago = z.infer<typeof esquemaCrearPago>;

/**
 * Estado de cuenta del evento (HU-14 C2). Ninguno de estos valores se guarda: se calculan en cada
 * consulta a partir del presupuesto vigente y de la suma de los pagos (sprint-02.md:130).
 *
 * `baseDeCobro` es el total del presupuesto CON IVA si tiene requiereFactura, y el total tal cual
 * (sin IVA, RN-05) si no lo tiene. Es la resolución de S-08 para RN-01: el 20% de la seña se
 * calcula sobre esta base, no sobre el total del presupuesto.
 */
export const esquemaSaldoEvento = z.object({
  baseDeCobro: esquemaImporte,
  incluyeIva: z.boolean(),
  pagado: esquemaImporte,
  saldo: esquemaImporte,
  porcentajeAbonado: z.number(),
});
export type SaldoEvento = z.infer<typeof esquemaSaldoEvento>;

// HU-13 C6: los eventos EnConsulta que pisan la franja que este evento acaba de tomar. NO se
// cancelan ni se tocan (dominio.md:30, Cancelado es siempre manual): se informan para que el
// Responsable de Eventos los gestione.
export const esquemaConsultaEnConflicto = z.object({
  id: esquemaId,
  inicio: esquemaFechaHora.nullable(),
  fin: esquemaFechaHora.nullable(),
  cliente: z.object({ id: esquemaId, nombre: z.string(), apellido: z.string().nullable() }),
});
export type ConsultaEnConflicto = z.infer<typeof esquemaConsultaEnConflicto>;

// Respuesta de POST /eventos/:id/pagos. `reservoElSalon` avisa que este pago fue el que cruzó el
// 20% y disparó la confirmación del presupuesto (HU-13), para que la UI muestre el aviso.
export const esquemaResultadoPago = z.object({
  pago: esquemaPago,
  saldo: esquemaSaldoEvento,
  estadoEvento: esquemaEstadoEvento,
  reservoElSalon: z.boolean(),
  consultasEnConflicto: z.array(esquemaConsultaEnConflicto),
});
export type ResultadoPago = z.infer<typeof esquemaResultadoPago>;

// Respuesta de GET /eventos/:id/pagos: el historial más el saldo actualizado (HU-14 C2).
export const esquemaCuentaEvento = z.object({
  pagos: z.array(esquemaPago),
  saldo: esquemaSaldoEvento,
});
export type CuentaEvento = z.infer<typeof esquemaCuentaEvento>;
