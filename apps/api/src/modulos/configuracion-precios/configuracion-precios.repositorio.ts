import { prisma } from '../../lib/prisma.js';

// RN-10 / RN-13: la fila única de la configuración de precios (id 1, la crea la migración).

export async function obtener() {
  return prisma.configuracionPrecios.findUnique({ where: { id: 1 } });
}

// upsert y no update: una base armada a mano puede no tener la fila.
export async function guardar(porcentajeMensual: string) {
  return prisma.configuracionPrecios.upsert({
    where: { id: 1 },
    create: { id: 1, porcentajeMensual },
    update: { porcentajeMensual },
  });
}

export type ConfiguracionPreciosRepositorio = {
  obtener: typeof obtener;
  guardar: typeof guardar;
};
