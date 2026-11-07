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

// Lo que acompaña a cada pago en las respuestas: el medio y, si está anulado, quién lo anuló (HU-35).
const INCLUIR_EN_PAGO = {
  medioPago: true,
  anuladoPor: { select: { id: true, email: true } },
} as const;

// El historial completo, con los pagos anulados: siguen en la cuenta, marcados (HU-35).
export async function listarDeEvento(eventoId: number, tx: Prisma.TransactionClient = prisma) {
  return tx.pago.findMany({
    where: { eventoId },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    include: INCLUIR_EN_PAGO,
  });
}

// Suma de lo entregado hasta ahora, sin los pagos anulados (HU-35). Devuelve null si el evento no
// tiene ningún pago vigente, por eso el servicio lo normaliza a 0. Se consulta dentro de la
// transacción al registrar o anular un pago, para que el acumulado con el que se decide el estado
// no quede desactualizado.
export async function sumarPagos(eventoId: number, tx: Prisma.TransactionClient = prisma) {
  const resultado = await tx.pago.aggregate({
    where: { eventoId, anuladoEn: null },
    _sum: { monto: true },
  });
  return resultado._sum.monto;
}

export async function buscarPago(id: number, tx: Prisma.TransactionClient = prisma) {
  return tx.pago.findUnique({ where: { id }, include: INCLUIR_EN_PAGO });
}

/**
 * HU-35: marca el pago como anulado, con la fecha y el usuario. Solo si todavía está vigente: con dos
 * anulaciones simultáneas del mismo pago, la segunda no encuentra nada que actualizar y devuelve 0,
 * así el servicio la rechaza en vez de pisar quién y cuándo lo anuló.
 */
export async function anular(
  datos: { pagoId: number; usuarioId: number },
  tx: Prisma.TransactionClient = prisma,
) {
  const resultado = await tx.pago.updateMany({
    where: { id: datos.pagoId, anuladoEn: null },
    data: { anuladoEn: new Date(), anuladoPorId: datos.usuarioId },
  });
  return resultado.count;
}

export async function buscarMedioPagoActivo(id: number, tx: Prisma.TransactionClient = prisma) {
  return tx.medioPago.findFirst({ where: { id, activo: true } });
}

export async function listarMediosPagoActivos(tx: Prisma.TransactionClient = prisma) {
  return tx.medioPago.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
}

// HU-20: el listado completo, activos y dados de baja, en orden alfabético.
export async function listarTodosLosMediosPago(tx: Prisma.TransactionClient = prisma) {
  return tx.medioPago.findMany({ orderBy: { nombre: 'asc' } });
}

// HU-19: el nombre es único sin distinguir mayúsculas. El índice de la base es exacto, así que
// antes de crear se busca así, activo o no: un medio dado de baja también ocupa el nombre.
export async function buscarMedioPagoPorNombre(
  nombre: string,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.medioPago.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } });
}

// Desde HU-53 todo medio vale en todos los cobros. Las marcas de factura ya no se usan, pero se
// cargan en los dos casos para que la base no diga lo contrario.
export async function crearMedioPago(
  datos: { nombre: string },
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.medioPago.create({ data: { ...datos, conFactura: true, sinFactura: true } });
}

// HU-33 del Sprint 4: el medio a modificar puede estar activo o dado de baja.
export async function buscarMedioPagoPorId(id: number, tx: Prisma.TransactionClient = prisma) {
  return tx.medioPago.findUnique({ where: { id } });
}

// Los pagos ya registrados referencian el medio por id: siguen apuntando a él y muestran el nombre
// nuevo. Desde HU-53 solo se modifica el nombre.
export async function modificarMedioPago(
  id: number,
  datos: { nombre: string },
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.medioPago.update({ where: { id }, data: datos });
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
  return tx.pago.create({ data: datos, include: INCLUIR_EN_PAGO });
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

// HU-35: un Cobrado al que una anulación deja por debajo del total vuelve a Reservado hasta cobrar la
// diferencia. El salón sigue tomado: los dos estados bloquean la franja (RN-12).
export async function volverAReservado(eventoId: number, tx: Prisma.TransactionClient = prisma) {
  return tx.evento.update({ where: { id: eventoId }, data: { estado: 'Reservado' } });
}

// HU-13 C6: los eventos que siguen EnConsulta y pisan la franja que este evento acaba de tomar.
// No se cancelan ni se tocan (dominio.md:30, Cancelado es siempre manual): se informan para que el
// Responsable de Eventos los gestione. Es una consulta, no un campo nuevo (sprint-02.md:116).
// RN-12: las consultas EnConsulta que comparten algún salón y se superponen quedan "en
// conflicto". Con varios salones por evento (ADR 0011) alcanza con compartir uno.
export async function buscarConsultasSuperpuestas(
  datos: { salonIds: number[]; inicio: Date; fin: Date; excluirEventoId: number },
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.evento.findMany({
    where: {
      salones: { some: { salonId: { in: datos.salonIds } } },
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
  buscarPago: typeof buscarPago;
  anular: typeof anular;
  buscarMedioPagoActivo: typeof buscarMedioPagoActivo;
  listarMediosPagoActivos: typeof listarMediosPagoActivos;
  listarTodosLosMediosPago: typeof listarTodosLosMediosPago;
  buscarMedioPagoPorNombre: typeof buscarMedioPagoPorNombre;
  crearMedioPago: typeof crearMedioPago;
  buscarMedioPagoPorId: typeof buscarMedioPagoPorId;
  modificarMedioPago: typeof modificarMedioPago;
  crear: typeof crear;
  confirmarPresupuestoYReservar: typeof confirmarPresupuestoYReservar;
  marcarCobrado: typeof marcarCobrado;
  volverAReservado: typeof volverAReservado;
  buscarConsultasSuperpuestas: typeof buscarConsultasSuperpuestas;
  crearEnTransaccion: typeof crearEnTransaccion;
};
