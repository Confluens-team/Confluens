import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';

// Capa de acceso a datos del módulo. Cada función acepta un `tx` opcional (default: el cliente
// global) para poder correr dentro de la transacción de reservar(), y para que los tests puedan
// mockear el módulo entero sin simular una transacción real (mismo criterio que presupuestos y
// solicitudes).

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
// del Confirmado más reciente, que es el que quedó tomado al reservar.
export async function listarAgenda(tx: Prisma.TransactionClient = prisma) {
  return tx.evento.findMany({
    where: { estado: { in: ['Reservado', 'Cobrado'] } },
    orderBy: [{ fecha: 'asc' }, { inicio: 'asc' }],
    include: {
      cliente: { select: { id: true, nombre: true, telefono: true, correo: true } },
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
// Estimado más reciente como "el vigente" a confirmar.
export async function buscarPresupuestoEstimado(
  eventoId: number,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.presupuesto.findFirst({
    where: { eventoId, estado: 'Estimado' },
    orderBy: { creadoEn: 'desc' },
  });
}

// Criterio 2 (parte "aplicación"): pre-chequeo antes de intentar el update, para poder informar
// con qué evento se superpone (el error de la constraint EXCLUDE de Postgres no lo dice). La
// constraint sigue siendo la red de seguridad final ante una carrera entre dos reservas.
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

export async function reservar(
  datos: {
    eventoId: number;
    presupuestoId: number;
    distribucionId: number;
    inicio: Date;
    fin: Date;
    senaVenceEn: Date;
    modalidadSalonRestaurante: boolean;
  },
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.presupuesto.update({
    where: { id: datos.presupuestoId },
    data: { estado: 'Confirmado' },
  });
  return tx.evento.update({
    where: { id: datos.eventoId },
    data: {
      estado: 'Reservado',
      distribucionId: datos.distribucionId,
      inicio: datos.inicio,
      fin: datos.fin,
      senaVenceEn: datos.senaVenceEn,
      modalidadSalonRestaurante: datos.modalidadSalonRestaurante,
    },
  });
}

export async function registrarSena(id: number, tx: Prisma.TransactionClient = prisma) {
  return tx.evento.update({ where: { id }, data: { senaRegistradaEn: new Date() } });
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
  reservar: typeof reservar;
  registrarSena: typeof registrarSena;
  cancelar: typeof cancelar;
  crearEnTransaccion: typeof crearEnTransaccion;
};
