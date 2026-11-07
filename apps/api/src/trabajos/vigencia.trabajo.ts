import { registrarAuditorias } from '../lib/auditoria.js';
import { prisma } from '../lib/prisma.js';

/**
 * RN-08 (HU-10): pasa a Expirado los presupuestos Estimado cuya vigencia de 10 días ya venció.
 * Reemplaza al control de seña del Sprint 1: no se cancela nada (RN-06), el evento queda como
 * está y el presupuesto sigue visible para que el Responsable de Eventos lo recalcule. Los
 * presupuestos sin armar (venceEn null, ADR 0008) no vencen: `lt` nunca es verdadero para NULL.
 *
 * HU-25 del backlog: cada presupuesto vencido queda en la auditoría a nombre del Sistema (null),
 * en la misma transacción que el cambio de estado.
 */
export async function controlarVigencia(ahora: Date = new Date()): Promise<number> {
  const vencidos = { estado: 'Estimado' as const, venceEn: { lt: ahora } };
  return prisma.$transaction(async (tx) => {
    const presupuestos = await tx.presupuesto.findMany({ where: vencidos, select: { id: true } });
    if (presupuestos.length === 0) return 0;
    const ids = presupuestos.map(({ id }) => id);
    const { count } = await tx.presupuesto.updateMany({
      where: { ...vencidos, id: { in: ids } },
      data: { estado: 'Expirado' },
    });
    await registrarAuditorias(
      tx,
      ids.map((id) => ({
        usuarioId: null,
        entidad: 'Presupuesto' as const,
        entidadId: id,
        anterior: { estado: 'Estimado' },
        nuevo: { estado: 'Expirado' },
      })),
    );
    return count;
  });
}
