import {
  type AgendarEvento,
  type FiltrosAgenda,
  horariosDeAgenda,
  hoyEnZonaEventos,
} from '@confluens/shared';

import { avisoDeChoques, textoDelDia } from '../../lib/aviso-de-choques.js';
import { ErrorApi } from '../../lib/errores.js';
import { esDeVariosDias } from '../../lib/evento-de-varios-dias.js';
import { esViolacionDeSolapamiento, mensajeDeSolapamiento } from '../../lib/prisma-errores.js';
import * as eventosRepositorioReal from './eventos.repositorio.js';
import type { EventosRepositorio } from './eventos.repositorio.js';

const CUARENTA_Y_OCHO_HORAS_EN_MS = 48 * 60 * 60 * 1000;

// EventoSalon es la fila de la relación; afuera interesa el salón, con la distribución que tiene
// armada en este evento (ADR 0011). Es la forma que esperan la agenda y el detalle del evento.
// HU-50: los salones están por día, así que uno que se usa varios días aparece varias veces; en el
// resumen del evento cuenta una sola vez. Los días salen con sus propios salones.
type FilaDeSalon<S, D> = { salon: S & { id: number }; distribucion: D };
function conSalones<
  S,
  D,
  T extends {
    salones: FilaDeSalon<S, D>[];
    dias?: {
      fecha: Date;
      salones: FilaDeSalon<S, D>[];
    }[];
  },
>(evento: T) {
  const vistos = new Set<number>();
  const unicos = evento.salones.filter(
    ({ salon }) => !vistos.has(salon.id) && !!vistos.add(salon.id),
  );
  const { dias, ...resto } = evento;
  return {
    ...resto,
    salones: unicos.map(({ salon, distribucion }) => ({ ...salon, distribucion })),
    dias: (dias ?? []).map((dia) => ({
      ...dia,
      fecha: dia.fecha.toISOString().slice(0, 10),
      salones: dia.salones.map(({ salon, distribucion }) => ({ ...salon, distribucion })),
    })),
  };
}

