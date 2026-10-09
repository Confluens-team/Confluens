import { ESTADOS_QUE_OCUPAN_SALON, type FiltrosAgenda } from '@confluens/shared';

import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';

// Capa de acceso a datos del módulo. Cada función acepta un `tx` opcional (default: el cliente
// global) para poder correr dentro de una transacción, y para que los tests puedan mockear el
// módulo entero sin simular una transacción real (mismo criterio que presupuestos y solicitudes).

export async function buscarDetallado(id: number, tx: Prisma.TransactionClient = prisma) {
  return tx.evento.findUnique({
    where: { id },
    include: {
      // La etiqueta es solo para el personal: estas rutas no las usa el rol Cliente.
      cliente: { include: { etiqueta: { select: { id: true, nombre: true } } } },
      // Cada salón con la distribución que tiene armada en este evento (ADR 0011).
      salones: { include: { salon: true, distribucion: true }, orderBy: { salonId: 'asc' } },
      solicitud: true,
      presupuestos: { include: { lineas: true } },
    },
  });
}

// Agenda del personal interno (HU-15). Sin filtros devuelve los eventos que ocupan el salón
// (ESTADOS_QUE_OCUPAN_SALON): los EnConsulta no bloquean y los Cancelado ya lo liberaron, así que
// no se muestran salvo que se pidan explícitamente. `desde`/`hasta` acotan la fecha del evento,
// inclusive, y son el rango visible del calendario. Del presupuesto se trae solo el total del
// Confirmado más reciente, que es el que quedó congelado al acreditarse la seña.
export async function listarAgenda(
  filtros: FiltrosAgenda = {},
  tx: Prisma.TransactionClient = prisma,
) {
  const { desde, hasta, salonId, estado } = filtros;

  return tx.evento.findMany({
    where: {
      estado: { in: estado ?? [...ESTADOS_QUE_OCUPAN_SALON] },
      // El filtro acierta si el evento ocupa alguno de los salones pedidos (ADR 0011).
      salones: salonId ? { some: { salonId: { in: salonId } } } : undefined,
      fecha: {
        gte: desde ? new Date(desde) : undefined,
        lte: hasta ? new Date(hasta) : undefined,
      },
    },
    orderBy: [{ fecha: 'asc' }, { inicio: 'asc' }],
    include: {
      cliente: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          telefono: true,
          correo: true,
          etiqueta: { select: { id: true, nombre: true } },
        },
      },
      salones: {
        select: {
          salon: { select: { id: true, nombre: true } },
          distribucion: { select: { id: true, nombre: true } },
        },
        orderBy: { salonId: 'asc' },
      },
      presupuestos: {
        where: { estado: 'Confirmado' },
        orderBy: { creadoEn: 'desc' },
        take: 1,
        select: { total: true },
      },
    },
  });
}

// Cada evento tiene un solo presupuesto (decisión del PO, 06/10/2026), pero Presupuesto.eventoId
// no es único en el modelo: se toma el Estimado más reciente, que es el que se confirma al
// acreditarse la seña.
export async function buscarPresupuestoEstimado(
  eventoId: number,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.presupuesto.findFirst({
    where: { eventoId, estado: 'Estimado' },
    orderBy: { creadoEn: 'desc' },
  });
}

// RN-12, parte "aplicación": pre-chequeo antes de intentar el update, para poder informar con qué
// evento se superpone (el error de la constraint EXCLUDE de Postgres no lo dice). La constraint
// sigue siendo la red de seguridad final ante una carrera entre dos reservas. Lo usan agendar() y
// el módulo de pagos, que es el que termina ocupando el salón.
// RN-12 en la aplicación: otro evento que ya ocupa alguno de estos salones en esa franja. Con
// varios salones por evento (ADR 0011) choca si comparte cualquiera de ellos. Trae los salones del
// evento encontrado para poder decir en cuál choca, algo que el error de la restricción EXCLUDE de
// Postgres no dice.
export async function buscarSolapamiento(
  datos: { salonIds: number[]; inicio: Date; fin: Date; excluirEventoId: number },
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.evento.findFirst({
    where: {
      salones: { some: { salonId: { in: datos.salonIds } } },
      id: { not: datos.excluirEventoId },
      estado: { in: ['Reservado', 'Cobrado'] },
      inicio: { lt: datos.fin },
      fin: { gt: datos.inicio },
    },
    include: { salones: { include: { salon: { select: { id: true, nombre: true } } } } },
  });
}

/**
 * Deja agendado el evento: horario y modalidad en Evento, y la distribución de cada salón en su
 * renglón de EventoSalon. inicio y fin de EventoSalon no se tocan acá: los baja el trigger
 * (ADR 0011).
 *
 * Agendar NO cambia el estado ni toca el presupuesto: el evento queda con su franja y sus
 * distribuciones definidas, todavía EnConsulta. El paso a Reservado lo hace el módulo de pagos
 * cuando el acumulado cruza el 20% de la base de cobro (HU-13).
 */
export async function agendarConDistribuciones(
  datos: {
    eventoId: number;
    distribuciones: { salonId: number; distribucionId: number }[];
    inicio: Date;
    fin: Date;
    modalidadSalonRestaurante: boolean;
  },
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.evento.update({
    where: { id: datos.eventoId },
    data: {
      inicio: datos.inicio,
      fin: datos.fin,
      modalidadSalonRestaurante: datos.modalidadSalonRestaurante,
    },
  });
  for (const { salonId, distribucionId } of datos.distribuciones) {
    await tx.eventoSalon.update({
      where: { eventoId_salonId: { eventoId: datos.eventoId, salonId } },
      data: { distribucionId },
    });
  }
}

// Varias a la vez: las distribuciones de todos los salones del evento.
export async function buscarDistribuciones(ids: number[], tx: Prisma.TransactionClient = prisma) {
  return tx.distribucion.findMany({ where: { id: { in: ids } } });
}

// Notas de la comanda de cocina. Cadena vacía se guarda como null: "sin observaciones" es un
// solo valor en la base, no dos.
export async function guardarObservacionesComanda(
  id: number,
  observaciones: string,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.evento.update({
    where: { id },
    data: { observacionesComanda: observaciones === '' ? null : observaciones },
  });
}

// Cancelar el evento también cancela su(s) presupuesto(s) activos: un evento Cancelado no puede
// dejar un Presupuesto Estimado/Confirmado huérfano.
export async function cancelar(id: number, tx: Prisma.TransactionClient = prisma) {
  await tx.presupuesto.updateMany({
    where: { eventoId: id, estado: { in: ['Estimado', 'Confirmado'] } },
    data: { estado: 'Cancelado' },
  });
  return tx.evento.update({ where: { id }, data: { estado: 'Cancelado' } });
}

export async function crearEnTransaccion<T>(
  ejecutar: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((tx) => ejecutar(tx));
}

export type EventosRepositorio = {
  buscarDetallado: typeof buscarDetallado;
  listarAgenda: typeof listarAgenda;
  buscarPresupuestoEstimado: typeof buscarPresupuestoEstimado;
  buscarSolapamiento: typeof buscarSolapamiento;
  agendarConDistribuciones: typeof agendarConDistribuciones;
  buscarDistribuciones: typeof buscarDistribuciones;
  guardarObservacionesComanda: typeof guardarObservacionesComanda;
  cancelar: typeof cancelar;
  crearEnTransaccion: typeof crearEnTransaccion;
};
