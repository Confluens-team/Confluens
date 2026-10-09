import type { FiltrosPresupuestos, TipoEventoSocial, TipoJornada } from '@confluens/shared';

import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';

// Capa de acceso a datos del módulo. Cada función acepta un `tx` opcional (default: el cliente
// global) para poder correr dentro de la transacción que arma crearEnTransaccion, y para que los
// tests puedan mockear el módulo entero sin simular una transacción real (mismo criterio que
// solicitudes.repositorio.ts, HU-14).

export async function buscarClientePorCorreo(
  correo: string,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.cliente.findFirst({ where: { correo } });
}

export async function crearCliente(
  datos: { nombre: string; telefono: string; correo: string },
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.cliente.create({ data: datos });
}

// ADR 0008: la consulta social toma el cliente de la sesión. Nunca crea una ficha: los clientes
// solo se dan de alta registrándose (dominio.md).
export async function buscarClientePorUsuarioId(
  usuarioId: number,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.cliente.findUnique({ where: { usuarioId } });
}

export async function buscarSalon(salonId: number, tx: Prisma.TransactionClient = prisma) {
  return tx.salon.findUnique({ where: { id: salonId } });
}

// Los salones de un evento, en el orden en que se eligieron: el servicio ordena por la lista que
// recibe, no por id, así la primera línea del presupuesto es el primer salón elegido.
export async function buscarSalonesPorIds(ids: number[], tx: Prisma.TransactionClient = prisma) {
  return tx.salon.findMany({ where: { id: { in: ids } } });
}

/**
 * Deja al evento con exactamente estos salones. Los renglones que ya estaban y siguen se
 * conservan, para no perder la distribución que tengan cargada.
 *
 * inicio, fin y estado no se escriben acá a propósito: los pone el trigger a partir del evento
 * (ADR 0011).
 */
export async function reemplazarSalonesDelEvento(
  eventoId: number,
  salonIds: number[],
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.eventoSalon.deleteMany({ where: { eventoId, salonId: { notIn: salonIds } } });
  const actuales = await tx.eventoSalon.findMany({
    where: { eventoId },
    select: { salonId: true },
  });
  const yaEstan = new Set(actuales.map((fila) => fila.salonId));
  const nuevos = salonIds.filter((id) => !yaEstan.has(id));
  if (nuevos.length > 0) {
    // createMany no dispara el trigger BEFORE INSERT fila por fila en todos los casos; create sí,
    // y son a lo sumo cinco salones.
    for (const salonId of nuevos) {
      await tx.eventoSalon.create({ data: { eventoId, salonId } });
    }
  }
}

// No filtra por `activo`: el servicio necesita distinguir "no existe" (404) de "existe pero no
// está activo" (422), así que decide con el listado completo.
export async function buscarServiciosPorIds(ids: number[], tx: Prisma.TransactionClient = prisma) {
  return tx.servicio.findMany({ where: { id: { in: ids } } });
}

// HU-15: si POST /presupuestos viene con solicitudId, se busca antes de escribir nada para poder
// distinguir "no existe" (404) de "ya fue tomada" (409), igual que buscarSalon/buscarServiciosPorIds.
export async function buscarSolicitud(id: number, tx: Prisma.TransactionClient = prisma) {
  return tx.solicitud.findUnique({ where: { id } });
}

// Vincula la Solicitud original al Evento recién creado, para que el RE vea en el detalle los
// datos de contacto y del formulario con los que el cliente pidió la consulta.
export async function vincularSolicitudAEvento(
  solicitudId: number,
  eventoId: number,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.solicitud.update({ where: { id: solicitudId }, data: { eventoId } });
}

// Un evento corporativo llega con salón; uno social, sin salón y con su tipo social (ADR 0008).
export async function crearEvento(
  datos: {
    clienteId: number;
    salonId: number | null;
    fecha: Date;
    cantidadPersonas: number;
    tipo: 'Social' | 'Corporativo';
    tipoSocial?: TipoEventoSocial | null;
    tipoSocialDetalle?: string | null;
    tipoJornada: TipoJornada;
    horaInicioEstimada?: string | null;
  },
  tx: Prisma.TransactionClient = prisma,
) {
  // estado: EnConsulta es el default del schema, no hace falta pasarlo.
  return tx.evento.create({ data: datos });
}

export async function crearPresupuestoConLineas(
  datos: {
    eventoId: number;
    fechaEmision: Date;
    venceEn: Date | null; // null: presupuesto sin armar de una consulta social (ADR 0008)
    total: string;
    lineas: {
      servicioId: number | null;
      salonId: number | null;
      descripcion: string;
      cantidad: number;
      precioUnitario: string;
      subtotal: string;
      aCotizar: boolean;
      horaEstimada: string | null;
    }[];
  },
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.presupuesto.create({
    data: {
      eventoId: datos.eventoId,
      fechaEmision: datos.fechaEmision,
      venceEn: datos.venceEn,
      total: datos.total,
      lineas: { create: datos.lineas },
    },
    include: { lineas: true, evento: true },
  });
}

// El evento con el estado de sus presupuestos: alcanza para saber si ya tiene uno antes de
// armarle el vacío. No trae las líneas, que acá no se miran.
export async function buscarEventoConPresupuestos(
  eventoId: number,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, estado: true, presupuestos: { select: { id: true, estado: true } } },
  });
}

// Orquesta la transacción completa: el servicio arma el callback y le pasa el mismo `tx` a cada
// función interna, logrando atomicidad real (todo o nada) entre Cliente, Evento, Presupuesto y
// sus líneas.
export async function crearEnTransaccion<T>(
  ejecutar: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((tx) => ejecutar(tx));
}

