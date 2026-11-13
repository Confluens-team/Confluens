import type {
  FiltrosPresupuestos,
  ModalidadServicio,
  TipoEventoSocial,
  TipoJornada,
} from '@confluens/shared';

import {
  calcularDiferencia,
  enTransaccion,
  registrarAuditoria,
  registrarAuditorias,
} from '../../lib/auditoria.js';
import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';

// Capa de acceso a datos del módulo. Cada función acepta un `tx` opcional (default: el cliente
// global) para poder correr dentro de la transacción que arma crearEnTransaccion, y para que los
// tests puedan mockear el módulo entero sin simular una transacción real (mismo criterio que
// solicitudes.repositorio.ts, HU-14).
//
// HU-25 del backlog: cada escritura deja su registro de auditoría en el mismo `tx`. Lo que hace el
// cliente desde el cotizador no se audita (lo descarta lib/auditoria.ts por el rol de la sesión).

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
  return enTransaccion(tx, async (t) => {
    const cliente = await t.cliente.create({ data: datos });
    await registrarAuditoria(t, {
      entidad: 'Cliente',
      entidadId: cliente.id,
      anterior: null,
      nuevo: cliente,
    });
    return cliente;
  });
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
 * Saca del evento los salones que no están en `salonIds`. Al modificar un evento confirmado va antes
 * de cambiarle el horario: el trigger lleva el horario nuevo a todos sus renglones, y si el salón
 * que se deja sigue ahí, choca con lo que lo tenga reservado en la fecha nueva (RN-12) aunque ya no
 * se vaya a usar. Que el evento quede un instante sin salones no importa: ese control es diferido.
 *
 * Los salones que saca quedan en la auditoría (la lista antes y después): el servicio la llama
 * antes de reemplazarSalonesDelEvento, y esa toma su foto "antes" ya sin ellos.
 */
export async function quitarSalonesDelEvento(
  eventoId: number,
  salonIds: number[],
  tx: Prisma.TransactionClient = prisma,
) {
  await enTransaccion(tx, async (t) => {
    const antes = await salonesDelEvento(eventoId, t);
    const { count } = await t.eventoSalon.deleteMany({
      where: { eventoId, salonId: { notIn: salonIds } },
    });
    if (count === 0) return;
    await registrarAuditoria(t, {
      entidad: 'Evento',
      entidadId: eventoId,
      anterior: { salones: antes },
      nuevo: { salones: await salonesDelEvento(eventoId, t) },
    });
  });
}

/**
 * Deja al evento con exactamente estos salones. Los renglones que ya estaban y siguen se
 * conservan, para no perder la distribución que tengan cargada; los nuevos entran con la que diga
 * `distribuciones` (el armado que heredan, ver modificarPresupuesto) o sin ninguna.
 *
 * inicio, fin y estado no se escriben acá a propósito: los pone el trigger a partir del evento
 * (ADR 0011).
 */
export async function reemplazarSalonesDelEvento(
  eventoId: number,
  salonIds: number[],
  tx: Prisma.TransactionClient = prisma,
  distribuciones: Map<number, number> = new Map(),
) {
  await enTransaccion(tx, async (t) => {
    const antes = await salonesDelEvento(eventoId, t);
    // HU-50: los salones son de un día. Hoy el evento tiene uno solo.
    const diaId = await primerDiaDelEvento(t, eventoId);
    await t.eventoSalon.deleteMany({ where: { diaId, salonId: { notIn: salonIds } } });
    const actuales = await t.eventoSalon.findMany({
      where: { diaId },
      select: { salonId: true },
    });
    const yaEstan = new Set(actuales.map((fila) => fila.salonId));
    const nuevos = salonIds.filter((id) => !yaEstan.has(id));
    // createMany no dispara el trigger BEFORE INSERT fila por fila en todos los casos; create sí,
    // y son a lo sumo cinco salones.
    for (const salonId of nuevos) {
      await t.eventoSalon.create({
        data: { eventoId, diaId, salonId, distribucionId: distribuciones.get(salonId) ?? null },
      });
    }
    // Los salones se auditan como un campo del evento: la lista antes y después.
    await registrarAuditoria(t, {
      entidad: 'Evento',
      entidadId: eventoId,
      anterior: { salones: antes },
      nuevo: { salones: await salonesDelEvento(eventoId, t) },
    });
  });
}

