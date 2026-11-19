import type {
  ActualizarLandingSalon,
  CrearDistribucion,
  ModificarDistribucion,
  ModificarSalon,
} from '@confluens/shared';

import { registrarAuditoria } from '../../lib/auditoria.js';
import { prisma } from '../../lib/prisma.js';

// Orden por capacidad descendente: así el primer elemento de la lista es siempre "la mayor
// disponible" (criterio 4 de HU-01), sin tener que recalcular un máximo aparte en el servicio.
// Las distribuciones van por id: sin un orden explícito, Postgres devuelve al final la última
// editada (HU-26) y la lista cambiaba de orden en cada guardado.
export async function obtenerSalonesConDistribuciones() {
  return prisma.salon.findMany({
    include: { distribuciones: { orderBy: { id: 'asc' } } },
    orderBy: { capacidadMaxima: 'desc' },
  });
}

// Catálogo del canal público (HU-07). Dos diferencias con la consulta interna, y las dos son
// criterios de aceptación:
// - where visibleEnLanding: un salón despublicado desde HU-08 no se lista, aunque siga disponible
//   para uso interno (criterio 6).
// - select explícito en vez de include: los precios no se seleccionan, así que no salen de la base
//   ni viajan por la red (criterio 5). Un omit sobre el modelo completo dejaría la puerta abierta a
//   que un campo nuevo se publique solo; acá hay que agregarlo a mano.
export async function obtenerSalonesPublicos() {
  return prisma.salon.findMany({
    where: { visibleEnLanding: true },
    select: {
      id: true,
      nombre: true,
      capacidadMaxima: true,
      superficie: true,
      fotoUrl: true,
      // Las dadas de baja (HU-25 del Sprint 4) no se publican: el cliente no las puede pedir.
      distribuciones: { where: { activo: true }, orderBy: { id: 'asc' } },
    },
    orderBy: { capacidadMaxima: 'desc' },
  });
}

export async function obtenerSalonPorId(id: number) {
  return prisma.salon.findUnique({ where: { id } });
}

// Actualiza el contenido de landing del salón y deja el rastro en audit_log (HU-08, criterio 4).
// Las dos escrituras van en una transacción: o pasan las dos o ninguna. Desde HU-25 del backlog usa
// el mecanismo común de lib/auditoria.ts, que guarda solo los campos que cambiaron.
export async function actualizarLanding(
  id: number,
  cambios: ActualizarLandingSalon,
  anterior: { visibleEnLanding: boolean; fotoUrl: string | null },
  usuarioId: number,
) {
  return prisma.$transaction(async (tx) => {
    const salon = await tx.salon.update({ where: { id }, data: cambios });
    await registrarAuditoria(tx, {
      usuarioId,
      entidad: 'Salon',
      entidadId: id,
      anterior,
      nuevo: salon,
    });
    return salon;
  });
}

// HU-25: el nombre es único dentro del salón sin distinguir mayúsculas. El índice de la base
// (@@unique([salonId, nombre])) es exacto, así que antes de crear se busca así, como en los medios
// de pago (HU-19).
export async function buscarDistribucionPorNombre(salonId: number, nombre: string) {
  return prisma.distribucion.findFirst({
    where: { salonId, nombre: { equals: nombre, mode: 'insensitive' } },
  });
}

export async function crearDistribucion(salonId: number, datos: CrearDistribucion) {
  return prisma.$transaction(async (tx) => {
    const distribucion = await tx.distribucion.create({ data: { ...datos, salonId } });
    await registrarAuditoria(tx, {
      entidad: 'Distribucion',
      entidadId: distribucion.id,
      anterior: null,
      nuevo: distribucion,
    });
    return distribucion;
  });
}

// HU-26 (Sprint 4): modifica los precios. Los presupuestos ya emitidos no cambian: sus líneas
// guardan el precio congelado (RN-03, RN-10). Devuelve el salón con sus distribuciones, igual que el
// listado, para que la web no tenga que pedirlo de nuevo.
export async function modificarSalon(id: number, datos: ModificarSalon) {
  return prisma.$transaction(async (tx) => {
    const anterior = await tx.salon.findUniqueOrThrow({ where: { id } });
    const salon = await tx.salon.update({
      where: { id },
      data: datos,
      include: { distribuciones: { orderBy: { id: 'asc' } } },
    });
    await registrarAuditoria(tx, { entidad: 'Salon', entidadId: id, anterior, nuevo: salon });
    return salon;
  });
}

export async function buscarDistribucionPorId(id: number) {
  return prisma.distribucion.findUnique({ where: { id } });
}

// Edita una distribución y audita lo que cambió, en una transacción (HU-25 del backlog).
async function actualizarDistribucion(
  id: number,
  datos: ModificarDistribucion | { activo: boolean },
) {
  return prisma.$transaction(async (tx) => {
    const anterior = await tx.distribucion.findUniqueOrThrow({ where: { id } });
    const distribucion = await tx.distribucion.update({ where: { id }, data: datos });
    await registrarAuditoria(tx, {
      entidad: 'Distribucion',
      entidadId: id,
      anterior,
      nuevo: distribucion,
    });
    return distribucion;
  });
}

// HU-26 (Sprint 4): edición de una distribución. Los eventos la referencian por id, así que el
// cambio de nombre o de capacidad se ve en los que ya la usan; la capacidad es informativa y no
// pone tope a la cantidad de personas (dominio.md).
export async function modificarDistribucion(id: number, datos: ModificarDistribucion) {
  return actualizarDistribucion(id, datos);
}

// HU-25 (Sprint 4): baja lógica o reactivación. Los eventos que ya la tienen la siguen referenciando
// por id y no cambian; lo que cambia es que no se ofrece en presupuestos ni agendas nuevas.
export async function cambiarEstadoDistribucion(id: number, activo: boolean) {
  return actualizarDistribucion(id, { activo });
}
