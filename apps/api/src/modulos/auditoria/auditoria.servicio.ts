import type { FiltrosAuditoria, RegistroAuditoria } from '@confluens/shared';

import type { Prisma } from '../../generated/prisma/client.js';
import * as repositorioReal from './auditoria.repositorio.js';
import type { AuditoriaRepositorio } from './auditoria.repositorio.js';

// Los eventos son de Córdoba, en una zona fija sin horario de verano (ADR 0010): un día de
// calendario va de las 00:00 a las 24:00 en UTC-3.
const DESPLAZAMIENTO_ZONA = '-03:00';

function inicioDelDia(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000${DESPLAZAMIENTO_ZONA}`);
}

function inicioDelDiaSiguiente(fecha: string): Date {
  const dia = inicioDelDia(fecha);
  dia.setUTCDate(dia.getUTCDate() + 1);
  return dia;
}

/**
 * HU-25 del backlog: arma la consulta de los filtros. El campo se busca en la lista de campos que
 * cambiaron (índice GIN, ADR 0013); «hasta» incluye el día entero.
 */
export function armarFiltro(filtros: FiltrosAuditoria): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (filtros.entidad) where.entidad = filtros.entidad;
  if (filtros.campo) where.campos = { has: filtros.campo };
  if (filtros.sistema) where.usuarioId = null;
  else if (filtros.usuarioId) where.usuarioId = filtros.usuarioId;
  if (filtros.desde || filtros.hasta) {
    where.fecha = {
      ...(filtros.desde && { gte: inicioDelDia(filtros.desde) }),
      ...(filtros.hasta && { lt: inicioDelDiaSiguiente(filtros.hasta) }),
    };
  }
  return where;
}

export async function listarAuditoria(
  filtros: FiltrosAuditoria,
  repo: AuditoriaRepositorio = repositorioReal,
): Promise<{ registros: RegistroAuditoria[]; total: number }> {
  const { filas, total } = await repo.listar(
    armarFiltro(filtros),
    (filtros.page - 1) * filtros.pageSize,
    filtros.pageSize,
  );
  const registros = filas.map((fila) => ({
    ...fila,
    fecha: fila.fecha.toISOString(),
  })) as RegistroAuditoria[];
  return { registros, total };
}

export async function listarCamposAuditados(
  repo: AuditoriaRepositorio = repositorioReal,
): Promise<string[]> {
  return repo.listarCampos();
}