// Los salones de un evento por nombre, con su distribución, para la auditoría.
export async function salonesDelEvento(eventoId: number, tx: Prisma.TransactionClient) {
  const filas = await tx.eventoSalon.findMany({
    where: { eventoId },
    select: { salon: { select: { nombre: true } }, distribucion: { select: { nombre: true } } },
    orderBy: { salonId: 'asc' },
  });
  return filas.map((fila) =>
    fila.distribucion ? `${fila.salon.nombre} (${fila.distribucion.nombre})` : fila.salon.nombre,
  );
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
// datos de contacto y del formulario con los que el cliente pidió la consulta. Solo vincula si
// sigue libre (eventoId null) y devuelve cuántas filas tocó: 0 = otra transacción la tomó antes.
export async function vincularSolicitudAEvento(
  solicitudId: number,
  eventoId: number,
  tx: Prisma.TransactionClient = prisma,
): Promise<number> {
  return enTransaccion(tx, async (t) => {
    const { count } = await t.solicitud.updateMany({
      where: { id: solicitudId, eventoId: null },
      data: { eventoId },
    });
    if (count > 0) {
      await registrarAuditoria(t, {
        entidad: 'Solicitud',
        entidadId: solicitudId,
        anterior: { eventoId: null },
        nuevo: { eventoId },
      });
    }
    return count;
  });
}

// Un evento corporativo llega con salón; uno social, sin salón y con su tipo social (ADR 0008).
export async function crearEvento(
  datos: {
    clienteId: number;
    fecha: Date;
    cantidadPersonas: number;
    tipo: 'Social' | 'Corporativo';
    tipoSocial?: TipoEventoSocial | null;
    tipoSocialDetalle?: string | null;
    tipoJornada: TipoJornada;
    horaInicioEstimada?: string | null;
    horaFinEstimada?: string | null;
  },
  tx: Prisma.TransactionClient = prisma,
) {
  // estado: EnConsulta es el default del schema, no hace falta pasarlo.
  return enTransaccion(tx, async (t) => {
    const evento = await t.evento.create({
      data: {
        ...datos,
        // HU-50: el evento nace con su único día. fecha, cantidadPersonas y tipoJornada de arriba
        // son el resumen: una vez creado el día, los recalcula la base a partir de él.
        dias: {
          create: {
            fecha: datos.fecha,
            cantidadPersonas: datos.cantidadPersonas,
            tipoJornada: datos.tipoJornada,
          },
        },
      },
    });
    await registrarAuditoria(t, {
      entidad: 'Evento',
      entidadId: evento.id,
      anterior: null,
      nuevo: evento,
    });
    return evento;
  });
}

// HU-50 parte 1: todos los eventos tienen un solo día, así que «su día» es el primero. Las partes
// siguientes reciben el día que corresponde en lugar de buscarlo acá.
async function primerDiaDelEvento(tx: Prisma.TransactionClient, eventoId: number): Promise<number> {
  const dia = await tx.eventoDia.findFirstOrThrow({
    where: { eventoId },
    orderBy: { fecha: 'asc' },
    select: { id: true },
  });
  return dia.id;
}

// Lo que se audita de las líneas de un presupuesto: lo que se lee en el documento.
export function resumenDeLineas(
  lineas: {
    descripcion: string;
    cantidad: number;
    modalidad: ModalidadServicio;
    precioUnitario: unknown;
    subtotal: unknown;
    aCotizar: boolean;
  }[],
) {
  return lineas.map((linea) => ({
    descripcion: linea.descripcion,
    cantidad: linea.cantidad,
    modalidad: linea.modalidad,
    precioUnitario: linea.precioUnitario,
    subtotal: linea.subtotal,
    aCotizar: linea.aCotizar,
  }));
}

// Una línea lista para guardar: el servicio ya resolvió precio, modalidad (RN-11) y subtotal.
export interface LineaNueva {
  servicioId: number | null;
  salonId: number | null;
  descripcion: string;
  cantidad: number;
  modalidad: ModalidadServicio;
  precioBase: string | null;
  precioUnitario: string;
  subtotal: string;
  aCotizar: boolean;
  horaEstimada: string | null;
  // HU-50: el día del evento al que pertenece la línea. Si no viene, el repositorio usa el único día
  // del evento (hoy todos los eventos tienen uno; las partes siguientes lo mandan).
  diaId?: number;
}

export async function crearPresupuestoConLineas(
  datos: {
    eventoId: number;
    fechaEmision: Date;
    venceEn: Date | null; // null: presupuesto sin armar de una consulta social (ADR 0008)
    total: string;
    lineas: LineaNueva[];
  },
  tx: Prisma.TransactionClient = prisma,
) {
  return enTransaccion(tx, async (t) => {
    const presupuesto = await crearPresupuesto(datos, t);
    const { lineas, evento: _evento, ...campos } = presupuesto;
    await registrarAuditoria(t, {
      entidad: 'Presupuesto',
      entidadId: presupuesto.id,
      anterior: null,
      nuevo: { ...campos, lineas: resumenDeLineas(lineas) },
    });
    return presupuesto;
  });
}

async function crearPresupuesto(
  datos: Parameters<typeof crearPresupuestoConLineas>[0],
  tx: Prisma.TransactionClient,
) {
  const diaId = await primerDiaDelEvento(tx, datos.eventoId);
  return tx.presupuesto.create({
    data: {
      eventoId: datos.eventoId,
      fechaEmision: datos.fechaEmision,
      venceEn: datos.venceEn,
      total: datos.total,
      // HU-53 (reunión con el cliente del 05/11/2026): todo presupuesto nuevo requiere factura y su
      // base de cobro es el total con IVA (RN-01). El default de la columna sigue en false para no
      // cambiar el modelo; los presupuestos anteriores conservan su marca.
      requiereFactura: true,
      lineas: { create: datos.lineas.map((linea) => ({ ...linea, diaId: linea.diaId ?? diaId })) },
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
// desempata los emitidos en el mismo instante). Los Confirmado no se listan: pasan a la agenda.
// Tampoco los Cancelados que se sacaron con el tacho (`ocultoEn`). Cada palabra de `cliente` tiene que aparecer en el nombre, el
// apellido, el correo o la etiqueta, así "Marina Gómez" encuentra a quien tiene nombre y apellido
// separados y "empresa1" a todos los clientes con esa etiqueta.
export async function obtenerPresupuestos(filtros: FiltrosPresupuestos) {
  const { estado, cliente, desde, hasta } = filtros;
  const palabras = cliente?.split(/\s+/) ?? [];

  return prisma.presupuesto.findMany({
    where: {
      estado: estado ?? { not: 'Confirmado' },
      ocultoEn: null,
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
              { etiqueta: { nombre: { contains: palabra, mode: 'insensitive' as const } } },
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
      avisoRecepcionEn: true,
      envioFormalEn: true,
      evento: {
        select: {
          fecha: true,
          tipo: true,
          tipoSocial: true,
          tipoSocialDetalle: true,
          salones: {
            select: { salon: { select: { id: true, nombre: true } } },
            orderBy: { salonId: 'asc' },
          },
          cliente: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              correo: true,
              etiqueta: { select: { id: true, nombre: true } },
            },
          },
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
          cliente: { include: { etiqueta: { select: { id: true, nombre: true } } } },
          // Cada salón con la distribución que tiene armada en este evento (ADR 0011).
          salones: { include: { salon: true, distribucion: true }, orderBy: { salonId: 'asc' } },
        },
      },
      lineas: {
        include: { servicio: { select: { tercerizado: true, admiteModalidad: true } } },
        orderBy: { id: 'asc' },
      },
    },
  });
}

// HU-50 (ADR 0014): fecha, inicio, fin, cantidadPersonas y tipoJornada son del DÍA. El evento solo
// guarda su resumen, que calcula la base; escribirlo a mano lo rechaza un trigger. Por eso lo que
// llega de esos cinco campos se escribe en el día, y el resto en el evento.
export type ActualizacionDeEvento = Omit<
  Prisma.EventoUpdateInput,
  'fecha' | 'fechaFin' | 'inicio' | 'fin' | 'cantidadPersonas' | 'tipoJornada'
> & {
  fecha?: Date;
  inicio?: Date | null;
  fin?: Date | null;
  cantidadPersonas?: number;
  tipoJornada?: TipoJornada | null;
};

export async function actualizarEvento(
  id: number,
  datos: ActualizacionDeEvento,
  tx: Prisma.TransactionClient = prisma,
) {
  const { fecha, inicio, fin, cantidadPersonas, tipoJornada, ...delEvento } = datos;
  const delDia = { fecha, inicio, fin, cantidadPersonas, tipoJornada };
  const cambiaElDia = Object.values(delDia).some((valor) => valor !== undefined);
  return enTransaccion(tx, async (t) => {
    const anterior = await t.evento.findUniqueOrThrow({ where: { id } });
    // El día va primero: el horario nuevo se propaga a sus salones (RN-12) antes de tocar el estado.
    if (cambiaElDia) {
      const diaId = await primerDiaDelEvento(t, id);
      await t.eventoDia.update({ where: { id: diaId }, data: delDia });
    }
    if (Object.keys(delEvento).length > 0) {
      await t.evento.update({ where: { id }, data: delEvento });
    }
    // Se vuelve a leer: el resumen lo escribió la base y es lo que se audita como «nuevo».
    const evento = await t.evento.findUniqueOrThrow({ where: { id } });
    await registrarAuditoria(t, { entidad: 'Evento', entidadId: id, anterior, nuevo: evento });
    return evento;
  });
}

// usuarioId: omitido, el de la sesión; null, el Sistema (el recálculo masivo de HU-54).
export async function actualizarPresupuesto(
  id: number,
  datos: Prisma.PresupuestoUpdateInput,
  tx: Prisma.TransactionClient = prisma,
  usuarioId?: number | null,
) {
  return enTransaccion(tx, async (t) => {
    const anterior = await t.presupuesto.findUniqueOrThrow({ where: { id } });
    const presupuesto = await t.presupuesto.update({ where: { id }, data: datos });
    await registrarAuditoria(t, {
      usuarioId,
      entidad: 'Presupuesto',
      entidadId: id,
      anterior,
      nuevo: presupuesto,
    });
    return presupuesto;
  });
}

// HU-12: modificar reemplaza todas las líneas. Las que no cambiaron vuelven con su precio congelado,
// que el servicio ya resolvió.
export async function reemplazarLineas(
  presupuestoId: number,
  lineas: LineaNueva[],
  tx: Prisma.TransactionClient = prisma,
  usuarioId?: number | null,
) {
  await enTransaccion(tx, async (t) => {
    const antes = await t.lineaPresupuesto.findMany({
      where: { presupuestoId },
      orderBy: { id: 'asc' },
    });
    const { eventoId } = await t.presupuesto.findUniqueOrThrow({
      where: { id: presupuestoId },
      select: { eventoId: true },
    });
    const diaId = await primerDiaDelEvento(t, eventoId);
    await t.lineaPresupuesto.deleteMany({ where: { presupuestoId } });
    await t.lineaPresupuesto.createMany({
      data: lineas.map((linea) => ({ ...linea, presupuestoId, diaId: linea.diaId ?? diaId })),
    });
    // Las líneas se auditan como un campo del presupuesto: la lista antes y después.
    await registrarAuditoria(t, {
      usuarioId,
      entidad: 'Presupuesto',
      entidadId: presupuestoId,
      anterior: { lineas: resumenDeLineas(antes) },
      nuevo: { lineas: resumenDeLineas(lineas) },
    });
  });
}

// HU-12 sobre un evento confirmado: con el total nuevo, lo pagado decide si el evento queda
// Reservado o Cobrado.
export async function sumarPagos(eventoId: number, tx: Prisma.TransactionClient = prisma) {
  // Sin los pagos anulados (HU-35 del Sprint 4): no suman a lo pagado.
  const resultado = await tx.pago.aggregate({
    where: { eventoId, anuladoEn: null },
    _sum: { monto: true },
  });
  return resultado._sum.monto;
}

// Al mover de salón un evento ya agendado se conserva la distribución del mismo nombre en el salón
// nuevo (todos tienen Conferencia, Mesas de trabajo y Banquete). Si no la tiene, queda sin elegir.
export async function buscarDistribucionPorNombre(
  salonId: number,
  nombre: string,
  tx: Prisma.TransactionClient = prisma,
) {
  // Solo las activas: heredar una dada de baja (HU-25 del Sprint 4) sería elegirla de nuevo.
  return tx.distribucion.findFirst({ where: { salonId, nombre, activo: true } });
}

// RN-13: el porcentaje de incremento mensual. La fila la crea la migración; si faltara (una base
// armada a mano), es 0 y no se proyecta nada.
export async function obtenerPorcentajeMensual(tx: Prisma.TransactionClient = prisma) {
  const configuracion = await tx.configuracionPrecios.findUnique({ where: { id: 1 } });
  return configuracion?.porcentajeMensual.toString() ?? '0';
}

// HU-54: los presupuestos que se recalculan al cambiar el porcentaje de incremento: Estimado, de un
// evento EnConsulta y ya armados (con vencimiento; una consulta social sin armar no tiene líneas).
// Quedan afuera los Expirado (esperan un cambio de fecha), los Confirmado (congelados por la seña)
// y los Estimado sobrantes de un evento ya confirmado con otro presupuesto.
export async function listarEstimadosParaRecalcular(tx: Prisma.TransactionClient = prisma) {
  return tx.presupuesto.findMany({
    where: { estado: 'Estimado', venceEn: { not: null }, evento: { estado: 'EnConsulta' } },
    select: {
      id: true,
      // El total y las líneas de antes sirven también para auditar sin volver a leerlos.
      total: true,
      evento: { select: { fecha: true } },
      lineas: { include: { servicio: true, salon: true }, orderBy: { id: 'asc' } },
    },
  });
}

// Un presupuesto recalculado (HU-54), con lo que tenía antes, ya leído por listarEstimadosParaRecalcular.
export interface PresupuestoRecalculado {
  id: number;
  totalAnterior: Prisma.Decimal;
  lineasAnteriores: Parameters<typeof resumenDeLineas>[0];
  lineas: LineaNueva[];
  total: string;
}

/**
 * HU-54 con HU-25 del backlog: guarda el recálculo masivo y lo audita a nombre del Sistema, con el
 * menor número de consultas posible porque corre dentro de una sola transacción. El estado anterior
 * ya viene leído, los presupuestos que no cambian no se escriben y la auditoría de todos va en un
 * solo insert al final. Devuelve cuántos cambiaron.
 */
export async function guardarRecalculo(
  recalculados: PresupuestoRecalculado[],
  tx: Prisma.TransactionClient,
): Promise<number> {
  const cambios = recalculados.flatMap((recalculado) => {
    const anterior = {
      total: recalculado.totalAnterior,
      lineas: resumenDeLineas(recalculado.lineasAnteriores),
    };
    const nuevo = { total: recalculado.total, lineas: resumenDeLineas(recalculado.lineas) };
    return calcularDiferencia(anterior, nuevo) ? [{ recalculado, anterior, nuevo }] : [];
  });
  for (const { recalculado } of cambios) {
    await tx.lineaPresupuesto.deleteMany({ where: { presupuestoId: recalculado.id } });
    await tx.lineaPresupuesto.createMany({
      data: recalculado.lineas.map((linea) => {
        if (linea.diaId === undefined) {
          throw new Error(
            `La línea «${linea.descripcion}» del presupuesto ${recalculado.id} no trae su día`,
          );
        }
        return { ...linea, presupuestoId: recalculado.id, diaId: linea.diaId };
      }),
    });
    await tx.presupuesto.update({
      where: { id: recalculado.id },
      data: { total: recalculado.total },
    });
  }
  await registrarAuditorias(
    tx,
    cambios.map(({ recalculado, anterior, nuevo }) => ({
      usuarioId: null,
      entidad: 'Presupuesto' as const,
      entidadId: recalculado.id,
      anterior,
      nuevo,
    })),
  );
  return cambios.length;
}

// HU-24: el evento que se reutiliza, con sus salones (y la distribución de cada uno) y sus
// presupuestos con las líneas. De cada servicio se trae lo necesario para saber si sigue en el
// catálogo y con qué precio.
export async function buscarEventoParaReutilizar(
  id: number,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.evento.findUnique({
    where: { id },
    include: {
      // activo de la distribución: una dada de baja (HU-25 del Sprint 4) no se copia al evento nuevo.
      salones: {
        include: { salon: true, distribucion: { select: { activo: true } } },
        orderBy: { salonId: 'asc' },
      },
      presupuestos: {
        include: { lineas: { include: { servicio: true }, orderBy: { id: 'asc' } } },
        orderBy: { id: 'asc' },
      },
    },
  });
}

// RN-12 sobre una consulta que todavía no tiene horario: los salones que ese día ya tienen un
// evento reservado o cobrado. Es un aviso, no un bloqueo.
export async function buscarSalonesReservadosEseDia(
  salonIds: number[],
  fecha: Date,
  tx: Prisma.TransactionClient = prisma,
) {
  const filas = await tx.eventoSalon.findMany({
    where: {
      salonId: { in: salonIds },
      evento: { fecha, estado: { in: ['Reservado', 'Cobrado'] } },
    },
    select: { salon: { select: { id: true, nombre: true } } },
    distinct: ['salonId'],
    orderBy: { salonId: 'asc' },
  });
  return filas.map((fila) => fila.salon);
}

export type PresupuestosRepositorio = {
  buscarClientePorCorreo: typeof buscarClientePorCorreo;
  buscarClientePorUsuarioId: typeof buscarClientePorUsuarioId;
  crearCliente: typeof crearCliente;
  buscarSalon: typeof buscarSalon;
  buscarSalonesPorIds: typeof buscarSalonesPorIds;
  quitarSalonesDelEvento: typeof quitarSalonesDelEvento;
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
  obtenerPorcentajeMensual: typeof obtenerPorcentajeMensual;
  listarEstimadosParaRecalcular: typeof listarEstimadosParaRecalcular;
  guardarRecalculo: typeof guardarRecalculo;
  buscarEventoParaReutilizar: typeof buscarEventoParaReutilizar;
  buscarSalonesReservadosEseDia: typeof buscarSalonesReservadosEseDia;
};
