import type { AgendarEvento, FiltrosAgenda } from '@confluens/shared';

import { ErrorApi } from '../../lib/errores.js';
import { esViolacionDeSolapamiento, mensajeDeSolapamiento } from '../../lib/prisma-errores.js';
import * as eventosRepositorioReal from './eventos.repositorio.js';
import type { EventosRepositorio } from './eventos.repositorio.js';

const CUARENTA_Y_OCHO_HORAS_EN_MS = 48 * 60 * 60 * 1000;

// Aplana el presupuesto Confirmado en totalPresupuesto (esquemaEventoAgenda): la agenda no necesita
// la lista de presupuestos, solo el total tomado. El filtrado es parte de la consulta (repositorio).
// EventoSalon es la fila de la relación; afuera lo que interesa es el salón. Los contratos de
// shared esperan la lista de salones, no la de vínculos.
function conSalones<S, T extends { salones: { salon: S }[] }>(
  evento: T,
): Omit<T, 'salones'> & {
  salones: S[];
} {
  return { ...evento, salones: evento.salones.map((vinculo) => vinculo.salon) };
}

// El detalle de un evento, como lo espera EventoDetallado: cada salón con la distribución que
// tiene armada en este evento. Lo devuelven la consulta y todas las acciones sobre el evento.
function detalleDe<S, T extends { salones: { salon: S; distribucionId: number | null }[] }>(
  evento: T,
): Omit<T, 'salones'> & { salones: (S & { distribucionId: number | null })[] } {
  return {
    ...evento,
    salones: evento.salones.map(({ salon, distribucionId }) => ({ ...salon, distribucionId })),
  };
}

// Relee el evento después de escribirlo, para devolver el estado que quedó.
async function releerDetalle(id: number, repo: EventosRepositorio) {
  const evento = await repo.buscarDetallado(id);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${id}`);
  return detalleDe(evento);
}

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
  const salonIds = evento.salones.map((s) => s.salonId);
  if (salonIds.length === 0) {
    throw ErrorApi.reglaNegocio('Cargá el salón en la consulta antes de agendar el evento');
  }

  // Una distribución por cada salón del evento, ni más ni menos (ADR 0011).
  const pedidas = new Map(datos.distribuciones.map((d) => [d.salonId, d.distribucionId]));
  const faltan = evento.salones.filter((s) => !pedidas.has(s.salonId));
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
  }

  // Con varios salones la gente se reparte: cuenta la capacidad sumada. Es un aviso, no un tope.
  const capacidad = datos.distribuciones.reduce(
    (suma, d) => suma + porId.get(d.distribucionId)!.capacidad,
    0,
  );
  if (evento.cantidadPersonas > capacidad && !datos.confirmarCapacidadExcedida) {
    const nombres = datos.distribuciones.map((d) => `"${porId.get(d.distribucionId)!.nombre}"`);
    throw ErrorApi.reglaNegocio(
      `${evento.cantidadPersonas} personas supera la capacidad de ${nombres.join(' + ')} ` +
        `(${capacidad}). Confirmá para continuar igualmente.`,
    );
  }

  const inicio = new Date(datos.inicio);
  const fin = new Date(datos.fin);
  if (fin <= inicio) {
    throw ErrorApi.reglaNegocio('El horario de fin debe ser posterior al de inicio');
  }

  // RN-12 (parte "aplicación")
  const solapado = await repo.buscarSolapamiento({ salonIds, inicio, fin, excluirEventoId: id });
  if (solapado) {
    throw ErrorApi.conflicto(mensajeDeSolapamiento(solapado, salonIds));
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
      throw ErrorApi.reglaNegocio(
        'La cancelación requiere un mínimo de 48 horas de anticipación (RN-07)',
      );
    }
  }
  await repo.cancelar(id);
  return releerDetalle(id, repo);
}
