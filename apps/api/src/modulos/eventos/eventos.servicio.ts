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
 *   salón. Un evento puede ocupar varios salones a la vez (ADR 0011).
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

  // Una distribución por cada salón del evento, ni más ni menos (ADR 0011).
  const pedidas = new Map(datos.distribuciones.map((d) => [d.salonId, d.distribucionId]));
  const faltan = salonesDelEvento.filter((s) => !pedidas.has(s.salonId));
  if (faltan.length > 0) {
    throw ErrorApi.reglaNegocio(
      `Falta la distribución de ${faltan.map((s) => s.salon.nombre).join(', ')}`,
    );
  }
  const ajeno = datos.distribuciones.find((d) => !salonIds.includes(d.salonId));
  if (ajeno) {
    throw ErrorApi.reglaNegocio(`El salón ${ajeno.salonId} no es de este evento`);
  }

  const distribuciones = await repo.buscarDistribuciones(
    datos.distribuciones.map((d) => d.distribucionId),
  );
  const porId = new Map(distribuciones.map((d) => [d.id, d]));
  for (const { salonId, distribucionId } of datos.distribuciones) {
    const distribucion = porId.get(distribucionId);
    if (!distribucion || distribucion.salonId !== salonId) {
      throw ErrorApi.noEncontrado(
        `No existe la distribución ${distribucionId} para el salón ${salonId}`,
      );
    }
    // HU-25 del Sprint 4: una dada de baja no se elige de nuevo, pero el evento que ya la tenía en
    // ese salón la conserva al reagendar (PO, 06/11/2026: la baja no lo afecta).
    const yaLaTenia = evento.salones.some(
      (s) => s.salonId === salonId && s.distribucionId === distribucionId,
    );
    if (!distribucion.activo && !yaLaTenia) {
      throw ErrorApi.reglaNegocio(`La distribución "${distribucion.nombre}" está dada de baja`);
    }
  }

  const variosDias = esDeVariosDias(evento);
  const horariosPedidos = horariosDeAgenda(datos);

  // Con varios salones la gente se reparte: cuenta la capacidad sumada. Es un aviso, no un tope. Con
  // varios días se mira cada uno con SUS personas y SUS salones (HU-50).
  const capacidadDe = (ids: number[]) =>
    datos.distribuciones
      .filter((d) => ids.includes(d.salonId))
      .reduce((suma, d) => suma + porId.get(d.distribucionId)!.capacidad, 0);
  const nombresDe = (ids: number[]) =>
    datos.distribuciones
      .filter((d) => ids.includes(d.salonId))
      .map((d) => `"${porId.get(d.distribucionId)!.nombre}"`);
  if (!datos.confirmarCapacidadExcedida) {
    if (variosDias) {
      for (const dia of evento.dias) {
        const idsDelDia = dia.salones.map((s) => s.salonId);
        if (idsDelDia.length > 0 && dia.cantidadPersonas > capacidadDe(idsDelDia)) {
          throw ErrorApi.reglaNegocio(
            `El ${textoDelDia(dia.fecha.toISOString().slice(0, 10))} tiene ${dia.cantidadPersonas} personas y ` +
              `supera la capacidad de ${nombresDe(idsDelDia).join(' + ')} (${capacidadDe(idsDelDia)}). ` +
              'Confirmá para continuar igualmente.',
          );
        }
      }
    } else {
      const capacidad = capacidadDe(salonIds);
      if (evento.cantidadPersonas > capacidad) {
        throw ErrorApi.reglaNegocio(
          `${evento.cantidadPersonas} personas supera la capacidad de ${nombresDe(salonIds).join(' + ')} ` +
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
          // En el orden de los salones del evento: la primera es la del primer salón.
          distribuciones: salonIds.map((salonId) => ({
            salonId,
            distribucionId: pedidas.get(salonId)!,
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
 * Guarda las observaciones generales del evento. Texto libre del personal, sin reglas de negocio:
 * el único control es que el evento exista y no esté cancelado.
 */
export async function guardarObservacionesDelEvento(
  id: number,
  observaciones: string,
  repo: EventosRepositorio = eventosRepositorioReal,
) {
  const evento = await repo.buscarDetallado(id);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${id}`);
  if (evento.estado === 'Cancelado') {
    throw ErrorApi.conflicto(`El evento ${id} está cancelado: no admite observaciones`);
  }
  await repo.guardarObservaciones(id, observaciones);
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