// Relee el evento después de escribirlo, para devolver el estado que quedó. Lo usan la consulta
// del detalle y todas las acciones sobre el evento, así todas cumplen EventoDetallado.
async function releerDetalle(id: number, repo: EventosRepositorio) {
  const evento = await repo.buscarDetallado(id);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${id}`);
  return conSalones(evento);
}

// Aplana el presupuesto Confirmado en totalPresupuesto (esquemaEventoAgenda): la agenda no necesita
// la lista de presupuestos, solo el total tomado. El filtrado es parte de la consulta (repositorio).
export async function listarAgenda(
  filtros: FiltrosAgenda,
  repo: EventosRepositorio = eventosRepositorioReal,
) {
  const eventos = await repo.listarAgenda(filtros);
  return eventos.map(({ presupuestos, ...evento }) => ({
    ...conSalones(evento),
    totalPresupuesto: presupuestos[0]?.total ?? null,
  }));
}

export async function obtenerDetalle(
  id: number,
  repo: EventosRepositorio = eventosRepositorioReal,
) {
  return releerDetalle(id, repo);
}

/**
 * Agenda el evento: le fija distribución, franja horaria y modalidad. **No cambia el estado ni
 * toca el presupuesto**: un evento EnConsulta sigue EnConsulta con su presupuesto Estimado, y uno
 * Reservado o Cobrado se reagenda sin perder la reserva (RN-09). Solo se rechaza un Cancelado.
 *
 * Es el paso previo obligatorio a cobrar la seña. Un evento EnConsulta no bloquea el salón
 * (dominio.md), pero sin `inicio` y `fin` cargados el módulo de pagos no tiene con qué evaluar el
 * solapamiento de RN-12 en el momento en que el 20% lo pasa a Reservado (HU-13).
 *
 * Reglas aplicadas:
 * - Cada salón del evento lleva su distribución, y cada distribución tiene que pertenecer a su
 *   salón. Un evento puede ocupar varios salones a la vez (ADR 0011). Con varios días el mismo salón
 *   puede llevar una distribución distinta cada día (HU-50): `fecha` en cada distribución.
 * - Si cantidadPersonas supera la capacidad sumada de las distribuciones, se exige
 *   `confirmarCapacidadExcedida: true` explícito para continuar. Es un aviso, no un tope.
 * - RN-12: no se agenda sobre una franja que otro evento ya ocupa (Reservado o Cobrado) en
 *   cualquiera de sus salones. Se valida en la aplicación (buscarSolapamiento, informa con qué
 *   evento y en qué salón choca) y además queda protegido por la constraint EXCLUDE de Postgres.
 * - `modalidadSalonRestaurante` se persiste tal cual llega, es una opción interna sin ninguna
 *   regla asociada en este sprint.
 */
export async function agendarEvento(
  id: number,
  datos: AgendarEvento,
  repo: EventosRepositorio = eventosRepositorioReal,
) {
  const evento = await repo.buscarDetallado(id);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${id}`);
  // RN-09: el horario de un evento ya confirmado también se puede cambiar (decisión de Franco,
  // 08/10/2026). Agendar no toca el estado, así que un Reservado sigue Reservado; lo que sí se
  // vuelve a controlar es que la franja nueva no pise a otro evento (RN-12, más abajo).
  if (evento.estado === 'Cancelado') {
    throw ErrorApi.conflicto(`El evento ${id} está cancelado`);
  }

  // ADR 0008: una consulta social llega sin salón; se carga en la consulta antes de agendar.
  // Un salón que se usa varios días cuenta una vez: la distribución es una por salón.
  const salonesDelEvento = [...new Map(evento.salones.map((s) => [s.salonId, s])).values()];
  const salonIds = salonesDelEvento.map((s) => s.salonId);
  if (salonIds.length === 0) {
    throw ErrorApi.reglaNegocio('Cargá el salón en la consulta antes de agendar el evento');
  }

  // HU-50: el salón se reserva por día y su armado también. Cada renglón (día, salón) toma la
  // distribución pedida para ese día o, si no hay, la general del salón; ni más ni menos (ADR 0011).
  const variosDias = esDeVariosDias(evento);
  const fechaDelDia = (dia: { fecha: Date }) => dia.fecha.toISOString().slice(0, 10);
  const renglones = evento.dias.flatMap((dia) =>
    dia.salones.map((fila) => ({
      dia,
      fecha: fechaDelDia(dia),
      salonId: fila.salonId,
      nombreDelSalon: fila.salon.nombre,
      distribucionActualId: fila.distribucionId,
    })),
  );
  const generales = new Map(
    datos.distribuciones
      .filter((d) => d.fecha === undefined)
      .map((d) => [d.salonId, d.distribucionId]),
  );
  const delDia = new Map(
    datos.distribuciones
      .filter((d) => d.fecha !== undefined)
      .map((d) => [`${d.fecha}|${d.salonId}`, d.distribucionId]),
  );
  type Renglon = (typeof renglones)[number];
  const pedidaPara = (r: Renglon) =>
    delDia.get(`${r.fecha}|${r.salonId}`) ?? generales.get(r.salonId);
  const sinDistribucion = renglones.filter((r) => pedidaPara(r) === undefined);
  if (sinDistribucion.length > 0) {
    // Un evento de un solo día (o un salón sin ninguna) nombra el salón; con varios días, cada día.
    const faltan = variosDias
      ? sinDistribucion.map((r) => `${r.nombreDelSalon} el ${textoDelDia(r.fecha)}`)
      : [...new Set(sinDistribucion.map((r) => r.nombreDelSalon))];
    throw ErrorApi.reglaNegocio(`Falta la distribución de ${faltan.join(', ')}`);
  }
  const ajeno = datos.distribuciones.find((d) => !salonIds.includes(d.salonId));
  if (ajeno) {
    throw ErrorApi.reglaNegocio(`El salón ${ajeno.salonId} no es de este evento`);
  }
  const fueraDelDia = datos.distribuciones.find(
    (d) =>
      d.fecha !== undefined &&
      !renglones.some((r) => r.fecha === d.fecha && r.salonId === d.salonId),
  );
  if (fueraDelDia) {
    const nombre = salonesDelEvento.find((s) => s.salonId === fueraDelDia.salonId)!.salon.nombre;
    throw ErrorApi.reglaNegocio(
      `El salón ${nombre} no se usa el ${textoDelDia(fueraDelDia.fecha!)}`,
    );
  }

  const distribuciones = await repo.buscarDistribuciones([
    ...new Set(datos.distribuciones.map((d) => d.distribucionId)),
  ]);
  const porId = new Map(distribuciones.map((d) => [d.id, d]));
  for (const r of renglones) {
    const distribucionId = pedidaPara(r)!;
    const distribucion = porId.get(distribucionId);
    if (!distribucion || distribucion.salonId !== r.salonId) {
      throw ErrorApi.noEncontrado(
        `No existe la distribución ${distribucionId} para el salón ${r.salonId}`,
      );
    }
    // HU-25 del Sprint 4: una dada de baja no se elige de nuevo, pero el evento que ya la tenía en
    // ese salón la conserva al reagendar (PO, 06/11/2026: la baja no lo afecta). Se mira renglón por
    // renglón: la conserva el día que ya la tenía.
    if (!distribucion.activo && r.distribucionActualId !== distribucionId) {
      throw ErrorApi.reglaNegocio(`La distribución "${distribucion.nombre}" está dada de baja`);
    }
  }

  const horariosPedidos = horariosDeAgenda(datos);

  // Con varios salones la gente se reparte: cuenta la capacidad sumada. Es un aviso, no un tope. Con
  // varios días se mira cada uno con SUS personas, SUS salones y SU armado (HU-50).
  const capacidadDe = (filas: Renglon[]) =>
    filas.reduce((suma, r) => suma + porId.get(pedidaPara(r)!)!.capacidad, 0);
  const nombresDe = (filas: Renglon[]) =>
    filas.map((r) => `"${porId.get(pedidaPara(r)!)!.nombre}"`);
  if (!datos.confirmarCapacidadExcedida) {
    if (variosDias) {
      for (const dia of evento.dias) {
        const delDiaActual = renglones.filter((r) => r.dia === dia);
        if (delDiaActual.length > 0 && dia.cantidadPersonas > capacidadDe(delDiaActual)) {
          throw ErrorApi.reglaNegocio(
            `El ${textoDelDia(fechaDelDia(dia))} tiene ${dia.cantidadPersonas} personas y ` +
              `supera la capacidad de ${nombresDe(delDiaActual).join(' + ')} (${capacidadDe(delDiaActual)}). ` +
              'Confirmá para continuar igualmente.',
          );
        }
      }
    } else {
      const capacidad = capacidadDe(renglones);
      if (evento.cantidadPersonas > capacidad) {
        throw ErrorApi.reglaNegocio(
          `${evento.cantidadPersonas} personas supera la capacidad de ${nombresDe(renglones).join(' + ')} ` +
            `(${capacidad}). Confirmá para continuar igualmente.`,
        );
      }
    }
  }

  // El horario de cada día. Cada día termina después de empezar, y empieza el día que le toca: agendar
  // fija las horas del día del evento, no el día (el día se cambia modificando la consulta, que además
  // recalcula el presupuesto). El día del inicio se lee en la zona de los eventos (ADR 0010); el fin
  // puede caer al día siguiente, en un día que termina pasada la medianoche.
  const fechasDelEvento = variosDias
    ? evento.dias.map((dia) => dia.fecha.toISOString().slice(0, 10))
    : [evento.fecha.toISOString().slice(0, 10)];
  if (variosDias && !datos.dias) {
    throw ErrorApi.reglaNegocio(
      'Este evento dura varios días: indicá el horario de cada día (dias)',
    );
  }
  const porFecha = new Map(
    horariosPedidos.map((h) => [h.fecha ?? fechasDelEvento[0]!, h] as const),
  );
  const faltantes = fechasDelEvento.filter((fecha) => !porFecha.has(fecha));
  const sobrantes = [...porFecha.keys()].filter((fecha) => !fechasDelEvento.includes(fecha));
  if (faltantes.length > 0 || sobrantes.length > 0 || porFecha.size !== horariosPedidos.length) {
    throw ErrorApi.reglaNegocio(
      faltantes.length > 0
        ? `Falta el horario de: ${faltantes.map(textoDelDia).join(', ')}`
        : `El evento no tiene estos días: ${sobrantes.map(textoDelDia).join(', ')}`,
    );
  }
  const horarios = fechasDelEvento.map((fecha) => {
    const pedido = porFecha.get(fecha)!;
    const desde = new Date(pedido.inicio);
    const hasta = new Date(pedido.fin);
    if (hasta <= desde) {
      throw ErrorApi.reglaNegocio(
        variosDias
          ? `El horario de fin del ${textoDelDia(fecha)} debe ser posterior al de inicio`
          : 'El horario de fin debe ser posterior al de inicio',
      );
    }
    if (hoyEnZonaEventos(desde) !== fecha) {
      throw ErrorApi.reglaNegocio(
        variosDias
          ? `El horario del ${textoDelDia(fecha)} tiene que empezar ese día. Para cambiar el día, modificá la consulta`
          : 'El horario tiene que empezar el día del evento. Para cambiar el día, modificá la consulta',
      );
    }
    return { fecha, inicio: desde, fin: hasta };
  });
  const inicio = horarios[0]!.inicio;
  const fin = horarios[horarios.length - 1]!.fin;

  // RN-12 (parte "aplicación"). Con varios días se avisa de TODOS los choques, cada uno con su día,
  // su salón, el evento y su horario (HU-50); la restricción de Postgres los atrapa igual, pero sin
  // decir cuáles.
  if (variosDias) {
    const choques = await repo.buscarChoquesPorDia({
      franjas: evento.dias.map((dia) => {
        const fecha = dia.fecha.toISOString().slice(0, 10);
        const horario = horarios.find((h) => h.fecha === fecha)!;
        return {
          fecha,
          salonIds: dia.salones.map((s) => s.salonId),
          inicio: horario.inicio,
          fin: horario.fin,
        };
      }),
      excluirEventoId: id,
    });
    if (choques.length > 0) {
      const { mensaje, detalles } = avisoDeChoques(choques, fechasDelEvento.length, 'agendar');
      throw ErrorApi.conflicto(mensaje, detalles);
    }
  } else {
    const solapado = await repo.buscarSolapamiento({ salonIds, inicio, fin, excluirEventoId: id });
    if (solapado) {
      throw ErrorApi.conflicto(mensajeDeSolapamiento(solapado, salonIds));
    }
  }

  try {
    await repo.crearEnTransaccion((tx) =>
      repo.agendarConDistribuciones(
        {
          eventoId: id,
          // Una por cada renglón (día, salón), por la clave del renglón.
          distribuciones: renglones.map((r) => ({
            diaId: r.dia.id,
            salonId: r.salonId,
            distribucionId: pedidaPara(r)!,
          })),
          inicio,
          fin,
          // Un evento de un solo día escribe su único día con inicio y fin.
          horarios: variosDias ? horarios : undefined,
          modalidadSalonRestaurante: datos.modalidadSalonRestaurante,
        },
        tx,
      ),
    );
  } catch (error) {
    // Red de seguridad ante una carrera: dos agendas concurrentes pueden pasar el pre-chequeo de
    // buscarSolapamiento y chocar recién acá con la constraint EXCLUDE (btree_gist).
    if (esViolacionDeSolapamiento(error)) {
      throw ErrorApi.conflicto('El salón ya está reservado en ese horario');
    }
    throw error;
  }

  return releerDetalle(id, repo);
}

