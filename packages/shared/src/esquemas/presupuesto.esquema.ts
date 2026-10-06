import { z } from 'zod';

import { esquemaFechaHora, esquemaId, esquemaImporte } from './comunes.esquema.js';

// Valores literales de la máquina de estados aprobada (docs/producto/dominio.md).
export const esquemaEstadoPresupuesto = z.enum(['Estimado', 'Confirmado', 'Cancelado', 'Expirado']);
export type EstadoPresupuesto = z.infer<typeof esquemaEstadoPresupuesto>;

export const esquemaPresupuesto = z.object({
  id: esquemaId,
  eventoId: esquemaId,
  estado: esquemaEstadoPresupuesto,
  fechaEmision: esquemaFechaHora,
  total: esquemaImporte,
  // Define la base de cobro de RN-01: con factura la seña se calcula sobre el total CON IVA, sin
  // factura sobre este total, que está sin IVA (RN-05).
  requiereFactura: z.boolean(),
  creadoEn: esquemaFechaHora,
  actualizadoEn: esquemaFechaHora,
});
export type Presupuesto = z.infer<typeof esquemaPresupuesto>;
