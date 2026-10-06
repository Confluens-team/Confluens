import type { AgendarEvento } from '@confluens/shared';

import { ErrorApi } from '../../lib/errores.js';
import { esViolacionDeSolapamiento } from '../../lib/prisma-errores.js';
import * as eventosRepositorioReal from './eventos.repositorio.js';
import type { EventosRepositorio } from './eventos.repositorio.js';

const CUARENTA_Y_OCHO_HORAS_EN_MS = 48 * 60 * 60 * 1000;

// Aplana el presupuesto Confirmado en totalPresupuesto (esquemaEventoAgenda): la agenda no necesita
// la lista de presupuestos, solo el total tomado.
export async function listarAgenda(repo: EventosRepositorio = eventosRepositorioReal) {
  const eventos = await repo.listarAgenda();
  return eventos.map(({ presupuestos, ...evento }) => ({
    ...evento,
    totalPresupuesto: presupuestos[0]?.total ?? null,
  }));
}

export async function obtenerDetalle(
  id: number,
  repo: EventosRepositorio = eventosRepositorioReal,
) {
  const evento = await repo.buscarDetallado(id);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${id}`);
  return evento;
}

/**
 * Agenda el evento: le fija distribución, franja horaria y modalidad. **No cambia el estado ni
 * toca el presupuesto**: el evento sigue EnConsulta y su presupuesto sigue Estimado.
 *
 * Es el paso previo obligatorio a cobrar la seña. Un evento EnConsulta no bloquea el salón
 * (dominio.md), pero sin `inicio` y `fin` cargados el módulo de pagos no tiene con qué evaluar el
 * solapamiento de RN-12 en el momento en que el 20% lo pasa a Reservado (HU-13).
 *
 * Reglas aplicadas:
 * - La distribución tiene que pertenecer al salón del evento.
 * - Si cantidadPersonas supera la capacidad de la distribución elegida, se exige
 *   `confirmarCapacidadExcedida: true` explícito para continuar.
 * - RN-12: no se agenda sobre una franja que otro evento ya ocupa (Reservado o Cobrado). Se
 *   valida en la aplicación (buscarSolapamiento, informa con qué evento choca) y además queda
 *   protegido por la constraint EXCLUDE de Postgres (btree_gist).
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
  if (evento.estado !== 'EnConsulta') {
    throw ErrorApi.conflicto(
      `El evento ${id} no está EnConsulta (estado actual: ${evento.estado})`,
    );
  }

  const distribucion = await repo.buscarDistribucion(datos.distribucionId);
  if (!distribucion || distribucion.salonId !== evento.salonId) {
    throw ErrorApi.noEncontrado(
      `No existe la distribución ${datos.distribucionId} para este salón`,
    );
  }

  if (evento.cantidadPersonas > distribucion.capacidad && !datos.confirmarCapacidadExcedida) {
    throw ErrorApi.reglaNegocio(
      `${evento.cantidadPersonas} personas supera la capacidad de "${distribucion.nombre}" ` +
        `(${distribucion.capacidad}). Confirmá para continuar igualmente.`,
    );
  }

  const inicio = new Date(datos.inicio);
  const fin = new Date(datos.fin);
  if (fin <= inicio) {
    throw ErrorApi.reglaNegocio('El horario de fin debe ser posterior al de inicio');
  }

  // RN-12 (parte "aplicación")
  const solapado = await repo.buscarSolapamiento({
    salonId: evento.salonId,
    inicio,
    fin,
    excluirEventoId: id,
  });
  if (solapado) {
    throw ErrorApi.conflicto(
      `El salón ya está reservado en ese horario por el evento #${solapado.id}`,
    );
  }

  try {
    await repo.crearEnTransaccion((tx) =>
      repo.agendar(
        {
          eventoId: id,
          distribucionId: datos.distribucionId,
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

  return repo.buscarDetallado(id);
}

/**
 * RN-07: la cancelación requiere un mínimo de 48 horas de anticipación respecto del
 * horario de inicio del evento. Solo aplica una vez Reservado (tiene inicio fijado); un evento
 * todavía EnConsulta no es un compromiso formal y se puede descartar sin esa restricción.
 */
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
  return repo.buscarDetallado(id);
}
