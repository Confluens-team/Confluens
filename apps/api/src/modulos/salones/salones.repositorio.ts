import type { ActualizarLandingSalon } from '@confluens/shared';

import { prisma } from '../../lib/prisma.js';

// Orden por capacidad descendente: así el primer elemento de la lista es siempre "la mayor
// disponible" (criterio 4 de HU-01), sin tener que recalcular un máximo aparte en el servicio.
export async function obtenerSalonesConDistribuciones() {
  return prisma.salon.findMany({
    include: { distribuciones: true },
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
      distribuciones: true,
    },
    orderBy: { capacidadMaxima: 'desc' },
  });
}

export async function obtenerSalonPorId(id: number) {
  return prisma.salon.findUnique({ where: { id } });
}

// Actualiza el contenido de landing del salón y deja el rastro en audit_log (HU-08, criterio 4).
// Las dos escrituras van en una transacción: un cambio publicado sin auditoría sería justamente
// el agujero que la Definición de Terminado del sprint pide cerrar, así que o pasan las dos o
// ninguna.
//
// Es la primera escritura de auditoría del repo. Queda acotada a este caso a propósito: HU-25
// (Sprint 5) define el mecanismo general y va a querer absorber esto.
//
// valorAnterior y valorNuevo guardan solo los campos tocados, no el salón entero: lo que importa
// auditar es el cambio, y así el diff se lee sin comparar dos objetos completos.
export async function actualizarLanding(
  id: number,
  cambios: ActualizarLandingSalon,
  anterior: { visibleEnLanding: boolean; fotoUrl: string | null },
  usuarioId: number,
) {
  const camposTocados = Object.keys(cambios) as (keyof ActualizarLandingSalon)[];
  const valorAnterior = Object.fromEntries(camposTocados.map((campo) => [campo, anterior[campo]]));

  return prisma.$transaction(async (tx) => {
    const salon = await tx.salon.update({ where: { id }, data: cambios });
    await tx.auditLog.create({
      data: {
        usuarioId,
        entidad: 'Salon',
        entidadId: String(id),
        valorAnterior,
        valorNuevo: cambios,
      },
    });
    return salon;
  });
}