// HU-10: listado de consultas del personal, del más reciente al más antiguo por emisión (el id
// desempata los emitidos en el mismo instante). Los Confirmado no se listan: pasan a la agenda. Cada palabra de `cliente` tiene que aparecer en el nombre, el
// apellido o el correo, así "Marina Gómez" encuentra a quien tiene nombre y apellido separados.
export async function obtenerPresupuestos(filtros: FiltrosPresupuestos) {
  const { estado, cliente, desde, hasta } = filtros;
  const palabras = cliente?.split(/\s+/) ?? [];

  return prisma.presupuesto.findMany({
    where: {
      estado: estado ?? { not: 'Confirmado' },
      evento: {
        fecha: {
          gte: desde ? new Date(desde) : undefined,
          lte: hasta ? new Date(hasta) : undefined,
        },
        cliente: {
          AND: palabras.map((palabra) => ({
            OR: [
              { nombre: { contains: palabra, mode: 'insensitive' as const } },
              { apellido: { contains: palabra, mode: 'insensitive' as const } },
              { correo: { contains: palabra, mode: 'insensitive' as const } },
            ],
          })),
        },
      },
    },
    select: {
      id: true,
      eventoId: true,
      estado: true,
      fechaEmision: true,
      venceEn: true,
      total: true,
      evento: {
        select: {
          fecha: true,
          tipo: true,
          tipoSocial: true,
          tipoSocialDetalle: true,
          salon: { select: { id: true, nombre: true } },
          cliente: { select: { id: true, nombre: true, apellido: true, correo: true } },
        },
      },
    },
    orderBy: [{ fechaEmision: 'desc' }, { id: 'desc' }],
  });
}

// HU-12: la consulta completa para mostrarla y editarla. De cada servicio se trae si es tercerizado
// para informarlo en pantalla; las líneas salen en el orden en que se cargaron.
export async function buscarPresupuestoDetallado(
  id: number,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.presupuesto.findUnique({
    where: { id },
    include: {
      evento: {
        include: {
          cliente: true,
          salon: true,
          salones: { include: { salon: true }, orderBy: { salonId: 'asc' } },
          distribucion: true,
        },
      },
      lineas: { include: { servicio: { select: { tercerizado: true } } }, orderBy: { id: 'asc' } },
    },
  });
}

export async function actualizarEvento(
  id: number,
  datos: Prisma.EventoUpdateInput,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.evento.update({ where: { id }, data: datos });
}

export async function actualizarPresupuesto(
  id: number,
  datos: Prisma.PresupuestoUpdateInput,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.presupuesto.update({ where: { id }, data: datos });
}

// HU-12: modificar reemplaza todas las líneas. Las que no cambiaron vuelven con su precio congelado,
// que el servicio ya resolvió.
export async function reemplazarLineas(
  presupuestoId: number,
  lineas: {
    servicioId: number | null;
    salonId: number | null;
    descripcion: string;
    cantidad: number;
    precioUnitario: string;
    subtotal: string;
    aCotizar: boolean;
    horaEstimada: string | null;
  }[],
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.lineaPresupuesto.deleteMany({ where: { presupuestoId } });
  await tx.lineaPresupuesto.createMany({
    data: lineas.map((linea) => ({ ...linea, presupuestoId })),
  });
}

// HU-12 sobre un evento confirmado: con el total nuevo, lo pagado decide si el evento queda
// Reservado o Cobrado.
export async function sumarPagos(eventoId: number, tx: Prisma.TransactionClient = prisma) {
  const resultado = await tx.pago.aggregate({ where: { eventoId }, _sum: { monto: true } });
  return resultado._sum.monto;
}

// Al mover de salón un evento ya agendado se conserva la distribución del mismo nombre en el salón
// nuevo (todos tienen Conferencia, Mesas de trabajo y Banquete). Si no la tiene, queda sin elegir.
export async function buscarDistribucionPorNombre(
  salonId: number,
  nombre: string,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.distribucion.findFirst({ where: { salonId, nombre } });
}

export type PresupuestosRepositorio = {
  buscarClientePorCorreo: typeof buscarClientePorCorreo;
  buscarClientePorUsuarioId: typeof buscarClientePorUsuarioId;
  crearCliente: typeof crearCliente;
  buscarSalon: typeof buscarSalon;
  buscarSalonesPorIds: typeof buscarSalonesPorIds;
  reemplazarSalonesDelEvento: typeof reemplazarSalonesDelEvento;
  buscarServiciosPorIds: typeof buscarServiciosPorIds;
  buscarSolicitud: typeof buscarSolicitud;
  vincularSolicitudAEvento: typeof vincularSolicitudAEvento;
  crearEvento: typeof crearEvento;
  crearPresupuestoConLineas: typeof crearPresupuestoConLineas;
  buscarEventoConPresupuestos: typeof buscarEventoConPresupuestos;
  crearEnTransaccion: typeof crearEnTransaccion;
  obtenerPresupuestos: typeof obtenerPresupuestos;
  buscarPresupuestoDetallado: typeof buscarPresupuestoDetallado;
  actualizarEvento: typeof actualizarEvento;
  actualizarPresupuesto: typeof actualizarPresupuesto;
  reemplazarLineas: typeof reemplazarLineas;
  sumarPagos: typeof sumarPagos;
  buscarDistribucionPorNombre: typeof buscarDistribucionPorNombre;
};
