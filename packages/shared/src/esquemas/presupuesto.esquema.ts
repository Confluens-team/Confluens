import { z } from 'zod';

import { esquemaFecha, esquemaFechaHora, esquemaId, esquemaImporte } from './comunes.esquema.js';

// Valores literales de la máquina de estados aprobada (docs/producto/dominio.md).
export const esquemaEstadoPresupuesto = z.enum(['Estimado', 'Confirmado', 'Cancelado', 'Expirado']);
export type EstadoPresupuesto = z.infer<typeof esquemaEstadoPresupuesto>;

export const esquemaPresupuesto = z.object({
  id: esquemaId,
  eventoId: esquemaId,
  estado: esquemaEstadoPresupuesto,
  fechaEmision: esquemaFechaHora,
  venceEn: esquemaFechaHora, // fechaEmision + 10 días (RN-08)
  total: esquemaImporte,
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

// Filtros de GET /presupuestos (HU-10). `cliente` busca por nombre, apellido o correo; `desde` y
// `hasta` acotan la fecha del evento, inclusive. Un parámetro vacío (?cliente=) cuenta como ausente.
const vacioComoAusente = (valor: unknown) =>
  typeof valor === 'string' && valor.trim() === '' ? undefined : valor;

export const esquemaFiltrosPresupuestos = z
  .object({
    estado: z.preprocess(vacioComoAusente, esquemaEstadoPresupuesto.optional()),
    cliente: z.preprocess(vacioComoAusente, z.string().trim().max(100).optional()),
    desde: z.preprocess(vacioComoAusente, esquemaFecha.optional()),
    hasta: z.preprocess(vacioComoAusente, esquemaFecha.optional()),
  })
  .refine((filtros) => !filtros.desde || !filtros.hasta || filtros.desde <= filtros.hasta, {
    path: ['hasta'],
    message: 'La fecha hasta no puede ser anterior a la fecha desde',
  });
export type FiltrosPresupuestos = z.infer<typeof esquemaFiltrosPresupuestos>;
