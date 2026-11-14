import {
  type ChoqueDeSalon,
  ESTADOS_QUE_OCUPAN_SALON,
  type FiltrosAgenda,
} from '@confluens/shared';

import { enTransaccion, registrarAuditoria, registrarAuditorias } from '../../lib/auditoria.js';
import { prisma } from '../../lib/prisma.js';
import { salonesDelEvento } from '../presupuestos/presupuestos.repositorio.js';
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
      // HU-50: los días con su horario y sus salones.
      dias: { include: INCLUIR_SALONES_DEL_DIA, orderBy: { fecha: 'asc' } },
      solicitud: true,
      presupuestos: { include: { lineas: true } },
    },
  });
}

// Los salones de un día con su distribución (HU-50).
const INCLUIR_SALONES_DEL_DIA = {
  salones: { include: { salon: true, distribucion: true }, orderBy: { salonId: 'asc' } },
} as const;

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
      // HU-50: un evento de varios días entra si alguno de sus días cae en el rango, no solo el
      // primero: empieza antes del final del rango y termina después de su comienzo.
      fecha: { lte: hasta ? new Date(hasta) : undefined },
      fechaFin: { gte: desde ? new Date(desde) : undefined },
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
      dias: {
        select: {
          id: true,
          fecha: true,
          inicio: true,
          fin: true,
          cantidadPersonas: true,
          tipoJornada: true,
          salones: {
            select: {
              salon: { select: { id: true, nombre: true } },
              distribucion: { select: { id: true, nombre: true } },
            },
            orderBy: { salonId: 'asc' },
          },
        },
        orderBy: { fecha: 'asc' },
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
  // HU-50: se compara contra el horario de CADA DÍA de los otros eventos (el renglón del salón de ese
  // día), no contra el resumen del evento: un evento de varios días no ocupa las noches entre un día
  // y el siguiente. La condición del salón y la del horario van en el mismo renglón.
  return tx.evento.findFirst({
    where: {
      id: { not: datos.excluirEventoId },
      estado: { in: ['Reservado', 'Cobrado'] },
      salones: {
        some: {
          salonId: { in: datos.salonIds },
          inicio: { lt: datos.fin },
          fin: { gt: datos.inicio },
        },
      },
    },
    include: { salones: { include: { salon: { select: { id: true, nombre: true } } } } },
  });
}

/**
 * RN-12 por día (HU-50): TODOS los choques de las franjas de un evento de varios días. Cada franja es
 * un día con los salones que usa ese día y su horario. Devuelve un choque por cada día, salón y
 * evento que se superpone, con su fecha, el cliente y el horario del otro evento ese día, para
 * avisar de todos y no solo del primero. Compara contra el renglón de cada día de los otros eventos.
 */
