import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';

// Capa de acceso a datos del módulo. Cada función acepta un `tx` opcional (default: el cliente
// global) para poder correr dentro de una transacción, y para que los tests puedan mockear el
// módulo entero sin simular una transacción real (mismo criterio que presupuestos y solicitudes).

export async function buscarDetallado(id: number, tx: Prisma.TransactionClient = prisma) {
  return tx.evento.findUnique({
    where: { id },
    include: {
      cliente: true,
      salon: true,
      distribucion: true,
      solicitud: true,
      presupuestos: { include: { lineas: true } },
    },
  });
}

// Agenda del panel del administrador: los eventos que ocupan el salón (Reservado y Cobrado; los
// EnConsulta no bloquean y los Cancelado ya lo liberaron). Del presupuesto se trae solo el total
// del Confirmado más reciente, que es el que quedó congelado al acreditarse la seña.
export async function listarAgenda(tx: Prisma.TransactionClient = prisma) {
  return tx.evento.findMany({
    where: { estado: { in: ['Reservado', 'Cobrado'] } },
    orderBy: [{ fecha: 'asc' }, { inicio: 'asc' }],
    include: {
      cliente: {
        select: { id: true, nombre: true, apellido: true, telefono: true, correo: true },
      },
      salon: { select: { id: true, nombre: true } },
      distribucion: { select: { id: true, nombre: true } },
      presupuestos: {
        where: { estado: 'Confirmado' },
        orderBy: { creadoEn: 'desc' },
        take: 1,
        select: { total: true },
      },
    },
  });
}

export async function buscarDistribucion(id: number, tx: Prisma.TransactionClient = prisma) {
  return tx.distribucion.findUnique({ where: { id } });
}

// El evento puede acumular varios presupuestos (Presupuesto.eventoId no es único): se toma el
// Estimado más reciente como "el vigente", que es el que se confirma al acreditarse la seña.
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
export async function buscarSolapamiento(
  datos: { salonId: number; inicio: Date; fin: Date; excluirEventoId: number },
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.evento.findFirst({
    where: {
      salonId: datos.salonId,
      id: { not: datos.excluirEventoId },
      estado: { in: ['Reservado', 'Cobrado'] },
      inicio: { lt: datos.fin },
      fin: { gt: datos.inicio },
    },
  });
}

// Agendar NO cambia el estado ni toca el presupuesto: solo deja el evento con su franja horaria y
// su distribución definidas, todavía EnConsulta. El paso a Reservado lo hace el módulo de pagos
// cuando el acumulado cruza el 20% de la base de cobro (HU-13).
export async function agendar(
  datos: {
    eventoId: number;
    distribucionId: number;
    inicio: Date;
    fin: Date;
    modalidadSalonRestaurante: boolean;
  },
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.evento.update({
    where: { id: datos.eventoId },
    data: {
      distribucionId: datos.distribucionId,
      inicio: datos.inicio,
      fin: datos.fin,
      modalidadSalonRestaurante: datos.modalidadSalonRestaurante,
    },
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
  buscarDistribucion: typeof buscarDistribucion;
  buscarPresupuestoEstimado: typeof buscarPresupuestoEstimado;
  buscarSolapamiento: typeof buscarSolapamiento;
  agendar: typeof agendar;
  cancelar: typeof cancelar;
  crearEnTransaccion: typeof crearEnTransaccion;
};
