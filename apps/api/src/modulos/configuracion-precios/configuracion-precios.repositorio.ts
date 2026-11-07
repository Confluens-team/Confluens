import type { Prisma } from '../../generated/prisma/client.js';
import { registrarAuditoria } from '../../lib/auditoria.js';
import { prisma } from '../../lib/prisma.js';

// RN-10 / RN-13: la fila única de la configuración de precios (id 1, la crea la migración).

export async function obtener() {
  return prisma.configuracionPrecios.findUnique({ where: { id: 1 } });
}

// upsert y no update: una base armada a mano puede no tener la fila. Acepta el `tx` de la
// transacción que también recalcula los presupuestos (HU-54). El cambio de porcentaje queda en la
// auditoría a nombre de quien lo hizo (HU-25 del backlog); sin fila previa cuenta como alta.
export async function guardar(porcentajeMensual: string, tx: Prisma.TransactionClient = prisma) {
  const anterior = await tx.configuracionPrecios.findUnique({ where: { id: 1 } });
  const fila = await tx.configuracionPrecios.upsert({
    where: { id: 1 },
    create: { id: 1, porcentajeMensual },
    update: { porcentajeMensual },
  });
  await registrarAuditoria(tx, {
    entidad: 'ConfiguracionPrecios',
    entidadId: 1,
    anterior: anterior && { porcentajeMensual: anterior.porcentajeMensual },
    nuevo: { porcentajeMensual: fila.porcentajeMensual },
  });
  return fila;
}

export async function enTransaccion<T>(
  ejecutar: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((tx) => ejecutar(tx));
}

export type ConfiguracionPreciosRepositorio = {
  obtener: typeof obtener;
  guardar: typeof guardar;
  enTransaccion: typeof enTransaccion;
};
