import { z } from 'zod';

import { esquemaFecha, esquemaFechaHora, esquemaId, esquemaImporte } from './comunes.esquema.js';
import { esquemaEstadoEvento } from './evento.esquema.js';

// Catálogo de medios de pago (RN-14). Baja lógica con `activo`: un medio dado de baja no se borra,
// para no romper los pagos históricos que lo referencian. `conFactura` y `sinFactura` dicen en qué
// cobros se puede usar según el presupuesto requiera factura o no (dominio.md, RN-14).
export const esquemaMedioPago = z.object({
  id: esquemaId,
  nombre: z.string(),
  activo: z.boolean(),
  conFactura: z.boolean(),
  sinFactura: z.boolean(),
});
export type MedioPago = z.infer<typeof esquemaMedioPago>;

// Contrato de POST /medios-pago (HU-19). El nombre es único sin distinguir mayúsculas (lo controla
// el servicio) y hay que habilitarlo para al menos uno de los dos casos. Lo completa el personal en
// el panel, así que los mensajes van en español.
export const esquemaCrearMedioPago = z
  .object({
    nombre: z
      .string('Escribí el nombre del medio de pago')
      .trim()
      .min(1, 'Escribí el nombre del medio de pago')
      .max(40, 'El nombre admite hasta 40 caracteres'),
    conFactura: z.boolean().default(false),
    sinFactura: z.boolean().default(false),
  })
  .refine((medio) => medio.conFactura || medio.sinFactura, {
    path: ['conFactura'],
    message: 'Elegí si se puede usar con factura, sin factura o en los dos casos',
  });
export type CrearMedioPago = z.infer<typeof esquemaCrearMedioPago>;

// Body de PATCH /medios-pago/:id (HU-33 del Sprint 4). Viaja el estado completo, como lo muestra el
// formulario: sin defaults, porque un caso que no llega no es lo mismo que destildarlo. Mismas
// reglas que el alta; la habilitación de los seis medios del catálogo inicial también se puede
// cambiar (equipo, 03/11/2026). Que el nombre no sea de otro medio lo controla la API (409).
export const esquemaModificarMedioPago = z
  .object({
    nombre: z
      .string('Escribí el nombre del medio de pago')
      .trim()
      .min(1, 'Escribí el nombre del medio de pago')
      .max(40, 'El nombre admite hasta 40 caracteres'),
    conFactura: z.boolean(),
    sinFactura: z.boolean(),
  })
  .refine((medio) => medio.conFactura || medio.sinFactura, {
    path: ['conFactura'],
    message: 'Elegí si se puede usar con factura, sin factura o en los dos casos',
  });
export type ModificarMedioPago = z.infer<typeof esquemaModificarMedioPago>;

// Filtro de GET /medios-pago. Sin parámetros devuelve solo los activos, que es lo que usa el
// formulario de cobro; el listado de HU-20 pide también los dados de baja.
export const esquemaFiltrosMediosPago = z.object({
  incluirInactivos: z.stringbool().optional(),
});
export type FiltrosMediosPago = z.infer<typeof esquemaFiltrosMediosPago>;

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
  // HU-35 del Sprint 4: un pago anulado sigue en la cuenta, pero no suma. Se guarda cuándo y quién lo
  // anuló (PO, 06/11/2026); los dos son null mientras el pago está vigente.
  anuladoEn: esquemaFechaHora.nullable(),
  anuladoPor: z.object({ id: esquemaId, email: z.email() }).nullable(),
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
 *
 * `saldo` puede ser negativo: si un presupuesto confirmado baja su total por debajo de lo pagado,
 * la diferencia es un saldo a favor del cliente que se resuelve a mano (decisión del PO,
 * 16/10/2026, HU-21).
 *
 * `montoSena` es el 20% de la base redondeado al centavo hacia arriba: nadie entrega fracciones de
 * centavo, y redondear para abajo daría por cubierta una seña que la API todavía no considera
 * alcanzada. `senaAlcanzada` queda en true una vez reservado el evento aunque después suba el total
 * (RN-09): la seña no se vuelve a pedir.
 */
export const esquemaSaldoEvento = z.object({
  baseDeCobro: esquemaImporte,
  incluyeIva: z.boolean(),
  pagado: esquemaImporte,
  // Como esquemaImporte, pero con signo: es el único importe del sistema que puede ser negativo.
  saldo: z.string().regex(/^-?\d{1,10}(\.\d{1,2})?$/, 'Importe inválido'),
  porcentajeAbonado: z.number(),
  montoSena: esquemaImporte,
  senaAlcanzada: z.boolean(),
  // Si lo pagado hoy, sin los pagos anulados, llega al 20% de la base. A diferencia de
  // `senaAlcanzada`, no queda fijo al reservar: si una anulación (HU-35) deja lo pagado por debajo
  // de la seña, el evento sigue Reservado y la cuenta lo avisa (reunión 05/11/2026).
  cubreSena: z.boolean(),
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

// Respuesta de POST /eventos/:id/pagos/:pagoId/anular (HU-35 del Sprint 4): el pago ya anulado, el
// saldo sin él y el estado del evento, que vuelve de Cobrado a Reservado si lo pagado no llega al
// total. Si queda por debajo de la seña sigue Reservado y `saldo.cubreSena` lo avisa.
export const esquemaResultadoAnulacion = z.object({
  pago: esquemaPago,
  saldo: esquemaSaldoEvento,
  estadoEvento: esquemaEstadoEvento,
});
export type ResultadoAnulacion = z.infer<typeof esquemaResultadoAnulacion>;

// Un pago dentro del estado de cuenta (HU-21), con los dos hitos que puede haber disparado: el que
// completó la seña y reservó el salón (HU-13) y el que completó el total y dejó el evento Cobrado.
// Un mismo pago puede tener los dos.
export const esquemaPagoDeCuenta = esquemaPago.extend({
  completaSena: z.boolean(),
  completaPago: z.boolean(),
});
export type PagoDeCuenta = z.infer<typeof esquemaPagoDeCuenta>;

// Respuesta de GET /eventos/:id/pagos: el historial más el saldo actualizado (HU-14 C2, HU-21).
export const esquemaCuentaEvento = z.object({
  pagos: z.array(esquemaPagoDeCuenta),
  saldo: esquemaSaldoEvento,
});
export type CuentaEvento = z.infer<typeof esquemaCuentaEvento>;