/**
 * RN-07: la cancelación requiere un mínimo de 48 horas de anticipación respecto del
 * horario de inicio del evento. Solo aplica una vez Reservado (tiene inicio fijado); un evento
 * todavía EnConsulta no es un compromiso formal y se puede descartar sin esa restricción.
 */
/**
 * Guarda las notas al pie de la comanda de cocina (menús especiales, alergias, a quién buscar).
 * Es texto libre del personal y no toca ninguna regla de negocio, así que el único control es que
 * el evento exista y no esté cancelado: una comanda de un evento dado de baja no se imprime.
 */
export async function guardarObservacionesDeComanda(
  id: number,
  observaciones: string,
  repo: EventosRepositorio = eventosRepositorioReal,
) {
  const evento = await repo.buscarDetallado(id);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${id}`);
  if (evento.estado === 'Cancelado') {
    throw ErrorApi.conflicto(`El evento ${id} está cancelado: no tiene comanda`);
  }
  await repo.guardarObservacionesComanda(id, observaciones);
  return releerDetalle(id, repo);
}

/**
 * Guarda las observaciones de un día del evento (HU-50: cada día tiene las suyas). Texto libre del
 * personal, sin reglas de negocio: se controla que el evento exista, que no esté cancelado y qué día
 * es. Un evento de un solo día no necesita decirlo; uno de varios días sí, porque callar no dice cuál.
 */
export async function guardarObservacionesDelEvento(
  id: number,
  observaciones: string,
  fecha: string | undefined,
  repo: EventosRepositorio = eventosRepositorioReal,
) {
  const evento = await repo.buscarDetallado(id);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${id}`);
  if (evento.estado === 'Cancelado') {
    throw ErrorApi.conflicto(`El evento ${id} está cancelado: no admite observaciones`);
  }
  const dia =
    fecha === undefined
      ? evento.dias.length === 1
        ? evento.dias[0]
        : undefined
      : evento.dias.find((d) => d.fecha.toISOString().slice(0, 10) === fecha);
  if (!dia) {
    throw ErrorApi.reglaNegocio(
      fecha === undefined
        ? 'Este evento dura varios días: indicá de qué día son las observaciones (fecha)'
        : `El evento no tiene el ${textoDelDia(fecha)}`,
    );
  }
  await repo.guardarObservacionesDelDia(dia.id, observaciones);
  return releerDetalle(id, repo);
}

export async function cancelarEvento(
  id: number,
  repo: EventosRepositorio = eventosRepositorioReal,
) {
  const evento = await repo.buscarDetallado(id);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${id}`);
  if (evento.estado !== 'EnConsulta' && evento.estado !== 'Reservado') {
    throw ErrorApi.conflicto(
      `El evento ${id} no admite cancelación (estado actual: ${evento.estado})`,
    );
  }
  if (evento.estado === 'Reservado' && evento.inicio) {
    const limite = new Date(evento.inicio.getTime() - CUARENTA_Y_OCHO_HORAS_EN_MS);
    if (new Date() > limite) {
      throw ErrorApi.reglaNegocio('La cancelación requiere un mínimo de 48 horas de anticipación');
    }
  }
  await repo.cancelar(id);
  return releerDetalle(id, repo);
}
