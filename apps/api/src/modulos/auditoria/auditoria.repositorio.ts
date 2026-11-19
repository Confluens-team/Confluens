import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';

// HU-25 del backlog: lectura de audit_log para la pestaña Auditoría. El registro lo escribe
// lib/auditoria.ts y la base rechaza modificarlo o borrarlo. Lo único que se escribe acá es la
// revisión del Gerente General, que vive en su propia tabla (Auditoría para Gerencia, 15/11/2026).

const SELECCION = {
  id: true,
  fecha: true,
  entidad: true,
  entidadId: true,
  campos: true,
  valorAnterior: true,
  valorNuevo: true,
  usuario: { select: { id: true, email: true, rol: true } },
  revision: {
    select: { revisadoEn: true, revisadoPor: { select: { id: true, email: true } } },
  },
} as const;

export type FilaAuditoria = Prisma.AuditLogGetPayload<{ select: typeof SELECCION }>;

// Del más reciente al más antiguo (criterio 6); el id desempata los del mismo instante.
const ORDEN = [
  { fecha: 'desc' },
  { id: 'desc' },
] satisfies Prisma.AuditLogOrderByWithRelationInput[];

export async function listar(where: Prisma.AuditLogWhereInput, salto: number, cantidad: number) {
  const [filas, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: ORDEN,
      skip: salto,
      take: cantidad,
      select: SELECCION,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { filas, total };
}

export async function contar(where: Prisma.AuditLogWhereInput): Promise<number> {
  return prisma.auditLog.count({ where });
}

// Cuántos cambios hizo cada usuario (null = el Sistema) y en qué parte del sistema, para el resumen.
export async function agruparPorUsuario(where: Prisma.AuditLogWhereInput) {
  const grupos = await prisma.auditLog.groupBy({
    by: ['usuarioId'],
    where,
    _count: { _all: true },
  });
  return grupos.map((grupo) => ({ usuarioId: grupo.usuarioId, cambios: grupo._count._all }));
}

export async function agruparPorEntidad(where: Prisma.AuditLogWhereInput) {
  const grupos = await prisma.auditLog.groupBy({
    by: ['entidad'],
    where,
    _count: { _all: true },
  });
  return grupos.map((grupo) => ({ entidad: grupo.entidad, cambios: grupo._count._all }));
}

export async function buscarUsuarios(ids: number[]) {
  if (ids.length === 0) return [];
  return prisma.usuario.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, rol: true },
  });
}

/**
 * Los registros de la base que forman parte de un evento: sus presupuestos, sus pagos y la solicitud
 * de la que salió. Sus cambios no llevan el id del evento (salvo el alta del pago), así que el
 * historial del evento los busca por estos ids.
 */
export async function idsDelEvento(eventoId: number) {
  const [evento, presupuestos, pagos, solicitudes] = await prisma.$transaction([
    prisma.evento.findUnique({ where: { id: eventoId }, select: { id: true } }),
    prisma.presupuesto.findMany({ where: { eventoId }, select: { id: true } }),
    prisma.pago.findMany({ where: { eventoId }, select: { id: true } }),
    prisma.solicitud.findMany({ where: { eventoId }, select: { id: true } }),
  ]);
  if (!evento) return null;
  return {
    presupuestos: presupuestos.map(({ id }) => id),
    pagos: pagos.map(({ id }) => id),
    solicitudes: solicitudes.map(({ id }) => id),
  };
}

export async function listarTodos(where: Prisma.AuditLogWhereInput, tope: number) {
  return prisma.auditLog.findMany({ where, orderBy: ORDEN, take: tope, select: SELECCION });
}

export async function buscarPorId(id: number) {
  return prisma.auditLog.findUnique({ where: { id }, select: SELECCION });
}

export async function crearRevision(auditLogId: number, revisadoPorId: number) {
  return prisma.revisionAuditoria.create({
    data: { auditLogId, revisadoPorId },
    select: {
      auditLogId: true,
      revisadoEn: true,
      revisadoPor: { select: { id: true, email: true } },
    },
  });
}

// Los campos que aparecen en la auditoría, para ofrecerlos en el filtro.
export async function listarCampos(): Promise<string[]> {
  const filas = await prisma.$queryRaw<{ campo: string }[]>`
    SELECT DISTINCT unnest("campos") AS campo FROM "audit_log" ORDER BY campo`;
  return filas.map(({ campo }) => campo);
}

export type AuditoriaRepositorio = {
  listar: typeof listar;
  contar: typeof contar;
  agruparPorUsuario: typeof agruparPorUsuario;
  agruparPorEntidad: typeof agruparPorEntidad;
  buscarUsuarios: typeof buscarUsuarios;
  idsDelEvento: typeof idsDelEvento;
  listarTodos: typeof listarTodos;
  buscarPorId: typeof buscarPorId;
  crearRevision: typeof crearRevision;
  listarCampos: typeof listarCampos;
};
