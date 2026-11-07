import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';

// HU-25 del backlog: lectura de audit_log para la pestaña Auditoría. Nada acá escribe: el registro
// lo escribe lib/auditoria.ts y la base rechaza modificarlo o borrarlo.

const SELECCION = {
  id: true,
  fecha: true,
  entidad: true,
  entidadId: true,
  campos: true,
  valorAnterior: true,
  valorNuevo: true,
  usuario: { select: { id: true, email: true } },
} as const;

// Del más reciente al más antiguo (criterio 6); el id desempata los del mismo instante.
export async function listar(where: Prisma.AuditLogWhereInput, salto: number, cantidad: number) {
  const [filas, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      skip: salto,
      take: cantidad,
      select: SELECCION,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { filas, total };
}

// Los campos que aparecen en la auditoría, para ofrecerlos en el filtro.
export async function listarCampos(): Promise<string[]> {
  const filas = await prisma.$queryRaw<{ campo: string }[]>`
    SELECT DISTINCT unnest("campos") AS campo FROM "audit_log" ORDER BY campo`;
  return filas.map(({ campo }) => campo);
}

export type AuditoriaRepositorio = {
  listar: typeof listar;
  listarCampos: typeof listarCampos;
};
