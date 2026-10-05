import { prisma } from '../lib/prisma.js';

/**
 * RN-08 (HU-10): pasa a Expirado los presupuestos Estimado cuya vigencia de 10 días ya venció.
 * Reemplaza al control de seña del Sprint 1: no se cancela nada (RN-06), el evento queda como
 * está y el presupuesto sigue visible para que el Responsable de Eventos lo recalcule.
 */
export async function controlarVigencia(ahora: Date = new Date()): Promise<number> {
  const { count } = await prisma.presupuesto.updateMany({
    where: { estado: 'Estimado', venceEn: { lt: ahora } },
    data: { estado: 'Expirado' },
  });
  return count;
}
