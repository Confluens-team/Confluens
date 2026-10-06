import { z } from 'zod';

import {
  esquemaFecha,
  esquemaFechaHora,
  esquemaId,
  esquemaImporte,
  vacioComoAusente,
} from './comunes.esquema.js';

// Valores literales de la máquina de estados aprobada (docs/producto/dominio.md).
export const esquemaEstadoPresupuesto = z.enum(['Estimado', 'Confirmado', 'Cancelado', 'Expirado']);
export type EstadoPresupuesto = z.infer<typeof esquemaEstadoPresupuesto>;

// HU-10: el listado de consultas no muestra los Confirmado, que pasan a la agenda de eventos.
export const esquemaEstadoConsulta = esquemaEstadoPresupuesto.exclude(['Confirmado']);
export type EstadoConsulta = z.infer<typeof esquemaEstadoConsulta>;

export const esquemaPresupuesto = z.object({
  id: esquemaId,
  eventoId: esquemaId,
  estado: esquemaEstadoPresupuesto,
  fechaEmision: esquemaFechaHora,
  venceEn: esquemaFechaHora, // 10 días desde la emisión o la última modificación (RN-08)
  total: esquemaImporte,
  // Define la base de cobro de RN-01: con factura la seña se calcula sobre el total CON IVA, sin
  // factura sobre este total, que está sin IVA (RN-05).
  requiereFactura: z.boolean(),
  creadoEn: esquemaFechaHora,
  actualizadoEn: esquemaFechaHora,
});
export type Presupuesto = z.infer<typeof esquemaPresupuesto>;

// HU-10: una fila del listado de presupuestos del personal. `total` es sin IVA (RN-05), como se
// guarda; la web calcula el total con IVA para mostrarlo.
export const esquemaPresupuestoListado = z.object({
  id: esquemaId,
  eventoId: esquemaId,
  estado: esquemaEstadoPresupuesto,
  fechaEmision: esquemaFechaHora,
  venceEn: esquemaFechaHora,
  total: esquemaImporte,
  fechaEvento: esquemaFecha,
  cliente: z.object({
    id: esquemaId,
    nombre: z.string(),
    apellido: z.string().nullable(),
    correo: z.string(),
  }),
  salon: z.object({ id: esquemaId, nombre: z.string() }),
});
export type PresupuestoListado = z.infer<typeof esquemaPresupuestoListado>;

// Filtros de GET /presupuestos (HU-10). Sin `estado` lista todos menos los Confirmado. `cliente`
// busca por nombre, apellido o correo; `desde` y `hasta` acotan la fecha del evento, inclusive. Un
// parámetro vacío (?cliente=) cuenta como ausente.
export const esquemaFiltrosPresupuestos = z
  .object({
    estado: z.preprocess(vacioComoAusente, esquemaEstadoConsulta.optional()),
    cliente: z.preprocess(vacioComoAusente, z.string().trim().max(100).optional()),
    desde: z.preprocess(vacioComoAusente, esquemaFecha.optional()),
    hasta: z.preprocess(vacioComoAusente, esquemaFecha.optional()),
  })
  .refine((filtros) => !filtros.desde || !filtros.hasta || filtros.desde <= filtros.hasta, {
    path: ['hasta'],
    message: 'La fecha hasta no puede ser anterior a la fecha desde',
  });
export type FiltrosPresupuestos = z.infer<typeof esquemaFiltrosPresupuestos>;