export async function buscarChoquesPorDia(
  datos: {
    franjas: { fecha: string; salonIds: number[]; inicio: Date; fin: Date }[];
    excluirEventoId: number;
  },
  tx: Prisma.TransactionClient = prisma,
): Promise<ChoqueDeSalon[]> {
  if (datos.franjas.length === 0) return [];
  const filas = await tx.eventoSalon.findMany({
    where: {
      eventoId: { not: datos.excluirEventoId },
      estado: { in: ['Reservado', 'Cobrado'] },
      OR: datos.franjas.map((franja) => ({
        salonId: { in: franja.salonIds },
        inicio: { lt: franja.fin },
        fin: { gt: franja.inicio },
      })),
    },
    include: {
      salon: { select: { id: true, nombre: true } },
      evento: {
        select: { id: true, estado: true, cliente: { select: { nombre: true, apellido: true } } },
      },
    },
    orderBy: [{ inicio: 'asc' }, { salonId: 'asc' }],
  });
  // Un renglón puede tocar más de una franja (un evento que pasa la medianoche), así que se asigna a
  // cada franja con la que se superpone y en su mismo salón.
  return datos.franjas.flatMap((franja) =>
    filas
      .filter(
        (fila) =>
          franja.salonIds.includes(fila.salonId) &&
          fila.inicio !== null &&
          fila.fin !== null &&
          fila.inicio < franja.fin &&
          fila.fin > franja.inicio,
      )
      .map((fila) => ({
        fecha: franja.fecha,
        salon: fila.salon,
        evento: {
          id: fila.evento.id,
          estado: fila.evento.estado,
          cliente: [fila.evento.cliente.nombre, fila.evento.cliente.apellido]
            .filter(Boolean)
            .join(' '),
          inicio: fila.inicio!.toISOString(),
          fin: fila.fin!.toISOString(),
        },
      })),
  );
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
    // HU-50: una por renglón (día, salón); el renglón se identifica por su clave.
    distribuciones: { diaId: number; salonId: number; distribucionId: number }[];
    // Un evento de un solo día: el horario de su único día.
    inicio: Date;
    fin: Date;
    // HU-50: el horario de cada día (por su fecha, `AAAA-MM-DD`). Si viene, manda sobre `inicio` y
    // `fin`, que valen para todos los días.
    horarios?: { fecha: string; inicio: Date; fin: Date }[];
    modalidadSalonRestaurante: boolean;
  },
  tx: Prisma.TransactionClient = prisma,
) {
  await enTransaccion(tx, async (t) => {
    const anterior = await t.evento.findUniqueOrThrow({ where: { id: datos.eventoId } });
    const salonesAntes = await salonesDelEvento(datos.eventoId, t);
    // HU-50: el horario es del DÍA (hoy el evento tiene uno solo) y el resumen del evento lo escribe la
    // base a partir de él; en el evento solo queda la modalidad.
    if (datos.horarios) {
      // Cada día con su horario: el trigger lo lleva a los salones de ese día (RN-12).
      for (const { fecha, inicio, fin } of datos.horarios) {
        await t.eventoDia.updateMany({
          where: { eventoId: datos.eventoId, fecha: new Date(fecha) },
          data: { inicio, fin },
        });
      }
    } else {
      await t.eventoDia.updateMany({
        where: { eventoId: datos.eventoId },
        data: { inicio: datos.inicio, fin: datos.fin },
      });
    }
    await t.evento.update({
      where: { id: datos.eventoId },
      data: { modalidadSalonRestaurante: datos.modalidadSalonRestaurante },
    });
    // Se vuelve a leer: el resumen (inicio y fin) cambió por el trigger y es lo que se audita.
    const evento = await t.evento.findUniqueOrThrow({ where: { id: datos.eventoId } });
    for (const { diaId, salonId, distribucionId } of datos.distribuciones) {
      await t.eventoSalon.update({
        where: { diaId_salonId: { diaId, salonId } },
        data: { distribucionId },
      });
    }
    // HU-25 del backlog: el horario y, como un campo más, los salones con su distribución.
    await registrarAuditoria(t, {
      entidad: 'Evento',
      entidadId: datos.eventoId,
      anterior: { ...anterior, salones: salonesAntes },
      nuevo: { ...evento, salones: await salonesDelEvento(datos.eventoId, t) },
    });
  });
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
  return enTransaccion(tx, async (t) => {
    const anterior = await t.evento.findUniqueOrThrow({ where: { id } });
    const evento = await t.evento.update({
      where: { id },
      data: { observacionesComanda: observaciones === '' ? null : observaciones },
    });
    await registrarAuditoria(t, { entidad: 'Evento', entidadId: id, anterior, nuevo: evento });
    return evento;
  });
}

// Observaciones generales del evento. Igual que las de la comanda: cadena vacía se guarda como null.
export async function guardarObservaciones(
  id: number,
  observaciones: string,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.evento.update({
    where: { id },
    data: { observaciones: observaciones === '' ? null : observaciones },
  });
}

// Cancelar el evento también cancela su(s) presupuesto(s) activos: un evento Cancelado no puede
// dejar un Presupuesto Estimado/Confirmado huérfano.
export async function cancelar(id: number, tx: Prisma.TransactionClient = prisma) {
  return enTransaccion(tx, async (t) => {
    const activos = { eventoId: id, estado: { in: ['Estimado' as const, 'Confirmado' as const] } };
    const presupuestos = await t.presupuesto.findMany({
      where: activos,
      select: { id: true, estado: true },
    });
    await t.presupuesto.updateMany({ where: activos, data: { estado: 'Cancelado' } });
    const anterior = await t.evento.findUniqueOrThrow({ where: { id } });
    const evento = await t.evento.update({ where: { id }, data: { estado: 'Cancelado' } });
    await registrarAuditorias(t, [
      { entidad: 'Evento', entidadId: id, anterior, nuevo: evento },
      ...presupuestos.map((presupuesto) => ({
        entidad: 'Presupuesto' as const,
        entidadId: presupuesto.id,
        anterior: { estado: presupuesto.estado },
        nuevo: { estado: 'Cancelado' },
      })),
    ]);
    return evento;
  });
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
  buscarChoquesPorDia: typeof buscarChoquesPorDia;
  agendarConDistribuciones: typeof agendarConDistribuciones;
  buscarDistribuciones: typeof buscarDistribuciones;
  guardarObservacionesComanda: typeof guardarObservacionesComanda;
  guardarObservaciones: typeof guardarObservaciones;
  cancelar: typeof cancelar;
  crearEnTransaccion: typeof crearEnTransaccion;
};
