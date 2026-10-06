import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';

// Capa de acceso a datos del módulo. Cada función acepta un `tx` opcional (default: el cliente
// global) para poder correr dentro de una transacción, y para que los tests puedan mockear el
// módulo entero sin simular una transacción real (mismo criterio que eventos y presupuestos).
//
// Lo que ya existía en eventos.repositorio.ts se re-exporta en vez de duplicarse: así el servicio
// de pagos depende de un solo módulo y los tests mockean uno solo.
export { buscarDetallado, buscarSolapamiento } from '../eventos/eventos.repositorio.js';

// Solo para el `typeof` de PagosRepositorio; el re-export de arriba es el que las expone.
import type { buscarDetallado, buscarSolapamiento } from '../eventos/eventos.repositorio.js';

export async function listarDeEvento(eventoId: number, tx: Prisma.TransactionClient = prisma) {
  return tx.pago.findMany({
    where: { eventoId },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    include: { medioPago: true },
  });
}

// Suma de lo entregado hasta ahora. Devuelve null si el evento no tiene ningún pago, por eso el
// servicio lo normaliza a 0. Se consulta dentro de la transacción al registrar un pago, para que
// el acumulado con el que se decide la reserva no quede desactualizado.
export async function sumarPagos(eventoId: number, tx: Prisma.TransactionClient = prisma) {
  const resultado = await tx.pago.aggregate({ where: { eventoId }, _sum: { monto: true } });
  return resultado._sum.monto;
}

export async function buscarMedioPagoActivo(id: number, tx: Prisma.TransactionClient = prisma) {
  return tx.medioPago.findFirst({ where: { id, activo: true } });
}

export async function listarMediosPagoActivos(tx: Prisma.TransactionClient = prisma) {
  return tx.medioPago.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
}

export async function crear(
  datos: {
    eventoId: number;
    fecha: Date;
    monto: Prisma.Decimal;
    medioPagoId: number;
    observacion?: string;
  },
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.pago.create({ data: datos, include: { medioPago: true } });
}

/**
 * HU-13 completa, en una sola escritura: el presupuesto pasa a `Confirmado` (sus precios quedan
 * congelados) y el evento a `Reservado`, que es lo que ocupa el salón.
 *
 * `senaRegistradaEn` guarda el instante exacto en que el acumulado cruzó el 20%. Es la columna que
 * el Sprint 1 escribía a mano desde «Registrar seña cobrada»; ahora la escribe el pago.
 */
export async function confirmarPresupuestoYReservar(
  datos: { eventoId: number; presupuestoId: number },
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.presupuesto.update({
    where: { id: datos.presupuestoId },
    data: { estado: 'Confirmado' },
  });
  return tx.evento.update({
    where: { id: datos.eventoId },
    data: { estado: 'Reservado', senaRegistradaEn: new Date() },
  });
}

export async function marcarCobrado(eventoId: number, tx: Prisma.TransactionClient = prisma) {
  return tx.evento.update({ where: { id: eventoId }, data: { estado: 'Cobrado' } });
}

// HU-13 C6: los eventos que siguen EnConsulta y pisan la franja que este evento acaba de tomar.
// No se cancelan ni se tocan (dominio.md:30, Cancelado es siempre manual): se informan para que el
// Responsable de Eventos los gestione. Es una consulta, no un campo nuevo (sprint-02.md:116).
export async function buscarConsultasSuperpuestas(
  datos: { salonId: number; inicio: Date; fin: Date; excluirEventoId: number },
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.evento.findMany({
    where: {
      salonId: datos.salonId,
      id: { not: datos.excluirEventoId },
      estado: 'EnConsulta',
      inicio: { lt: datos.fin },
      fin: { gt: datos.inicio },
    },
    orderBy: { inicio: 'asc' },
    select: {
      id: true,
      inicio: true,
      fin: true,
      cliente: { select: { id: true, nombre: true, apellido: true } },
    },
  });
}

export async function crearEnTransaccion<T>(
  ejecutar: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((tx) => ejecutar(tx));
}

export type PagosRepositorio = {
  buscarDetallado: typeof buscarDetallado;
  buscarSolapamiento: typeof buscarSolapamiento;
  listarDeEvento: typeof listarDeEvento;
  sumarPagos: typeof sumarPagos;
  buscarMedioPagoActivo: typeof buscarMedioPagoActivo;
  listarMediosPagoActivos: typeof listarMediosPagoActivos;
  crear: typeof crear;
  confirmarPresupuestoYReservar: typeof confirmarPresupuestoYReservar;
  marcarCobrado: typeof marcarCobrado;
  buscarConsultasSuperpuestas: typeof buscarConsultasSuperpuestas;
  crearEnTransaccion: typeof crearEnTransaccion;
};
