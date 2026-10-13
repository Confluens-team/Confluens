import { PORCENTAJE_IVA } from '@confluens/shared';

import { Prisma } from '../generated/prisma/client.js';

// Lo comparten los pagos (HU-14) y la modificación de un presupuesto ya confirmado (HU-12): los
// dos tienen que medir lo pagado contra la misma base para decidir el estado del evento.

const CIEN = new Prisma.Decimal(100);
export const PORCENTAJE_TOTAL = 100;

export type PresupuestoDeBase = {
  id: number;
  estado: string;
  total: Prisma.Decimal;
  requiereFactura: boolean;
};

/**
 * Base de cobro de **RN-01**, que es la resolución de S-08: el porcentaje de la seña no se calcula
 * sobre el total del presupuesto sino sobre lo que el cliente realmente tiene que pagar.
 *
 * - `requiereFactura: true` → el cliente paga el total más el IVA, así que la base lo incluye.
 * - `requiereFactura: false` → la base es el total tal cual está guardado, sin IVA (RN-05).
 *
 * No se guarda en ninguna columna: se recalcula en cada consulta (sprint-02.md:130). Toda la
 * aritmética es con `Prisma.Decimal`, nunca con `number`: son importes.
 */
export function calcularBaseDeCobro(presupuesto: PresupuestoDeBase): Prisma.Decimal {
  const total = new Prisma.Decimal(presupuesto.total);
  if (!presupuesto.requiereFactura) return total;
  return total.times(CIEN.plus(PORCENTAJE_IVA)).dividedBy(CIEN).toDecimalPlaces(2);
}

// `pagado >= base * porcentaje / 100`, pero multiplicando en vez de dividiendo: la división puede
// dejar decimales que no entran en Decimal(12,2) y un redondeo acá cambiaría de lado el umbral.
export function alcanza(pagado: Prisma.Decimal, base: Prisma.Decimal, porcentaje: number): boolean {
  return pagado.times(CIEN).greaterThanOrEqualTo(base.times(porcentaje));
}
